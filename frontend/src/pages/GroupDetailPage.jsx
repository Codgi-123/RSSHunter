import { ArrowLeft, CalendarDays, Database, Edit3, Grid2X2, List, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import EntryTable from '../components/EntryTable';
import { PageTitle } from '../components/Layout';
import StatusPill from '../components/StatusPill';
import { formatDateTime, unique } from '../utils/format';

export default function GroupDetailPage({ groupId, setPage }) {
  const [group, setGroup] = useState(null);
  const [entries, setEntries] = useState({ total: 0, items: [] });
  const [bySource, setBySource] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [view, setView] = useState('aggregate');
  const [filters, setFilters] = useState({ keyword: '', vendor: '', product: '' });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dayItems, setDayItems] = useState(null);

  async function load() {
    if (!groupId) return;
    const [groupData, entryData, sourceData, calendarData] = await Promise.all([
      api.get(`/groups/${groupId}`),
      api.get(`/groups/${groupId}/entries`, filters),
      api.get(`/groups/${groupId}/entries-by-source`),
      api.get(`/groups/${groupId}/calendar`),
    ]);
    setGroup(groupData); setEntries(entryData); setBySource(sourceData); setCalendar(calendarData);
  }
  useEffect(() => { load(); }, [groupId, filters.keyword, filters.vendor, filters.product]);

  const vendors = useMemo(() => unique(group?.feeds || [], 'vendor'), [group]);
  const products = useMemo(() => unique(group?.feeds || [], 'product'), [group]);
  const sourceGroups = bySource.map((source) => ({ ...source, entries: source.entries.filter((entry) => (!filters.keyword || `${entry.title}${entry.summary}`.includes(filters.keyword)) && (!filters.vendor || entry.vendor === filters.vendor) && (!filters.product || entry.product === filters.product)) })).filter((source) => source.entries.length);

  if (!group) return <PageTitle title="订阅组详情" subtitle="正在加载订阅组信息..." />;
  return (
    <>
      <PageTitle title="订阅组详情" subtitle="查看订阅组内聚合动态，支持聚合列表、按源分组与日历切换" actions={<><button onClick={() => setPage('groups')}><ArrowLeft size={18} />返回列表</button><button><Edit3 size={17} />编辑订阅组</button><button className="primary-button"><Database size={18} />管理订阅源</button></>} />
      <section className="detail-hero group-hero">
        <div className="hero-title"><div className="big-icon"><Users size={36} /></div><div><h2>{group.name}</h2><p>{group.description}</p></div></div>
        <div className="group-stat-rail"><article><List /><span>今日新增</span><b>{entries.items.filter((item) => item.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length}</b></article><article><CalendarDays /><span>最近7天新增</span><b>{entries.total}</b></article><article><Grid2X2 /><span>订阅源数量</span><b>{group.feeds.length}</b></article></div>
        <div className="detail-columns"><dl><dt>包含订阅数</dt><dd>{group.feeds.length}</dd><dt>默认视图</dt><dd>{group.default_view}</dd><dt>当前状态</dt><dd><StatusPill status="normal" enabled={group.enabled} /></dd></dl><dl><dt>关联标签</dt><dd>{group.tags?.join('、') || '-'}</dd><dt>来源厂商</dt><dd>{vendors.join('、') || '-'}</dd><dt>最近更新时间</dt><dd>{formatDateTime(entries.items[0]?.published_at)}</dd></dl></div>
      </section>
      <section className="panel">
        <div className="tabs"><button className={view === 'aggregate' ? 'active' : ''} onClick={() => setView('aggregate')}><List size={16} />聚合列表</button><button className={view === 'source' ? 'active' : ''} onClick={() => setView('source')}>按源分组</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>日历视图</button><label><input value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} placeholder="搜索标题、摘要或来源订阅源" /><Search size={16} /></label><select value={filters.vendor} onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })}><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</select></div>
        {view === 'aggregate' && <EntryTable entries={entries.items} />}
        {view === 'source' && <SourceGroupedList groups={sourceGroups} />}
        {view === 'calendar' && <CalendarGrid days={calendar} month={month} onMonthChange={setMonth} onDayClick={setDayItems} />}
      </section>
      {dayItems && <section className="panel day-drawer"><div className="panel-header"><h2>{dayItems.date} 动态</h2><button onClick={() => setDayItems(null)}>关闭</button></div><EntryTable entries={dayItems.items} compact /></section>}
    </>
  );
}

function SourceGroupedList({ groups }) {
  return <div className="source-group-list">{groups.map((group) => <article key={group.feed_id} className="source-group"><header><div><h3>{group.feed_name}</h3><p>{group.vendor} / {group.product}</p></div><b>{group.entries.length} 条</b><span>最近更新：{formatDateTime(group.entries[0]?.published_at)}</span></header><ul>{group.entries.map((entry) => <li key={entry.id}><time>{formatDateTime(entry.published_at).slice(0, 10)}</time><a href={entry.link} target="_blank" rel="noreferrer">{entry.title}</a><small>{entry.summary}</small></li>)}</ul></article>)}{!groups.length && <p className="empty-cell">暂无匹配的分组动态</p>}</div>;
}
