import { ArrowLeft, CalendarDays, Database, Grid2X2, List, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import CopyButton from '../components/CopyButton';
import DateRangeFilter from '../components/DateRangeFilter';
import EntryDetailModal from '../components/EntryDetailModal';
import EntryTable from '../components/EntryTable';
import { ClearableInput, ClearableSelect } from '../components/FilterControls';
import { PageTitle } from '../components/Layout';
import LoadingState from '../components/LoadingState';
import Pagination, { getPageItems } from '../components/Pagination';
import StatusPill from '../components/StatusPill';
import SummaryContent from '../components/SummaryContent';
import TagList from '../components/TagList';
import { formatDateTime, unique } from '../utils/format';
import { viewLabel } from '../utils/view';

export default function GroupDetailPage({ groupId, setPage }) {
  const [group, setGroup] = useState(null);
  const [entries, setEntries] = useState({ total: 0, items: [] });
  const [bySource, setBySource] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [view, setView] = useState('aggregate');
  const [filters, setFilters] = useState({ keyword: '', vendor: '', product: '', start: '', end: '' });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [detail, setDetail] = useState(null);
  const [dayItems, setDayItems] = useState(null);
  const [page, setLocalPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [todayCount, setTodayCount] = useState(null);
  const [weekCount, setWeekCount] = useState(null);

  async function loadGroup() {
    if (!groupId) return;
    setGroup(await api.get(`/groups/${groupId}`));
  }

  async function loadEntries() {
    if (!groupId) return;
    const params = { ...filters, limit: pageSize, offset: (page - 1) * pageSize };
    setEntries(await api.get(`/groups/${groupId}/entries`, params));
  }

  async function loadSource() {
    if (!groupId || view !== 'source') return;
    setBySource(await api.get(`/groups/${groupId}/entries-by-source`, filters));
  }

  async function loadCalendar() {
    if (!groupId || view !== 'calendar') return;
    setCalendar(await api.get(`/groups/${groupId}/calendar`, { ...filters, month }));
  }

  async function reloadAll() {
    setRefreshing(true);
    setError('');
    try {
      await Promise.all([loadGroup(), loadEntries(), loadSource(), loadCalendar()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (!groupId) {
      setGroup(null);
      setLoading(false);
      return () => { active = false; };
    }
    api.get(`/groups/${groupId}`, undefined, { cache: false }).then((data) => { if (active) setGroup(data); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [groupId]);
  useEffect(() => {
    if (!groupId) return undefined;
    let active = true;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    Promise.all([
      api.get(`/groups/${groupId}/entries`, { start: today, end: today, limit: 1 }, { cache: false }),
      api.get(`/groups/${groupId}/entries`, { start: weekAgo, end: today, limit: 1 }, { cache: false }),
    ]).then(([td, wk]) => { if (active) { setTodayCount(td.total); setWeekCount(wk.total); } }).catch(() => {});
    return () => { active = false; };
  }, [groupId]);
  useEffect(() => {
    if (!groupId) return undefined;
    let active = true;
    const params = { ...filters, limit: pageSize, offset: (page - 1) * pageSize };
    api.get(`/groups/${groupId}/entries`, params, { cache: false }).then((data) => { if (active) setEntries(data); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [groupId, filters.keyword, filters.vendor, filters.product, filters.start, filters.end, page, pageSize]);
  useEffect(() => {
    if (!groupId || view !== 'source') return undefined;
    let active = true;
    api.get(`/groups/${groupId}/entries-by-source`, filters, { cache: false }).then((data) => { if (active) setBySource(data); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [groupId, filters.keyword, filters.vendor, filters.product, filters.start, filters.end, view]);
  useEffect(() => {
    if (!groupId || view !== 'calendar') return undefined;
    let active = true;
    api.get(`/groups/${groupId}/calendar`, { ...filters, month }, { cache: false }).then((data) => { if (active) setCalendar(data); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [groupId, filters.keyword, filters.vendor, filters.product, filters.start, filters.end, view, month]);

  const vendors = useMemo(() => unique(group?.feeds || [], 'vendor'), [group]);
  const products = useMemo(() => unique(group?.feeds || [], 'product'), [group]);
  const sourceGroups = bySource.filter((source) => source.entries.length);
  const updateFilter = (key, value) => {
    setLocalPage(1);
    setDayItems(null);
    setFilters((current) => (typeof key === 'object' ? { ...current, ...key } : { ...current, [key]: value }));
  };
  const resetFilters = () => {
    setLocalPage(1);
    setDayItems(null);
    setFilters({ keyword: '', vendor: '', product: '', start: '', end: '' });
  };

  if (loading) return <><PageTitle title="订阅组详情" subtitle="正在加载订阅组信息..." /><LoadingState title="正在加载订阅组..." rows={4} /></>;
  if (!group) return <><PageTitle title="订阅组详情" subtitle="无法加载订阅组信息" actions={<button onClick={reloadAll}><Database size={17} />重试</button>} />{error && <div className="form-error">{error}</div>}</>;
  return (
    <>
      <PageTitle title="订阅组详情" subtitle="查看订阅组内聚合动态，支持聚合列表、按源分组与日历切换" actions={<><button onClick={() => setPage('groups')}><ArrowLeft size={18} />返回列表</button><button onClick={reloadAll} disabled={refreshing}>{refreshing ? '刷新中' : '刷新'}</button></>} />
      {error && <div className="form-error">{error}</div>}
      <section className="detail-hero group-hero">
        <div className="hero-title"><div className="big-icon"><Users size={36} /></div><div><h2>{group.name}</h2><p>{group.description}</p></div></div>
        <div className="group-stat-rail"><article><List /><span>今日新增</span><b>{todayCount ?? '-'}</b></article><article><CalendarDays /><span>最近7天新增</span><b>{weekCount ?? '-'}</b></article><article><Grid2X2 /><span>订阅源数量</span><b>{group.feeds.length}</b></article></div>
        <div className="detail-columns"><dl><dt>订阅组 ID</dt><dd className="copy-line"><span>{group.id}</span><CopyButton text={String(group.id)} label="复制 ID" /></dd><dt>包含订阅数</dt><dd>{group.feeds.length}</dd><dt>默认视图</dt><dd>{viewLabel(group.default_view)}</dd><dt>当前状态</dt><dd><StatusPill status="normal" enabled={group.enabled} /></dd></dl><dl><dt>关联标签</dt><dd><TagList tags={group.tags} /></dd><dt>来源厂商</dt><dd>{vendors.join('、') || '-'}</dd><dt>最近更新时间</dt><dd>{formatDateTime(entries.items[0]?.published_at)}</dd></dl></div>
      </section>
      <section className="panel filterable-panel">
        <div className="tabs"><button className={view === 'aggregate' ? 'active' : ''} onClick={() => setView('aggregate')}><List size={16} />聚合列表</button><button className={view === 'source' ? 'active' : ''} onClick={() => setView('source')}>按源分组</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>日历视图</button><ClearableInput className="tabs-search" value={filters.keyword} onChange={(value) => updateFilter('keyword', value)} placeholder="搜索标题、摘要或来源订阅源" label="订阅组动态搜索" icon={<Search size={16} />} /></div>
        <div className="filter-bar group-detail-filter-bar"><DateRangeFilter start={filters.start} end={filters.end} onChange={updateFilter} /><ClearableSelect value={filters.vendor} onChange={(value) => updateFilter('vendor', value)} label="厂商"><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><ClearableSelect value={filters.product} onChange={(value) => updateFilter('product', value)} label="产品"><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><button type="button" onClick={resetFilters}>重置筛选</button></div>
        {view === 'aggregate' && <><EntryTable entries={entries.items} onDetail={setDetail} /><Pagination total={entries.total} page={page} pageSize={pageSize} onPageChange={setLocalPage} onPageSizeChange={(size) => { setPageSize(size); setLocalPage(1); }} /></>}
        {view === 'source' && <SourceGroupedList groups={sourceGroups} />}
        {view === 'calendar' && <div className="calendar-layout"><CalendarGrid days={calendar} month={month} onMonthChange={(value) => { setDayItems(null); setMonth(value); }} onDayClick={setDayItems} />{dayItems && <DayEntriesPanel dayItems={dayItems} onClose={() => setDayItems(null)} onDetail={setDetail} />}</div>}
      </section>
      <EntryDetailModal entry={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function SourceGroupedList({ groups }) {
  return <div className="source-group-list">{groups.map((group) => <article key={group.feed_id} className="source-group"><header><div><h3>{group.feed_name}</h3><p>{group.vendor} / {group.product}</p></div><b>{group.entries.length} 条</b><span>最近更新：{formatDateTime(group.entries[0]?.published_at)}</span></header><ul>{group.entries.map((entry) => <li key={entry.id}><time>{formatDateTime(entry.published_at).slice(0, 10)}</time><a href={entry.link} target="_blank" rel="noreferrer">{entry.title}</a><small><SummaryContent value={entry.summary} compact /></small></li>)}</ul></article>)}{!groups.length && <p className="empty-cell">暂无匹配的分组动态</p>}</div>;
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
