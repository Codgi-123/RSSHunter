import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api';
import { PageTitle } from '../components/Layout';
import MetricCard from '../components/MetricCard';
import Pagination, { getPageItems } from '../components/Pagination';
import StatusPill from '../components/StatusPill';
import { formatDateTime } from '../utils/format';

export default function StatusPage({ feeds, logs, reloadFeeds, reloadLogs }) {
  const [feedPage, setFeedPage] = useState(1);
  const [feedPageSize, setFeedPageSize] = useState(10);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [busyFeedId, setBusyFeedId] = useState(null);
  const [refreshing, setRefreshing] = useState('');
  const [message, setMessage] = useState('');
  const stats = useMemo(() => ({ ok: feeds.filter((feed) => feed.enabled && feed.status === 'normal').length, abnormal: feeds.filter((feed) => ['fetch_failed', 'parse_error'].includes(feed.status)).length, disabled: feeds.filter((feed) => !feed.enabled).length, logs: logs.length }), [feeds, logs]);
  const pagedFeeds = getPageItems(feeds, feedPage, feedPageSize);
  const pagedLogs = getPageItems(logs, logPage, logPageSize);

  async function refresh(feed) {
    setBusyFeedId(feed.id);
    setMessage('');
    try {
      await api.post(`/feeds/${feed.id}/refresh`, {});
      await Promise.all([reloadFeeds(), reloadLogs()]);
      setMessage(`订阅「${feed.name}」已刷新`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyFeedId(null);
    }
  }

  async function reload(type) {
    setRefreshing(type);
    setMessage('');
    try {
      if (type === 'feeds') await reloadFeeds();
      else await reloadLogs();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setRefreshing('');
    }
  }

  return (
    <>
      <PageTitle title="源状态" subtitle="展示订阅源健康状态、抓取结果、错误信息与最近抓取记录" />
      <section className="metric-grid"><MetricCard icon={CheckCircle2} label="正常订阅源" value={stats.ok} tone="green" hint="最近抓取成功" /><MetricCard icon={AlertTriangle} label="异常订阅源" value={stats.abnormal} tone="red" hint="抓取失败或解析异常" /><MetricCard icon={Clock} label="抓取记录" value={stats.logs} tone="purple" hint="最近记录数量" /><MetricCard icon={RefreshCw} label="停用订阅源" value={stats.disabled} tone="gray" hint="用户主动停用" /></section>
      {message && <div className="inline-status"><span>{message}</span><button onClick={() => setMessage('')}>关闭</button></div>}
      <section className="panel">
        <div className="panel-header"><h2>订阅源状态</h2><button onClick={() => reload('feeds')} disabled={refreshing === 'feeds'}><RefreshCw size={16} />{refreshing === 'feeds' ? '刷新中' : '刷新状态'}</button></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>订阅源</th><th>厂商</th><th>产品</th><th>状态</th><th>最近抓取时间</th><th>错误信息</th><th>操作</th></tr></thead><tbody>{pagedFeeds.map((feed) => <tr key={feed.id}><td>{feed.name}</td><td>{feed.vendor}</td><td>{feed.product}</td><td><StatusPill status={feed.status} enabled={feed.enabled} /></td><td>{formatDateTime(feed.last_fetched_at)}</td><td className="summary-cell">{feed.last_error || '最近抓取成功'}</td><td><button className="primary-mini" onClick={() => refresh(feed)} disabled={busyFeedId === feed.id}>{busyFeedId === feed.id ? '处理中' : '重试'}</button></td></tr>)}{!feeds.length && <tr><td colSpan="7" className="empty-cell">暂无订阅源状态</td></tr>}</tbody></table></div>
        <Pagination total={feeds.length} page={feedPage} pageSize={feedPageSize} onPageChange={setFeedPage} onPageSizeChange={(size) => { setFeedPageSize(size); setFeedPage(1); }} />
      </section>
      <section className="panel">
        <div className="panel-header"><h2>抓取记录</h2><button onClick={() => reload('logs')} disabled={refreshing === 'logs'}><RefreshCw size={16} />{refreshing === 'logs' ? '刷新中' : '刷新记录'}</button></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>抓取时间</th><th>订阅源</th><th>抓取结果</th><th>新增条目数</th><th>总条目数</th><th>错误信息</th></tr></thead><tbody>{pagedLogs.map((log) => <tr key={log.id}><td>{formatDateTime(log.started_at)}</td><td>{log.feed_name}</td><td><StatusPill status={log.result} /></td><td>{log.new_entries}</td><td>{log.total_entries}</td><td className="summary-cell">{log.error_message || '-'}</td></tr>)}{!logs.length && <tr><td colSpan="6" className="empty-cell">暂无抓取记录</td></tr>}</tbody></table></div>
        <Pagination total={logs.length} page={logPage} pageSize={logPageSize} onPageChange={setLogPage} onPageSizeChange={(size) => { setLogPageSize(size); setLogPage(1); }} />
      </section>
    </>
  );
}
