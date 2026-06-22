import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CalendarGrid from '../components/CalendarGrid';
import DayEntriesPanel from '../components/DayEntriesPanel';
import DateRangeFilter from '../components/DateRangeFilter';
import EntryDetailModal from '../components/EntryDetailModal';
import EntryTimeline from '../components/EntryTimeline';
import { ClearableInput, ClearableSelect } from '../components/FilterControls';
import LoadingState from '../components/LoadingState';
import Pagination from '../components/Pagination';
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
  const { data: calendarMonths = [] } = useCalendar({ ...filters, month: month.slice(0, 4) }, view === 'calendar');
  const [detail, setDetail] = useState(null);
  const [dayItems, setDayItems] = useState(null);
  const [monthKey, setMonthKey] = useState(null);
  const { data: monthCal = [] } = useCalendar({ ...filters, month: monthKey || '' }, view === 'calendar' && !!monthKey);
  const monthDrawer = useMemo(() => (monthKey ? { date: `${monthKey} 全月`, items: monthCal.flatMap((d) => d.items || []) } : null), [monthKey, monthCal]);
  const drawer = dayItems || monthDrawer;
  const closeDrawer = () => { setDayItems(null); setMonthKey(null); };
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
    closeDrawer();
    patchParams(typeof key === 'object' ? { ...key, page: '' } : { [key]: value, page: '' });
  };
  const resetFilters = () => {
    closeDrawer();
    patchParams({ keyword: '', vendor: '', product: '', db_type: '', start: '', end: '', page: '' });
  };

  return (
    <>
      <div className="page-title">
        <div>
          <h1>全局动态</h1>
          <p>查看平台内所有 RSS 条目，支持关键词、日期、厂商、产品和数据库类型筛选</p>
        </div>
      </div>
      <div className="page-block">
        <div className="tab-bar">
          <button className={`tab-btn ${view === 'list' ? 'active' : ''}`} onClick={() => patchParams({ view: '' })}>全部条目</button>
          <button className={`tab-btn ${view === 'calendar' ? 'active' : ''}`} onClick={() => { closeDrawer(); patchParams({ view: 'calendar' }); }}>全局日历</button>
        </div>
        <div className="filter-bar entries-filter-bar"><ClearableInput className="filter-field tabs-search" value={filters.keyword} onChange={(value) => update('keyword', value)} placeholder="搜索标题和摘要" label="动态搜索" icon={<Search size={15} />} /><DateRangeFilter start={filters.start} end={filters.end} onChange={update} /><ClearableSelect value={filters.vendor} onChange={(value) => update('vendor', value)} label="厂商"><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><ClearableSelect value={filters.product} onChange={(value) => update('product', value)} label="产品"><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><ClearableSelect value={filters.db_type} onChange={(value) => update('db_type', value)} label="数据库类型"><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</ClearableSelect><button type="button" onClick={resetFilters}>重置筛选</button></div>
        {error && <div className="form-error">{error}</div>}
        {view === 'list' ? <>{loading ? <LoadingState title="正在加载动态..." rows={3} compact /> : <EntryTimeline entries={entries.items} onDetail={setDetail} />}<Pagination total={entries.total} page={page} pageSize={pageSize} onPageChange={(next) => patchParams({ page: next === 1 ? '' : next })} onPageSizeChange={(size) => patchParams({ pageSize: size, page: '' })} /></> : <div className={`calendar-layout ${drawer ? 'has-drawer' : ''}`}>{<div>{calendarLoading && <div className="inline-loading" role="status" aria-live="polite">正在加载日历...</div>}<CalendarGrid days={calendar} monthlyDays={calendarMonths} month={month} onMonthChange={(value) => { closeDrawer(); patchParams({ month: value }); }} onDayClick={(d) => { setMonthKey(null); setDayItems(d); }} onMonthClick={(m) => { setDayItems(null); setMonthKey(m); }} /></div>}{drawer && <DayEntriesPanel dayItems={drawer} onClose={closeDrawer} onDetail={setDetail} />}</div>}
      </div>
      <EntryDetailModal entry={detail} onClose={() => setDetail(null)} />
    </>
  );
}
