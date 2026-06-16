import { CalendarDays, List, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import DateRangeFilter from '../components/DateRangeFilter';
import EntryDetailModal from '../components/EntryDetailModal';
import EntryTable from '../components/EntryTable';
import { ClearableInput, ClearableSelect } from '../components/FilterControls';
import { PageTitle } from '../components/Layout';
import LoadingState from '../components/LoadingState';
import Pagination, { getPageItems } from '../components/Pagination';
import { unique } from '../utils/format';

export default function EntriesPage({ feeds, initialKeyword = '' }) {
  const [filters, setFilters] = useState({ keyword: initialKeyword, vendor: '', product: '', db_type: '', start: '', end: '' });
  const [entries, setEntries] = useState({ total: 0, items: [] });
  const [calendar, setCalendar] = useState([]);
  const [view, setView] = useState('list');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [detail, setDetail] = useState(null);
  const [dayItems, setDayItems] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialKeyword !== filters.keyword) {
      setPage(1);
      setFilters((current) => ({ ...current, keyword: initialKeyword }));
    }
  }, [initialKeyword]);

  useEffect(() => {
    let active = true;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = { ...filters, limit: pageSize, offset: (page - 1) * pageSize };
      try {
        const data = await api.get('/entries', params);
        if (active) setEntries(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => { active = false; clearTimeout(handle); };
  }, [JSON.stringify(filters), page, pageSize]);

  useEffect(() => {
    if (view !== 'calendar') return undefined;
    let active = true;
    const handle = setTimeout(async () => {
      setCalendarLoading(true);
      setError('');
      try {
        const data = await api.get('/calendar', { ...filters, month });
        if (active) setCalendar(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setCalendarLoading(false);
      }
    }, 180);
    return () => { active = false; clearTimeout(handle); };
  }, [JSON.stringify(filters), view, month]);

  const vendors = useMemo(() => unique(feeds, 'vendor'), [feeds]);
  const products = useMemo(() => unique(feeds, 'product'), [feeds]);
  const dbTypes = useMemo(() => unique(feeds, 'db_type'), [feeds]);
  const update = (key, value) => {
    setPage(1);
    setDayItems(null);
    setFilters((current) => (typeof key === 'object' ? { ...current, ...key } : { ...current, [key]: value }));
  };
  const resetFilters = () => {
    setPage(1);
    setDayItems(null);
    setFilters({ keyword: '', vendor: '', product: '', db_type: '', start: '', end: '' });
  };

  return (
    <>
      <PageTitle title="全局动态" subtitle="查看平台内所有 RSS 条目，支持关键词、日期、厂商、产品和数据库类型筛选" />
      <section className="panel filterable-panel">
        <div className="tabs"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={16} />全部条目</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => { setDayItems(null); setView('calendar'); }}><CalendarDays size={16} />全局日历</button><ClearableInput className="tabs-search" value={filters.keyword} onChange={(value) => update('keyword', value)} placeholder="搜索标题和摘要" label="动态搜索" icon={<Search size={16} />} /></div>
        <div className="filter-bar entries-filter-bar"><DateRangeFilter start={filters.start} end={filters.end} onChange={update} /><ClearableSelect value={filters.vendor} onChange={(value) => update('vendor', value)} label="厂商"><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><ClearableSelect value={filters.product} onChange={(value) => update('product', value)} label="产品"><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><ClearableSelect value={filters.db_type} onChange={(value) => update('db_type', value)} label="数据库类型"><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><button type="button" onClick={resetFilters}>重置筛选</button></div>
        {error && <div className="form-error">{error}</div>}
        {view === 'list' ? <>{loading ? <LoadingState title="正在加载动态..." rows={3} compact /> : <EntryTable entries={entries.items} onDetail={setDetail} />}<Pagination total={entries.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></> : <div className="calendar-layout"><div>{calendarLoading && <div className="inline-loading" role="status" aria-live="polite">正在加载日历...</div>}<CalendarGrid days={calendar} month={month} onMonthChange={(value) => { setDayItems(null); setMonth(value); }} onDayClick={setDayItems} /></div>{dayItems && <DayEntriesPanel dayItems={dayItems} onClose={() => setDayItems(null)} onDetail={setDetail} />}</div>}
      </section>
      <EntryDetailModal entry={detail} onClose={() => setDetail(null)} />
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
