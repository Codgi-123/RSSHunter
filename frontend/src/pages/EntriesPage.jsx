import { CalendarDays, List, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CalendarGrid from '../components/CalendarGrid';
import DateRangeFilter from '../components/DateRangeFilter';
import EntryDetailModal from '../components/EntryDetailModal';
import EntryTable from '../components/EntryTable';
import { ClearableInput, ClearableSelect } from '../components/FilterControls';
import { PageTitle } from '../components/Layout';
import LoadingState from '../components/LoadingState';
import Pagination, { getPageItems } from '../components/Pagination';
import { useCalendar, useEntries, useFeeds } from '../queries';
import { unique } from '../utils/format';

export default function EntriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = {
    keyword: searchParams.get('keyword') || '',
    vendor: searchParams.get('vendor') || '',
    product: searchParams.get('product') || '',
    db_type: searchParams.get('db_type') || '',
    start: searchParams.get('start') || '',
    end: searchParams.get('end') || '',
  };
  const view = searchParams.get('view') || 'list';
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 10;

  const { data: feeds = [] } = useFeeds();
  const { data: entries = { total: 0, items: [] }, isLoading: loading, error: listError } = useEntries({ ...filters, limit: pageSize, offset: (page - 1) * pageSize });
  const { data: calendar = [], isLoading: calendarLoading, error: calendarError } = useCalendar({ ...filters, month }, view === 'calendar');
  const [detail, setDetail] = useState(null);
  const [dayItems, setDayItems] = useState(null);
  const error = (listError || calendarError)?.message || '';

  function patchParams(patch) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value == null) next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    }, { replace: true });
  }

  const vendors = useMemo(() => unique(feeds, 'vendor'), [feeds]);
  const products = useMemo(() => unique(feeds, 'product'), [feeds]);
  const dbTypes = useMemo(() => unique(feeds, 'db_type'), [feeds]);
  const update = (key, value) => {
    setDayItems(null);
    patchParams(typeof key === 'object' ? { ...key, page: '' } : { [key]: value, page: '' });
  };
  const resetFilters = () => {
    setDayItems(null);
    patchParams({ keyword: '', vendor: '', product: '', db_type: '', start: '', end: '', page: '' });
  };

  return (
    <>
      <PageTitle title="全局动态" subtitle="查看平台内所有 RSS 条目，支持关键词、日期、厂商、产品和数据库类型筛选" />
      <section className="panel filterable-panel">
        <div className="tabs"><button className={view === 'list' ? 'active' : ''} onClick={() => patchParams({ view: '' })}><List size={16} />全部条目</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => { setDayItems(null); patchParams({ view: 'calendar' }); }}><CalendarDays size={16} />全局日历</button><ClearableInput className="tabs-search" value={filters.keyword} onChange={(value) => update('keyword', value)} placeholder="搜索标题和摘要" label="动态搜索" icon={<Search size={16} />} /></div>
        <div className="filter-bar entries-filter-bar"><DateRangeFilter start={filters.start} end={filters.end} onChange={update} /><ClearableSelect value={filters.vendor} onChange={(value) => update('vendor', value)} label="厂商"><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><ClearableSelect value={filters.product} onChange={(value) => update('product', value)} label="产品"><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><ClearableSelect value={filters.db_type} onChange={(value) => update('db_type', value)} label="数据库类型"><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><button type="button" onClick={resetFilters}>重置筛选</button></div>
        {error && <div className="form-error">{error}</div>}
        {view === 'list' ? <>{loading ? <LoadingState title="正在加载动态..." rows={3} compact /> : <EntryTable entries={entries.items} onDetail={setDetail} />}<Pagination total={entries.total} page={page} pageSize={pageSize} onPageChange={(next) => patchParams({ page: next === 1 ? '' : next })} onPageSizeChange={(size) => patchParams({ pageSize: size, page: '' })} /></> : <div className="calendar-layout"><div>{calendarLoading && <div className="inline-loading" role="status" aria-live="polite">正在加载日历...</div>}<CalendarGrid days={calendar} month={month} onMonthChange={(value) => { setDayItems(null); patchParams({ month: value }); }} onDayClick={setDayItems} /></div>{dayItems && <DayEntriesPanel dayItems={dayItems} onClose={() => setDayItems(null)} onDetail={setDetail} />}</div>}
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
