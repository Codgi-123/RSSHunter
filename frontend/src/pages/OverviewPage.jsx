import { AlertTriangle, FileText, Rss, TrendingUp, Users } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import MetricCard from '../components/MetricCard';
import StatusPill from '../components/StatusPill';
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

export default function OverviewPage({ overview, setPage, setSelectedGroup }) {
  const trend = normalizeTrend(overview.trend);
  const stats = overview.stats || {};
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
          <table className="data-table compact-table"><thead><tr><th>订阅源名称</th><th>最近更新时间</th><th>今日新增</th></tr></thead><tbody>{(overview.recent_feeds || []).map((feed) => <tr key={feed.id}><td><Rss size={15} />{feed.name}</td><td>{formatDateTime(feed.latest_item_published_at)}</td><td className="number-link">{feed.today_new || 0}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>常用订阅组</h2><button className="link-button" onClick={() => setPage('groups')}>管理订阅组</button></div>
        <div className="quick-group-grid">
          {(overview.groups || []).map((group, index) => (
            <article className="quick-group-card" key={group.id}>
              <div className={`symbol-card color-${index % 5}`}>{['▰', '◆', '♜', '✣', '◒'][index % 5]}</div>
              <h3>{group.name}</h3>
              <p><span>包含订阅数</span><b>{group.feed_count || 0}</b></p>
              <p><span>今日新增</span><b>{group.today_new || 0}</b></p>
              <p><span>最近更新时间</span><b>{formatDateTime(group.latest_update)}</b></p>
              <button onClick={() => { setSelectedGroup(group.id); setPage('group-detail'); }}>查看详情</button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>异常订阅源</h2><button className="link-button" onClick={() => setPage('status')}>查看更多</button></div>
        <table className="data-table"><thead><tr><th>订阅名称</th><th>厂商</th><th>产品</th><th>异常类型</th><th>最近抓取时间</th><th>操作</th></tr></thead><tbody>{(overview.abnormal_feeds || []).map((feed) => <tr key={feed.id}><td>{feed.name}</td><td>{feed.vendor}</td><td>{feed.product}</td><td><StatusPill status={feed.status} enabled={feed.enabled} /></td><td>{formatDateTime(feed.last_fetched_at)}</td><td><button className="outline-mini">查看</button><button className="primary-mini">重试</button></td></tr>)}{!overview.abnormal_feeds?.length && <tr><td colSpan="6" className="empty-cell">暂无异常订阅源</td></tr>}</tbody></table>
      </section>
    </>
  );
}
