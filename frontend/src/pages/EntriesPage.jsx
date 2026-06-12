import { CalendarDays, List, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import EntryTable from '../components/EntryTable';
import { PageTitle } from '../components/Layout';
import Modal from '../components/Modal';
import Pagination, { getPageItems } from '../components/Pagination';
import { formatDateTime, unique } from '../utils/format';

export default function EntriesPage({ feeds, groups, initialKeyword = '' }) {
  const [filters, setFilters] = useState({ keyword: initialKeyword, vendor: '', product: '', db_type: '', feed_id: '', group_id: '', start: '', end: '' });
  const [entries, setEntries] = useState({ total: 0, items: [] });
  const [calendar, setCalendar] = useState([]);
  const [view, setView] = useState('list');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [detail, setDetail] = useState(null);
  const [dayItems, setDayItems] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (initialKeyword && initialKeyword !== filters.keyword) {
      setPage(1);
      setFilters((current) => ({ ...current, keyword: initialKeyword }));
    }
  }, [initialKeyword]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const params = { ...filters, limit: pageSize, offset: (page - 1) * pageSize };
      const [entryData, calendarData] = await Promise.all([api.get('/entries', params), api.get('/calendar', filters)]);
      setEntries(entryData);
      setCalendar(calendarData);
    }, 180);
    return () => clearTimeout(handle);
  }, [JSON.stringify(filters), page, pageSize]);

  const vendors = useMemo(() => unique(feeds, 'vendor'), [feeds]);
  const products = useMemo(() => unique(feeds, 'product'), [feeds]);
  const dbTypes = useMemo(() => unique(feeds, 'db_type'), [feeds]);
  const update = (key, value) => {
    setPage(1);
    setFilters({ ...filters, [key]: value });
  };

  return (
    <>
      <PageTitle title="全局动态" subtitle="查看平台内所有 RSS 条目，支持关键词、时间、厂商、产品、订阅源和订阅组筛选" />
      <section className="panel">
        <div className="tabs"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={16} />全部条目</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={16} />全局日历</button><label><input value={filters.keyword} onChange={(event) => update('keyword', event.target.value)} placeholder="搜索标题和摘要" /><Search size={16} /></label></div>
        <div className="filter-bar"><input type="date" value={filters.start} onChange={(event) => update('start', event.target.value)} /><input type="date" value={filters.end} onChange={(event) => update('end', event.target.value)} /><select value={filters.vendor} onChange={(event) => update('vendor', event.target.value)}><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.product} onChange={(event) => update('product', event.target.value)}><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.db_type} onChange={(event) => update('db_type', event.target.value)}><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.feed_id} onChange={(event) => update('feed_id', event.target.value)}><option value="">订阅源</option>{feeds.map((feed) => <option key={feed.id} value={feed.id}>{feed.name}</option>)}</select><select value={filters.group_id} onChange={(event) => update('group_id', event.target.value)}><option value="">订阅组</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
        {view === 'list' ? <><EntryTable entries={entries.items} onDetail={setDetail} /><Pagination total={entries.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></> : <CalendarGrid days={calendar} month={month} onMonthChange={setMonth} onDayClick={setDayItems} />}
      </section>
      {detail && <Modal title="动态详情" onClose={() => setDetail(null)} footer={<button className="primary-button" onClick={() => setDetail(null)}>关闭</button>}><dl className="entry-detail"><dt>标题</dt><dd>{detail.title}</dd><dt>来源</dt><dd>{detail.feed_name} / {detail.vendor} / {detail.product}</dd><dt>发布时间</dt><dd>{formatDateTime(detail.published_at)}</dd><dt>摘要</dt><dd>{detail.summary || '-'}</dd><dt>原文链接</dt><dd>{detail.link ? <a href={detail.link} target="_blank" rel="noreferrer">{detail.link}</a> : '-'}</dd></dl></Modal>}
      {dayItems && <DayEntriesPanel dayItems={dayItems} onClose={() => setDayItems(null)} onDetail={setDetail} />}
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
