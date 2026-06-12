import { CalendarDays, Edit3, Eye, Plus, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api';
import ActionDialog from '../components/ActionDialog';
import { PageTitle } from '../components/Layout';
import Modal from '../components/Modal';
import Pagination, { getPageItems } from '../components/Pagination';
import StatusPill from '../components/StatusPill';
import TagInput from '../components/TagInput';
import TagList from '../components/TagList';
import { formatDateTime, splitTags, unique } from '../utils/format';

const emptyGroup = { name: '', description: '', tags: [], default_view: 'aggregate', enabled: true, feed_ids: [] };

function newGroupForm() {
  return { ...emptyGroup, tags: [], feed_ids: [] };
}

export default function GroupsPage({ groups, feeds, reloadGroups, setPage, setSelectedGroup }) {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(undefined);
  const [form, setForm] = useState(newGroupForm());
  const [page, setLocalPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const visibleGroups = useMemo(() => groups.filter((group) => (!keyword || `${group.name}${group.description}`.includes(keyword)) && (!status || Boolean(group.enabled) === (status === 'enabled'))), [groups, keyword, status]);
  const pagedGroups = useMemo(() => getPageItems(visibleGroups, page, pageSize), [visibleGroups, page, pageSize]);

  function openCreate() {
    setEditing(null);
    setForm(newGroupForm());
  }

  function openEdit(group) {
    setEditing(group);
    setForm({ ...group, tags: splitTags(group.tags), feed_ids: (group.feeds || []).map((feed) => feed.id) });
  }

  async function hydrateAndEdit(group) { openEdit(await api.get(`/groups/${group.id}`)); }

  async function submitGroup() {
    const payload = { ...form, tags: splitTags(form.tags), enabled: Boolean(form.enabled), feed_ids: form.feed_ids.map(Number) };
    if (editing) await api.put(`/groups/${editing.id}`, payload);
    else await api.post('/groups', payload);
    setEditing(undefined);
    await reloadGroups();
  }

  async function deleteGroup(group) {
    if (!confirm(`确认删除订阅组「${group.name}」？`)) return;
    await api.delete(`/groups/${group.id}`);
    await reloadGroups();
  }

  function openGroup(group) {
    setSelectedGroup(group.id);
    setPage('group-detail');
  }

  function updateKeyword(value) {
    setLocalPage(1);
    setKeyword(value);
  }

  function updateStatus(value) {
    setLocalPage(1);
    setStatus(value);
  }

  return (
    <>
      <PageTitle title="订阅组管理" subtitle="将多个 RSS 源组合成主题集合，支持聚合、按源分组和日历视图" />
      <section className="toolbar-panel compact-toolbar"><button className="primary-button" onClick={openCreate}><Plus size={18} />新增订阅组</button><label className="filter-search"><input value={keyword} onChange={(event) => updateKeyword(event.target.value)} placeholder="搜索订阅组名称或描述" /><Search size={18} /></label><select value={status} onChange={(event) => updateStatus(event.target.value)}><option value="">状态</option><option value="enabled">启用</option><option value="disabled">停用</option></select></section>
      <section className="group-card-grid">
        {pagedGroups.map((group, index) => (
          <article className="group-card" key={group.id}>
            <div className={`symbol-card color-${index % 5}`}><Users size={24} /></div>
            <button className="card-title-link" onClick={() => openGroup(group)}>{group.name}</button>
            <p>{group.description || '暂无描述'}</p>
            <TagList tags={group.tags} />
            <div className="group-meta"><span>包含订阅数</span><b>{group.feed_count || 0}</b></div>
            <div className="group-meta"><span>今日新增</span><b>{group.today_new || 0}</b></div>
            <div className="group-meta"><span>最近更新时间</span><b>{formatDateTime(group.latest_update)}</b></div>
            <StatusPill status="normal" enabled={group.enabled} />
            <div className="card-actions">
              <ActionDialog
                title={group.name}
                actions={[
                  { label: '查看详情', icon: <Eye size={16} />, onClick: () => openGroup(group) },
                  { label: '编辑订阅组', icon: <Edit3 size={16} />, onClick: () => hydrateAndEdit(group) },
                  { label: '删除订阅组', icon: <Trash2 size={16} />, danger: true, onClick: () => deleteGroup(group) },
                ]}
              />
            </div>
          </article>
        ))}
      </section>
      <Pagination total={visibleGroups.length} page={page} pageSize={pageSize} onPageChange={setLocalPage} onPageSizeChange={(size) => { setPageSize(size); setLocalPage(1); }} />
      {visibleGroups.length > 0 && <section className="panel timeline-preview"><div className="panel-header"><h2>推荐查看路径</h2><CalendarDays size={22} /></div><ol><li>先在订阅组列表选择主题集合。</li><li>进入订阅组详情后在聚合列表、按源分组、日历视图之间切换。</li><li>筛选厂商、产品或关键词后可直接打开原文公告。</li></ol></section>}
      {editing !== undefined && <GroupModal form={form} setForm={setForm} feeds={feeds} title={editing ? '编辑订阅组' : '新增订阅组'} onClose={() => setEditing(undefined)} onSubmit={submitGroup} />}
    </>
  );
}

function GroupModal({ title, form, setForm, feeds, onClose, onSubmit }) {
  const [feedFilters, setFeedFilters] = useState({ keyword: '', vendor: '', product: '', db_type: '', tag: '', status: '', selected: '' });
  const feedTags = useMemo(() => [...new Set(feeds.flatMap((feed) => splitTags(feed.tags)))].filter(Boolean), [feeds]);
  const vendors = useMemo(() => unique(feeds, 'vendor'), [feeds]);
  const products = useMemo(() => unique(feeds, 'product'), [feeds]);
  const dbTypes = useMemo(() => unique(feeds, 'db_type'), [feeds]);
  const visibleFeeds = useMemo(() => feeds.filter((feed) => {
    const tags = splitTags(feed.tags);
    const selected = form.feed_ids.includes(feed.id);
    const keyword = feedFilters.keyword.trim().toLowerCase();
    const text = `${feed.name} ${feed.vendor} ${feed.product} ${feed.db_type} ${feed.rss_url} ${tags.join(' ')}`.toLowerCase();
    return (!keyword || text.includes(keyword))
      && (!feedFilters.vendor || feed.vendor === feedFilters.vendor)
      && (!feedFilters.product || feed.product === feedFilters.product)
      && (!feedFilters.db_type || feed.db_type === feedFilters.db_type)
      && (!feedFilters.tag || tags.includes(feedFilters.tag))
      && (!feedFilters.status || feed.status === feedFilters.status)
      && (!feedFilters.selected || (feedFilters.selected === 'selected' ? selected : !selected));
  }), [feeds, feedFilters, form.feed_ids]);

  function updateFeedFilter(key, value) {
    setFeedFilters({ ...feedFilters, [key]: value });
  }

  const toggleFeed = (id) => setForm({ ...form, feed_ids: form.feed_ids.includes(id) ? form.feed_ids.filter((item) => item !== id) : [...form.feed_ids, id] });
  const selectVisibleFeeds = () => setForm({ ...form, feed_ids: [...new Set([...form.feed_ids, ...visibleFeeds.map((feed) => feed.id)])] });
  const removeVisibleFeeds = () => setForm({ ...form, feed_ids: form.feed_ids.filter((id) => !visibleFeeds.some((feed) => feed.id === id)) });
  const resetFeedFilters = () => setFeedFilters({ keyword: '', vendor: '', product: '', db_type: '', tag: '', status: '', selected: '' });

  return (
    <Modal title={title} onClose={onClose} footer={<><button onClick={onClose}>取消</button><button className="primary-button" onClick={onSubmit} disabled={!form.name || form.feed_ids.length === 0}>保存</button></>}>
      <div className="form-grid">
        <label>订阅组名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>默认视图<select value={form.default_view} onChange={(event) => setForm({ ...form, default_view: event.target.value })}><option value="aggregate">聚合列表</option><option value="source">按源分组</option><option value="calendar">日历视图</option></select></label>
        <label className="span-2">标签<TagInput value={form.tags} onChange={(tags) => setForm({ ...form, tags })} /></label>
        <label className="switch-line"><input type="checkbox" checked={Boolean(form.enabled)} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />启用订阅组</label>
        <label className="span-2">描述<textarea value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <div className="feed-picker span-2">
          <div className="feed-picker-head"><b>包含订阅</b><span>已选 {form.feed_ids.length} / 匹配 {visibleFeeds.length}</span></div>
          <div className="feed-picker-toolbar">
            <label className="feed-picker-search"><input value={feedFilters.keyword} onChange={(event) => updateFeedFilter('keyword', event.target.value)} placeholder="搜索名称、厂商、产品或 URL" /><Search size={16} /></label>
            <select value={feedFilters.vendor} onChange={(event) => updateFeedFilter('vendor', event.target.value)}><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={feedFilters.product} onChange={(event) => updateFeedFilter('product', event.target.value)}><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={feedFilters.db_type} onChange={(event) => updateFeedFilter('db_type', event.target.value)}><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={feedFilters.tag} onChange={(event) => updateFeedFilter('tag', event.target.value)}><option value="">标签</option>{feedTags.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={feedFilters.status} onChange={(event) => updateFeedFilter('status', event.target.value)}><option value="">状态</option><option value="normal">正常</option><option value="fetch_failed">抓取失败</option><option value="parse_error">解析异常</option><option value="disabled">已停用</option></select>
            <select value={feedFilters.selected} onChange={(event) => updateFeedFilter('selected', event.target.value)}><option value="">全部</option><option value="selected">已选</option><option value="unselected">未选</option></select>
          </div>
          <div className="feed-picker-actions">
            <button type="button" onClick={selectVisibleFeeds} disabled={!visibleFeeds.length}>选择匹配</button>
            <button type="button" onClick={removeVisibleFeeds} disabled={!visibleFeeds.some((feed) => form.feed_ids.includes(feed.id))}>移除匹配</button>
            <button type="button" onClick={resetFeedFilters}>重置筛选</button>
          </div>
          <div className="feed-picker-list">
            {visibleFeeds.map((feed) => (
              <label key={feed.id} className={form.feed_ids.includes(feed.id) ? 'selected' : ''}>
                <input type="checkbox" checked={form.feed_ids.includes(feed.id)} onChange={() => toggleFeed(feed.id)} />
                <span>{feed.name}</span>
                <em>{feed.vendor} / {feed.product} / {feed.db_type}</em>
              </label>
            ))}
            {!visibleFeeds.length && <p className="empty-feed-picker">暂无匹配订阅</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
