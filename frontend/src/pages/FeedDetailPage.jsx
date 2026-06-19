import { ArrowLeft, CalendarDays, ClipboardList, RefreshCw, Rss } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import CopyButton from '../components/CopyButton';
import EntryDetailModal from '../components/EntryDetailModal';
import EntryTable from '../components/EntryTable';
import { ClearableInput } from '../components/FilterControls';
import { PageTitle } from '../components/Layout';
import LoadingState from '../components/LoadingState';
import Pagination, { getPageItems } from '../components/Pagination';
import StatusPill from '../components/StatusPill';
import TagList from '../components/TagList';
import VendorBadge from '../components/VendorBadge';
import { useFeed, useFeedCalendar, useFeedEntries, useFetchLogs, useInvalidateAll } from '../queries';
import { formatDateTime } from '../utils/format';

export default function FeedDetailPage() {
  const navigate = useNavigate();
  const invalidate = useInvalidateAll();
  const { feedId: feedIdParam } = useParams();
  const feedId = Number(feedIdParam);
  const [view, setView] = useState('list');
  const [keyword, setKeyword] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [detail, setDetail] = useState(null);
  const [dayItems, setDayItems] = useState(null);
  const [page, setLocalPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [fetching, setFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState('');

  const { data: feed, isLoading: loading, error: feedError, refetch } = useFeed(feedId);
  const { data: entries = { total: 0, items: [] }, error: entriesError } = useFeedEntries(feedId, { keyword, limit: pageSize, offset: (page - 1) * pageSize });
  const { data: calendar = [] } = useFeedCalendar(feedId, month, view === 'calendar');
  const { data: logs = [] } = useFetchLogs(feedId, view === 'logs');
  const error = (feedError || entriesError)?.message || '';

  async function triggerFetch() {
    setFetching(true);
    setFetchMessage('');
    try {
      const result = await api.post(`/feeds/${feedId}/refresh`, {});
      await invalidate();
      if (result?.result === 'failed') setFetchMessage(`抓取失败：${result.error || '未知错误'}`);
      else if (result?.result === 'skipped') setFetchMessage('订阅已停用，跳过抓取');
      else setFetchMessage('抓取成功');
    } catch (err) {
      setFetchMessage(err.message);
    } finally {
      setFetching(false);
    }
  }

  if (loading) return <><PageTitle title="订阅详情" subtitle="正在加载订阅源信息..." /><LoadingState title="正在加载订阅源..." rows={4} /></>;
  if (!feed) return <><PageTitle title="订阅详情" subtitle="无法加载订阅源信息" actions={<button onClick={() => refetch()}><RefreshCw size={17} />重试</button>} />{error && <div className="form-error">{error}</div>}</>;

  return (
    <>
      <PageTitle title="订阅详情" subtitle="查看单个 RSS 源的基础信息、动态条目与日历分布" actions={<><button onClick={() => navigate(-1)}><ArrowLeft size={18} />返回列表</button><button onClick={triggerFetch} disabled={fetching}><RefreshCw size={17} />{fetching ? '抓取中...' : '立即抓取'}</button><button onClick={() => invalidate()}>刷新</button></>} />
      {error && <div className="form-error">{error}</div>}
      {fetchMessage && <div className="inline-status"><span>{fetchMessage}</span><button onClick={() => setFetchMessage('')}>关闭</button></div>}
      <section className="detail-hero">
        <div className="hero-title"><div className="big-icon rss"><Rss size={34} /></div><div><h2>{feed.name}</h2><p>{feed.description || '暂无描述'}</p></div></div>
        <div className="detail-columns">
          <dl><dt>RSS URL</dt><dd className="copy-line"><span>{feed.rss_url}</span><CopyButton text={feed.rss_url} /></dd><dt>厂商</dt><dd><VendorBadge vendor={feed.vendor} /></dd><dt>产品名称</dt><dd>{feed.product}</dd><dt>数据库类型</dt><dd>{feed.db_type}</dd></dl>
          <dl><dt>状态</dt><dd><StatusPill status={feed.status} enabled={feed.enabled} /></dd><dt>标签</dt><dd><TagList tags={feed.tags} /></dd><dt>最近抓取时间</dt><dd>{formatDateTime(feed.last_fetched_at)}</dd><dt>最近更新时间</dt><dd>{formatDateTime(feed.latest_item_published_at)}</dd></dl>
        </div>
      </section>
      <section className="panel">
        <div className="tabs"><button className={view === 'list' ? 'active' : ''} onClick={() => { setDayItems(null); setView('list'); }}>条目列表</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => { setDayItems(null); setView('calendar'); }}><CalendarDays size={16} />日历视图</button><button className={view === 'logs' ? 'active' : ''} onClick={() => { setDayItems(null); setView('logs'); }}><ClipboardList size={16} />抓取记录</button>{view !== 'logs' && <ClearableInput className="tabs-search" value={keyword} onChange={(value) => { setLocalPage(1); setKeyword(value); }} placeholder="搜索标题或摘要" label="订阅动态搜索" />}</div>
        {view === 'list' && <><EntryTable entries={entries.items} onDetail={setDetail} /><Pagination total={entries.total} page={page} pageSize={pageSize} onPageChange={setLocalPage} onPageSizeChange={(size) => { setPageSize(size); setLocalPage(1); }} /></>}
        {view === 'calendar' && <div className="calendar-layout"><CalendarGrid days={calendar} month={month} onMonthChange={(value) => { setDayItems(null); setMonth(value); }} onDayClick={setDayItems} />{dayItems && <DayEntriesPanel dayItems={dayItems} onClose={() => setDayItems(null)} onDetail={setDetail} />}</div>}
        {view === 'logs' && <FetchLogsTable logs={logs} logPage={logPage} logPageSize={logPageSize} onPageChange={setLogPage} onPageSizeChange={(size) => { setLogPageSize(size); setLogPage(1); }} />}
      </section>
      <EntryDetailModal entry={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function FetchLogsTable({ logs, logPage, logPageSize, onPageChange, onPageSizeChange }) {
  const pagedLogs = getPageItems(logs, logPage, logPageSize);
  return (
    <>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>抓取时间</th><th>结果</th><th>新增条目</th><th>总条目</th><th>耗时(ms)</th><th>错误信息</th></tr></thead><tbody>{pagedLogs.map((log) => <tr key={log.id}><td>{formatDateTime(log.started_at)}</td><td><StatusPill status={log.result} /></td><td>{log.new_entries}</td><td>{log.total_entries}</td><td>{log.duration_ms ?? '-'}</td><td className="summary-cell">{log.error_message || '-'}</td></tr>)}{!logs.length && <tr><td colSpan="6" className="empty-cell">暂无抓取记录</td></tr>}</tbody></table></div>
      <Pagination total={logs.length} page={logPage} pageSize={logPageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
    </>
  );
}

function DayEntriesPanel({ dayItems, onClose, onDetail }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const items = dayItems.items || [];
  const pagedItems = getPageItems(items, page, pageSize);
  return (
    <section className="panel day-drawer">
      <div className="panel-header"><h2>{dayItems.date} 动态</h2><button onClick={onClose}>关闭</button></div>
      <EntryTable entries={pagedItems} compact onDetail={onDetail} />
      <Pagination total={items.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>
  );
}
