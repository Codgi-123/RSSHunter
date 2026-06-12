import { AlertTriangle, Eye, FileText, RefreshCw, Rss, Users } from 'lucide-react';
import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import ActionDialog from '../components/ActionDialog';
import MetricCard from '../components/MetricCard';
import Pagination, { getPageItems } from '../components/Pagination';
import StatusPill from '../components/StatusPill';
import VendorBadge from '../components/VendorBadge';
import { PageTitle } from '../components/Layout';
import { formatDateTime } from '../utils/format';

function normalizeTrend(rows = []) {
  const map = Object.fromEntries(rows.map((row) => [row.date, row.count]));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - 6 + index);
    const key = day.toISOString().slice(0, 10);
    return { date: key.slice(5), count: map[key] || 0 };
  });
}

export default function OverviewPage({ overview, setPage, setSelectedFeed, setSelectedGroup }) {
  const [recentPage, setRecentPage] = useState(1);
  const [recentPageSize, setRecentPageSize] = useState(5);
  const [abnormalPage, setAbnormalPage] = useState(1);
  const [abnormalPageSize, setAbnormalPageSize] = useState(5);
  const [busyFeedId, setBusyFeedId] = useState(null);
  const trend = normalizeTrend(overview.trend);
  const stats = overview.stats || {};
  const recentFeeds = overview.recent_feeds || [];
  const abnormalFeeds = overview.abnormal_feeds || [];
  const pagedRecentFeeds = getPageItems(recentFeeds, recentPage, recentPageSize);
  const pagedAbnormalFeeds = getPageItems(abnormalFeeds, abnormalPage, abnormalPageSize);

  function openFeed(feed) {
    setSelectedFeed?.(feed.id);
    setPage('feed-detail');
  }

  function openGroup(group) {
    setSelectedGroup(group.id);
    setPage('group-detail');
  }

  async function retryFeed(feed) {
    setBusyFeedId(feed.id);
    try {
      await api.post(`/feeds/${feed.id}/refresh`, {});
    } finally {
      setBusyFeedId(null);
    }
  }

  return (
    <>
      <PageTitle title="首页概览" subtitle="快速查看 RSS 平台整体状态、最新动态与异常订阅源" />
      <section className="metric-grid">
        <MetricCard icon={FileText} label="今日新增动态" value={stats.today_entries ?? 0} delta="较昨日 +18.7% ↑" hint="今日新增的动态条目总数" />
        <MetricCard icon={Rss} label="订阅源总数" value={stats.feed_count ?? 0} tone="green" delta="较昨日 +3 ↑" hint="当前已配置的 RSS 订阅源总数" />
        <MetricCard icon={Users} label="订阅组总数" value={stats.group_count ?? 0} tone="purple" delta="较昨日 +1 ↑" hint="当前已创建的订阅组总数" />
        <MetricCard icon={AlertTriangle} label="异常订阅源" value={stats.abnormal_count ?? 0} tone="red" delta="较昨日 -2 ↓" hint="当前存在异常的订阅源数量" />
      </section>

      <section className="content-split">
        <div className="panel trend-panel">
          <div className="panel-header"><h2>最近 7 天动态趋势</h2><button>近 7 天⌄</button></div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
              <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1b63f4" stopOpacity={0.25} /><stop offset="95%" stopColor="#1b63f4" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="#e7edf7" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#1b63f4" strokeWidth={3} fill="url(#trendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <div className="panel-header"><h2>最近更新订阅源</h2><button className="link-button" onClick={() => setPage('feeds')}>查看更多</button></div>
          <table className="data-table compact-table">
            <thead><tr><th>订阅源名称</th><th>最近更新时间</th><th>今日新增</th></tr></thead>
            <tbody>
              {pagedRecentFeeds.map((feed) => (
                <tr key={feed.id}>
                  <td><button className="table-title-link cell-with-icon" onClick={() => openFeed(feed)}><Rss size={15} />{feed.name}</button></td>
                  <td>{formatDateTime(feed.latest_item_published_at)}</td>
                  <td className="number-link">{feed.today_new || 0}</td>
                </tr>
              ))}
              {!recentFeeds.length && <tr><td colSpan="3" className="empty-cell">暂无最近更新订阅源</td></tr>}
            </tbody>
          </table>
          <Pagination total={recentFeeds.length} page={recentPage} pageSize={recentPageSize} onPageChange={setRecentPage} onPageSizeChange={(size) => { setRecentPageSize(size); setRecentPage(1); }} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>常用订阅组</h2><button className="link-button" onClick={() => setPage('groups')}>管理订阅组</button></div>
        <div className="quick-group-grid">
          {(overview.groups || []).map((group, index) => (
            <article className="quick-group-card" key={group.id}>
              <div className={`symbol-card color-${index % 5}`}>{['▰', '◆', '♜', '✣', '◒'][index % 5]}</div>
              <button className="card-title-link" onClick={() => openGroup(group)}>{group.name}</button>
              <p><span>包含订阅数</span><b>{group.feed_count || 0}</b></p>
              <p><span>今日新增</span><b>{group.today_new || 0}</b></p>
              <p><span>最近更新时间</span><b>{formatDateTime(group.latest_update)}</b></p>
              <button onClick={() => openGroup(group)}>查看详情</button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>异常订阅源</h2><button className="link-button" onClick={() => setPage('status')}>查看更多</button></div>
        <table className="data-table">
          <thead><tr><th>订阅名称</th><th>厂商</th><th>产品</th><th>异常类型</th><th>最近抓取时间</th><th>操作</th></tr></thead>
          <tbody>
            {pagedAbnormalFeeds.map((feed) => (
              <tr key={feed.id}>
                <td><button className="table-title-link" onClick={() => openFeed(feed)}>{feed.name}</button></td>
                <td><VendorBadge vendor={feed.vendor} /></td>
                <td>{feed.product}</td>
                <td><StatusPill status={feed.status} enabled={feed.enabled} /></td>
                <td>{formatDateTime(feed.last_fetched_at)}</td>
                <td className="row-actions action-cell">
                  <ActionDialog
                    title={feed.name}
                    actions={[
                      { label: '查看详情', icon: <Eye size={16} />, onClick: () => openFeed(feed) },
                      { label: '重试抓取', icon: <RefreshCw size={16} />, primary: true, disabled: busyFeedId === feed.id, onClick: () => retryFeed(feed) },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {!abnormalFeeds.length && <tr><td colSpan="6" className="empty-cell">暂无异常订阅源</td></tr>}
          </tbody>
        </table>
        <Pagination total={abnormalFeeds.length} page={abnormalPage} pageSize={abnormalPageSize} onPageChange={setAbnormalPage} onPageSizeChange={(size) => { setAbnormalPageSize(size); setAbnormalPage(1); }} />
      </section>
    </>
  );
}
