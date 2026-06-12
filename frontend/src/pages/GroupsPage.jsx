import { CalendarDays, Edit3, Plus, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api';
import { PageTitle } from '../components/Layout';
import Modal from '../components/Modal';
import Pagination, { getPageItems } from '../components/Pagination';
import StatusPill from '../components/StatusPill';
import TagInput from '../components/TagInput';
import TagList from '../components/TagList';
import { formatDateTime, splitTags } from '../utils/format';

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
            <h3>{group.name}</h3><p>{group.description || '暂无描述'}</p>
            <TagList tags={group.tags} />
            <div className="group-meta"><span>包含订阅数</span><b>{group.feed_count || 0}</b></div><div className="group-meta"><span>今日新增</span><b>{group.today_new || 0}</b></div><div className="group-meta"><span>最近更新时间</span><b>{formatDateTime(group.latest_update)}</b></div>
            <StatusPill status="normal" enabled={group.enabled} />
            <div className="card-actions"><button onClick={() => { setSelectedGroup(group.id); setPage('group-detail'); }}>查看详情</button><button onClick={() => hydrateAndEdit(group)}><Edit3 size={15} />编辑</button><button className="danger-link" onClick={() => deleteGroup(group)}>删除</button></div>
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
  const toggleFeed = (id) => setForm({ ...form, feed_ids: form.feed_ids.includes(id) ? form.feed_ids.filter((item) => item !== id) : [...form.feed_ids, id] });
  return (
    <Modal title={title} onClose={onClose} footer={<><button onClick={onClose}>取消</button><button className="primary-button" onClick={onSubmit} disabled={!form.name || form.feed_ids.length === 0}>保存</button></>}>
      <div className="form-grid">
        <label>订阅组名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>默认视图<select value={form.default_view} onChange={(event) => setForm({ ...form, default_view: event.target.value })}><option value="aggregate">聚合列表</option><option value="source">按源分组</option><option value="calendar">日历视图</option></select></label>
        <label className="span-2">标签<TagInput value={form.tags} onChange={(tags) => setForm({ ...form, tags })} /></label>
        <label className="switch-line"><input type="checkbox" checked={Boolean(form.enabled)} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />启用订阅组</label>
        <label className="span-2">描述<textarea value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <div className="feed-picker span-2"><b>包含订阅</b>{feeds.map((feed) => <label key={feed.id}><input type="checkbox" checked={form.feed_ids.includes(feed.id)} onChange={() => toggleFeed(feed.id)} /><span>{feed.name}</span><em>{feed.vendor} / {feed.product}</em></label>)}</div>
      </div>
    </Modal>
  );
}
