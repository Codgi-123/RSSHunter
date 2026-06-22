import { ArrowLeft, RefreshCw, Rss, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import CopyButton from '../components/CopyButton';
import DayEntriesPanel from '../components/DayEntriesPanel';
import EntryDetailModal from '../components/EntryDetailModal';
import EntryTimeline from '../components/EntryTimeline';
import { ClearableInput } from '../components/FilterControls';
import LoadingState from '../components/LoadingState';
import { useToast } from '../components/Toast';
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
  const [monthKey, setMonthKey] = useState(null);
  const [page, setLocalPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [fetching, setFetching] = useState(false);
  const toast = useToast();

  const { data: feed, isLoading: loading, error: feedError, refetch } = useFeed(feedId);
  const { data: entries = { total: 0, items: [] }, error: entriesError } = useFeedEntries(feedId, { keyword, limit: pageSize, offset: (page - 1) * pageSize });
  const { data: calendar = [] } = useFeedCalendar(feedId, month, view === 'calendar');
  const { data: calendarMonths = [] } = useFeedCalendar(feedId, month.slice(0, 4), view === 'calendar');
  const { data: monthCal = [] } = useFeedCalendar(feedId, monthKey || '', view === 'calendar' && !!monthKey);
  const monthDrawer = monthKey ? { date: `${monthKey} 全月`, items: monthCal.flatMap((d) => d.items || []) } : null;
  const calDrawer = dayItems || monthDrawer;
  const closeCalDrawer = () => { setDayItems(null); setMonthKey(null); };
  const { data: logs = [] } = useFetchLogs(feedId, view === 'logs');
  const error = (feedError || entriesError)?.message || '';

  async function triggerFetch() {
    setFetching(true);
    try {
      const result = await api.post(`/feeds/${feedId}/refresh`, {});
      await invalidate();
      if (result?.result === 'failed') toast.error(`抓取失败：${result.error || '未知错误'}`);
      else if (result?.result === 'skipped') toast.info('订阅已停用，跳过抓取');
      else toast.success('抓取成功');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFetching(false);
    }
  }

  if (loading) return <LoadingState title="正在加载订阅源..." rows={4} />;
  if (!feed) return (
    <div className="state-panel">
      <p>无法加载订阅源</p>
      <button onClick={() => refetch()}>重试</button>
    </div>
  );

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/feeds">订阅管理</Link>
        <span>/</span>
        <span style={{ color: 'var(--ink-2)' }}>{feed.name}</span>
      </nav>

      <div className="group-header">
        <div className="group-header-left">
          <div className="group-icon-box"><Rss size={24} /></div>
          <div>
            <div className="group-title">{feed.name}</div>
            {feed.description && <div className="group-desc">{feed.description}</div>}
          </div>
        </div>
        <div className="group-header-actions">
          <button className="underline-btn" onClick={() => navigate(-1)}><ArrowLeft size={14} />返回列表</button>
          <button className="underline-btn" onClick={triggerFetch} disabled={fetching}><RefreshCw size={14} />{fetching ? '抓取中...' : '立即抓取'}</button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="detail-meta">
        <dl>
          <dt>RSS URL</dt>
          <dd className="copy-line"><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{feed.rss_url}</span><CopyButton text={feed.rss_url} /></dd>
          <dt>厂商</dt><dd><VendorBadge vendor={feed.vendor} /></dd>
          <dt>产品名称</dt><dd>{feed.product}</dd>
          <dt>数据库类型</dt><dd>{feed.db_type}</dd>
        </dl>
        <dl>
          <dt>状态</dt><dd><StatusPill status={feed.status} enabled={feed.enabled} /></dd>
          <dt>标签</dt><dd><TagList tags={feed.tags} /></dd>
          <dt>最近抓取时间</dt><dd>{formatDateTime(feed.last_fetched_at)}</dd>
          <dt>最近更新时间</dt><dd>{formatDateTime(feed.latest_item_published_at)}</dd>
        </dl>
      </div>

      <div className="page-block">
        <div className="tab-bar">
          <button className={`tab-btn ${view === 'list' ? 'active' : ''}`} onClick={() => { setDayItems(null); setView('list'); }}>条目列表</button>
          <button className={`tab-btn ${view === 'calendar' ? 'active' : ''}`} onClick={() => { setDayItems(null); setView('calendar'); }}>日历视图</button>
          <button className={`tab-btn ${view === 'logs' ? 'active' : ''}`} onClick={() => { setDayItems(null); setView('logs'); }}>抓取记录</button>
        </div>
        {view !== 'logs' && <div className="filter-bar"><ClearableInput className="filter-field tabs-search" value={keyword} onChange={(value) => { setLocalPage(1); setKeyword(value); }} placeholder="搜索标题或摘要" label="订阅动态搜索" icon={<Search size={15} />} /></div>}
        {view === 'list' && <><EntryTimeline entries={entries.items} onDetail={setDetail} /><Pagination total={entries.total} page={page} pageSize={pageSize} onPageChange={setLocalPage} onPageSizeChange={(size) => { setPageSize(size); setLocalPage(1); }} /></>}
        {view === 'calendar' && <div className={`calendar-layout ${calDrawer ? 'has-drawer' : ''}`}><CalendarGrid days={calendar} monthlyDays={calendarMonths} month={month} onMonthChange={(value) => { closeCalDrawer(); setMonth(value); }} onDayClick={(d) => { setMonthKey(null); setDayItems(d); }} onMonthClick={(m) => { setDayItems(null); setMonthKey(m); }} />{calDrawer && <DayEntriesPanel dayItems={calDrawer} onClose={closeCalDrawer} onDetail={setDetail} />}</div>}
        {view === 'logs' && <FetchLogsTable logs={logs} logPage={logPage} logPageSize={logPageSize} onPageChange={setLogPage} onPageSizeChange={(size) => { setLogPageSize(size); setLogPage(1); }} />}
      </div>

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

