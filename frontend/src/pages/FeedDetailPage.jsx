import { ArrowLeft, CalendarDays, RefreshCw, Rss } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import CopyButton from '../components/CopyButton';
import EntryTable from '../components/EntryTable';
import { PageTitle } from '../components/Layout';
import Pagination, { getPageItems } from '../components/Pagination';
import StatusPill from '../components/StatusPill';
import TagList from '../components/TagList';
import VendorBadge from '../components/VendorBadge';
import { formatDateTime } from '../utils/format';

export default function FeedDetailPage({ feedId, setPage }) {
  const [feed, setFeed] = useState(null);
  const [entries, setEntries] = useState({ total: 0, items: [] });
  const [calendar, setCalendar] = useState([]);
  const [view, setView] = useState('list');
  const [keyword, setKeyword] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dayItems, setDayItems] = useState(null);
  const [page, setLocalPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function load() {
    if (!feedId) return;
    const [feedData, entryData, calendarData] = await Promise.all([
      api.get(`/feeds/${feedId}`),
      api.get(`/feeds/${feedId}/entries`, { keyword, limit: pageSize, offset: (page - 1) * pageSize }),
      api.get(`/feeds/${feedId}/calendar`),
    ]);
    setFeed(feedData);
    setEntries(entryData);
    setCalendar(calendarData);
  }

  useEffect(() => { load(); }, [feedId, keyword, page, pageSize]);

  if (!feed) return <PageTitle title="订阅详情" subtitle="正在加载订阅源信息..." />;

  return (
    <>
      <PageTitle title="订阅详情" subtitle="查看单个 RSS 源的基础信息、动态条目与日历分布" actions={<><button onClick={() => setPage('feeds')}><ArrowLeft size={18} />返回列表</button><button onClick={load}><RefreshCw size={17} />刷新</button></>} />
      <section className="detail-hero">
        <div className="hero-title"><div className="big-icon rss"><Rss size={34} /></div><div><h2>{feed.name}</h2><p>{feed.description || '暂无描述'}</p></div></div>
        <div className="detail-columns">
          <dl><dt>RSS URL</dt><dd className="copy-line"><span>{feed.rss_url}</span><CopyButton text={feed.rss_url} /></dd><dt>厂商</dt><dd><VendorBadge vendor={feed.vendor} /></dd><dt>产品名称</dt><dd>{feed.product}</dd><dt>数据库类型</dt><dd>{feed.db_type}</dd></dl>
          <dl><dt>状态</dt><dd><StatusPill status={feed.status} enabled={feed.enabled} /></dd><dt>标签</dt><dd><TagList tags={feed.tags} /></dd><dt>最近抓取时间</dt><dd>{formatDateTime(feed.last_fetched_at)}</dd><dt>最近更新时间</dt><dd>{formatDateTime(feed.latest_item_published_at)}</dd></dl>
        </div>
      </section>
      <section className="panel">
        <div className="tabs"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>条目列表</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={16} />日历视图</button><input value={keyword} onChange={(event) => { setLocalPage(1); setKeyword(event.target.value); }} placeholder="搜索标题或摘要" /></div>
        {view === 'list' ? <><EntryTable entries={entries.items} /><Pagination total={entries.total} page={page} pageSize={pageSize} onPageChange={setLocalPage} onPageSizeChange={(size) => { setPageSize(size); setLocalPage(1); }} /></> : <div className="calendar-layout"><CalendarGrid days={calendar} month={month} onMonthChange={setMonth} onDayClick={setDayItems} />{dayItems && <DayEntriesPanel dayItems={dayItems} onClose={() => setDayItems(null)} />}</div>}
      </section>
    </>
  );
}

function DayEntriesPanel({ dayItems, onClose }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const items = dayItems.items || [];
  const pagedItems = getPageItems(items, page, pageSize);
  return (
    <section className="panel day-drawer">
      <div className="panel-header"><h2>{dayItems.date} 动态</h2><button onClick={onClose}>关闭</button></div>
      <EntryTable entries={pagedItems} compact />
      <Pagination total={items.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>
  );
}
