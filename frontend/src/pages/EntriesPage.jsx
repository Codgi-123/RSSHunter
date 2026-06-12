import { CalendarDays, List, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import DateRangeFilter from '../components/DateRangeFilter';
import EntryTable from '../components/EntryTable';
import { PageTitle } from '../components/Layout';
import Modal from '../components/Modal';
import { formatDateTime, unique } from '../utils/format';

export default function EntriesPage({ feeds, groups, initialKeyword = '' }) {
  const [filters, setFilters] = useState({ keyword: initialKeyword, vendor: '', product: '', db_type: '', feed_id: '', group_id: '', start: '', end: '' });
  const [entries, setEntries] = useState({ total: 0, items: [] });
  const [calendar, setCalendar] = useState([]);
  const [view, setView] = useState('list');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [detail, setDetail] = useState(null);
  const [dayItems, setDayItems] = useState(null);

    setFilters((current) => (typeof key === 'object' ? { ...current, ...key } : { ...current, [key]: value }));

        <div className="filter-bar"><DateRangeFilter start={filters.start} end={filters.end} onChange={update} /><select value={filters.vendor} onChange={(event) => update('vendor', event.target.value)}><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.product} onChange={(event) => update('product', event.target.value)}><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.db_type} onChange={(event) => update('db_type', event.target.value)}><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.feed_id} onChange={(event) => update('feed_id', event.target.value)}><option value="">订阅源</option>{feeds.map((feed) => <option key={feed.id} value={feed.id}>{feed.name}</option>)}</select><select value={filters.group_id} onChange={(event) => update('group_id', event.target.value)}><option value="">订阅组</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
        {view === 'list' ? <><EntryTable entries={entries.items} onDetail={setDetail} /><Pagination total={entries.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></> : <div className="calendar-layout"><CalendarGrid days={calendar} month={month} onMonthChange={setMonth} onDayClick={setDayItems} />{dayItems && <DayEntriesPanel dayItems={dayItems} onClose={() => setDayItems(null)} onDetail={setDetail} />}</div>}
      setEntries(entryData); setCalendar(calendarData);
    }, 180);
    return () => clearTimeout(handle);
  }, [JSON.stringify(filters)]);

  const vendors = useMemo(() => unique(feeds, 'vendor'), [feeds]);
  const products = useMemo(() => unique(feeds, 'product'), [feeds]);
  const dbTypes = useMemo(() => unique(feeds, 'db_type'), [feeds]);
  const update = (key, value) => setFilters({ ...filters, [key]: value });

  return (
    <>
      <PageTitle title="全局动态" subtitle="查看平台内所有 RSS 条目，支持关键词、时间、厂商、产品、订阅源和订阅组筛选" />
      <section className="panel">
        <div className="tabs"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={16} />全部条目</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={16} />全局日历</button><label><input value={filters.keyword} onChange={(e) => update('keyword', e.target.value)} placeholder="搜索标题和摘要" /><Search size={16} /></label></div>
        <div className="filter-bar"><input type="date" value={filters.start} onChange={(e) => update('start', e.target.value)} /><input type="date" value={filters.end} onChange={(e) => update('end', e.target.value)} /><select value={filters.vendor} onChange={(e) => update('vendor', e.target.value)}><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.product} onChange={(e) => update('product', e.target.value)}><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.db_type} onChange={(e) => update('db_type', e.target.value)}><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.feed_id} onChange={(e) => update('feed_id', e.target.value)}><option value="">订阅源</option>{feeds.map((feed) => <option key={feed.id} value={feed.id}>{feed.name}</option>)}</select><select value={filters.group_id} onChange={(e) => update('group_id', e.target.value)}><option value="">订阅组</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
        {view === 'list' ? <><EntryTable entries={entries.items} onDetail={setDetail} /><p className="result-count">共 {entries.total} 条</p></> : <CalendarGrid days={calendar} month={month} onMonthChange={setMonth} onDayClick={setDayItems} />}
      </section>
      {detail && <Modal title="动态详情" onClose={() => setDetail(null)} footer={<button className="primary-button" onClick={() => setDetail(null)}>关闭</button>}><dl className="entry-detail"><dt>标题</dt><dd>{detail.title}</dd><dt>来源</dt><dd>{detail.feed_name} / {detail.vendor} / {detail.product}</dd><dt>发布时间</dt><dd>{formatDateTime(detail.published_at)}</dd><dt>摘要</dt><dd>{detail.summary || '-'}</dd><dt>原文链接</dt><dd>{detail.link ? <a href={detail.link} target="_blank" rel="noreferrer">{detail.link}</a> : '-'}</dd></dl></Modal>}
      {dayItems && <section className="panel day-drawer"><div className="panel-header"><h2>{dayItems.date} 动态</h2><button onClick={() => setDayItems(null)}>关闭</button></div><EntryTable entries={dayItems.items} compact onDetail={setDetail} /></section>}
    </>
  );
}
