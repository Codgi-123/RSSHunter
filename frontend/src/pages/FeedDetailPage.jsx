import CopyButton from '../components/CopyButton';
import VendorBadge from '../components/VendorBadge';
          <dl><dt>RSS URL</dt><dd className="copy-line"><span>{feed.rss_url}</span><CopyButton text={feed.rss_url} /></dd><dt>厂商</dt><dd><VendorBadge vendor={feed.vendor} /></dd><dt>产品名称</dt><dd>{feed.product}</dd><dt>数据库类型</dt><dd>{feed.db_type}</dd></dl>
        {view === 'list' ? <><EntryTable entries={entries.items} /><Pagination total={entries.total} page={page} pageSize={pageSize} onPageChange={setLocalPage} onPageSizeChange={(size) => { setPageSize(size); setLocalPage(1); }} /></> : <div className="calendar-layout"><CalendarGrid days={calendar} month={month} onMonthChange={setMonth} onDayClick={setDayItems} />{dayItems && <DayEntriesPanel dayItems={dayItems} onClose={() => setDayItems(null)} />}</div>}
import CalendarGrid from '../components/CalendarGrid';
import EntryTable from '../components/EntryTable';
import { PageTitle } from '../components/Layout';
import StatusPill from '../components/StatusPill';
import { formatDateTime } from '../utils/format';

export default function FeedDetailPage({ feedId, setPage }) {
  const [feed, setFeed] = useState(null);
  const [entries, setEntries] = useState({ total: 0, items: [] });
  const [calendar, setCalendar] = useState([]);
  const [view, setView] = useState('list');
  const [keyword, setKeyword] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dayItems, setDayItems] = useState(null);

  async function load() {
    if (!feedId) return;
    const [feedData, entryData, calendarData] = await Promise.all([
      api.get(`/feeds/${feedId}`),
      api.get(`/feeds/${feedId}/entries`, { keyword }),
      api.get(`/feeds/${feedId}/calendar`),
    ]);
    setFeed(feedData);
    setEntries(entryData);
    setCalendar(calendarData);
  }
  useEffect(() => { load(); }, [feedId, keyword]);

  if (!feed) return <PageTitle title="订阅详情" subtitle="正在加载订阅源信息..." />;

  return (
    <>
      <PageTitle title="订阅详情" subtitle="查看单个 RSS 源的基础信息、动态条目与日历分布" actions={<><button onClick={() => setPage('feeds')}><ArrowLeft size={18} />返回列表</button><button onClick={load}><RefreshCw size={17} />刷新</button></>} />
      <section className="detail-hero">
        <div className="hero-title"><div className="big-icon rss"><Rss size={34} /></div><div><h2>{feed.name}</h2><p>{feed.description || '暂无描述'}</p></div></div>
        <div className="detail-columns">
          <dl><dt>RSS URL</dt><dd>{feed.rss_url}</dd><dt>厂商</dt><dd>{feed.vendor}</dd><dt>产品名称</dt><dd>{feed.product}</dd><dt>数据库类型</dt><dd>{feed.db_type}</dd></dl>
          <dl><dt>状态</dt><dd><StatusPill status={feed.status} enabled={feed.enabled} /></dd><dt>最近抓取时间</dt><dd>{formatDateTime(feed.last_fetched_at)}</dd><dt>最近更新时间</dt><dd>{formatDateTime(feed.latest_item_published_at)}</dd><dt>官网链接</dt><dd>{feed.website_url ? <a href={feed.website_url} target="_blank" rel="noreferrer">打开官网 <ExternalLink size={14} /></a> : '-'}</dd></dl>
        </div>
      </section>
      <section className="panel">
        <div className="tabs"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>条目列表</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={16} />日历视图</button><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索标题或摘要" /></div>
        {view === 'list' ? <EntryTable entries={entries.items} /> : <CalendarGrid days={calendar} month={month} onMonthChange={setMonth} onDayClick={setDayItems} />}
      </section>
      {dayItems && <section className="panel day-drawer"><div className="panel-header"><h2>{dayItems.date} 动态</h2><button onClick={() => setDayItems(null)}>关闭</button></div><EntryTable entries={dayItems.items} compact /></section>}
    </>
  );
}
