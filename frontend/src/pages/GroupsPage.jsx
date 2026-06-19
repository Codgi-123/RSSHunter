import { Database, Edit3, Eye, Folder, Layers, Plus, Search, Server, Share2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ActionDialog from '../components/ActionDialog';
import CopyButton from '../components/CopyButton';
import { ClearableInput, ClearableSelect } from '../components/FilterControls';
import { PageTitle } from '../components/Layout';
import LoadingState from '../components/LoadingState';
import Modal from '../components/Modal';
import Pagination, { getPageItems } from '../components/Pagination';
import StatusPill from '../components/StatusPill';
import TagInput from '../components/TagInput';
import TagList from '../components/TagList';
import { useFeeds, useGroups, useInvalidateAll } from '../queries';
import { formatDateTime, splitTags, unique } from '../utils/format';

const groupIcons = [Database, Layers, Server, Share2, Folder];
const emptyGroup = { name: '', description: '', tags: [], default_view: 'aggregate', enabled: true, feed_ids: [] };

function newGroupForm() {
  return { ...emptyGroup, tags: [], feed_ids: [] };
}

function validateGroupForm(form) {
  const errors = {};
  if (!form.name?.trim()) errors.name = '请输入订阅组名称';
  if (!form.feed_ids.length) errors.feed_ids = '请至少选择一个订阅源';
  return errors;
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const invalidate = useInvalidateAll();
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') || '';
  const status = searchParams.get('status') || '';
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 10;
  const { data: groups = [], isLoading } = useGroups();
  const { data: feeds = [] } = useFeeds();
  const [editing, setEditing] = useState(undefined);
  const [form, setForm] = useState(newGroupForm());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [formErrors, setFormErrors] = useState({});

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

  const visibleGroups = useMemo(() => groups.filter((group) => (!keyword || `${group.id}${group.name}${group.description}`.includes(keyword)) && (!status || Boolean(group.enabled) === (status === 'enabled'))), [groups, keyword, status]);
  const pagedGroups = useMemo(() => getPageItems(visibleGroups, page, pageSize), [visibleGroups, page, pageSize]);

  function openCreate() {
    setEditing(null);
    setForm(newGroupForm());
    setFormErrors({});
    setMessage('');
  }

  function openEdit(group) {
    setEditing(group);
    setForm({ ...group, tags: splitTags(group.tags), feed_ids: (group.feeds || []).map((feed) => feed.id) });
    setFormErrors({});
    setMessage('');
  }

  async function hydrateAndEdit(group) {
    setBusy(true);
    try {
      openEdit(await api.get(`/groups/${group.id}`));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitGroup() {
    const errors = validateGroupForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    const payload = { ...form, tags: splitTags(form.tags), enabled: Boolean(form.enabled), feed_ids: form.feed_ids.map(Number) };
    setBusy(true);
    try {
      if (editing) await api.put(`/groups/${editing.id}`, payload);
      else await api.post('/groups', payload);
      setEditing(undefined);
      await invalidate();
      setMessage(editing ? '订阅组已更新' : '订阅组已创建');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup(group) {
    if (!confirm(`确认删除订阅组「${group.name}」？`)) return;
    setBusy(true);
    try {
      await api.delete(`/groups/${group.id}`);
      await invalidate();
      setMessage('订阅组已删除');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openGroup(group) {
    navigate(`/groups/${group.id}`);
  }

  function updateKeyword(value) {
    patchParams({ keyword: value, page: '' });
  }

  function updateStatus(value) {
    patchParams({ status: value, page: '' });
  }

  if (isLoading) return <><PageTitle title="订阅组管理" subtitle="正在加载订阅组..." /><LoadingState title="正在加载订阅组..." rows={3} /></>;

  return (
    <>
      <PageTitle title="订阅组管理" subtitle="将多个 RSS 源组合成主题集合，支持聚合、按源分组和日历视图" />
      <section className="toolbar-panel compact-toolbar"><button className="primary-button" onClick={openCreate} disabled={busy}><Plus size={18} />新增订阅组</button><ClearableInput className="filter-search" value={keyword} onChange={updateKeyword} placeholder="搜索订阅组名称、描述或 ID" label="订阅组搜索" icon={<Search size={18} />} /><ClearableSelect value={status} onChange={updateStatus} label="状态"><option value="">状态</option><option value="enabled">启用</option><option value="disabled">停用</option></ClearableSelect></section>
      {message && <div className="inline-status"><span>{message}</span><button onClick={() => setMessage('')}>关闭</button></div>}
      {visibleGroups.length > 0 && <p className="muted-text" style={{ margin: '0 0 12px', fontSize: 12 }}>点击卡片进入详情，支持聚合列表、按源分组与日历三种视图；可通过厂商 / 产品 / 关键词筛选后直接打开原文。</p>}
      <section className="group-card-grid">
        {pagedGroups.map((group, index) => {
          const GroupIcon = groupIcons[index % groupIcons.length];
          return (
          <article className="group-card" key={group.id}>
            <div className={`symbol-card color-${index % 5}`}><GroupIcon size={24} /></div>
            <button className="card-title-link" onClick={() => openGroup(group)}>{group.name}</button>
            <span className="entity-id">ID {group.id}</span>
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
                  { label: '编辑订阅组', icon: <Edit3 size={16} />, disabled: busy, onClick: () => hydrateAndEdit(group) },
                  { label: '删除订阅组', icon: <Trash2 size={16} />, danger: true, disabled: busy, onClick: () => deleteGroup(group) },
                ]}
              />
            </div>
          </article>
          );
        })}
      </section>
      {!visibleGroups.length && <section className="panel state-panel">暂无匹配的订阅组</section>}
      <Pagination total={visibleGroups.length} page={page} pageSize={pageSize} onPageChange={(next) => patchParams({ page: next === 1 ? '' : next })} onPageSizeChange={(size) => patchParams({ pageSize: size, page: '' })} />
      {editing !== undefined && <GroupModal form={form} setForm={setForm} feeds={feeds} title={editing ? '编辑订阅组' : '新增订阅组'} busy={busy} errors={formErrors} onClose={() => setEditing(undefined)} onSubmit={submitGroup} />}
    </>
  );
}

export function GroupModal({ title, form, setForm, feeds, busy, errors = {}, onClose, onSubmit }) {
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
    <Modal title={title} onClose={onClose} footer={<><button onClick={onClose} disabled={busy}>取消</button><button className="primary-button" onClick={onSubmit} disabled={busy || !form.name || form.feed_ids.length === 0}>{busy ? '保存中...' : '保存'}</button></>}>
      <div className="form-grid">
        {form.id != null && <div className="form-readonly span-2"><span>订阅组 ID</span><code>{form.id}</code><CopyButton text={String(form.id)} label="复制 ID" /></div>}
        <label>订阅组名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />{errors.name && <small className="field-error">{errors.name}</small>}</label>
        <label>默认视图<select value={form.default_view} onChange={(event) => setForm({ ...form, default_view: event.target.value })}><option value="aggregate">聚合列表</option><option value="source">按源分组</option><option value="calendar">日历视图</option></select></label>
        <label className="span-2">标签<TagInput value={form.tags} onChange={(tags) => setForm({ ...form, tags })} /></label>
        <label className="switch-line"><input type="checkbox" checked={Boolean(form.enabled)} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />启用订阅组</label>
        <label className="span-2">描述<textarea value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <div className="feed-picker span-2">
          <div className="feed-picker-head"><b>包含订阅</b><span>已选 {form.feed_ids.length} / 匹配 {visibleFeeds.length}</span></div>
          {errors.feed_ids && <div className="form-error">{errors.feed_ids}</div>}
          <div className="feed-picker-toolbar">
            <ClearableInput className="feed-picker-search" value={feedFilters.keyword} onChange={(value) => updateFeedFilter('keyword', value)} placeholder="搜索名称、厂商、产品或 URL" label="订阅源搜索" icon={<Search size={16} />} />
            <ClearableSelect value={feedFilters.vendor} onChange={(value) => updateFeedFilter('vendor', value)} label="厂商"><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
            <ClearableSelect value={feedFilters.product} onChange={(value) => updateFeedFilter('product', value)} label="产品"><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
            <ClearableSelect value={feedFilters.db_type} onChange={(value) => updateFeedFilter('db_type', value)} label="数据库类型"><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
            <ClearableSelect value={feedFilters.tag} onChange={(value) => updateFeedFilter('tag', value)} label="标签"><option value="">标签</option>{feedTags.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
            <ClearableSelect value={feedFilters.status} onChange={(value) => updateFeedFilter('status', value)} label="状态"><option value="">状态</option><option value="normal">正常</option><option value="fetch_failed">抓取失败</option><option value="parse_error">解析异常</option><option value="disabled">已停用</option></ClearableSelect>
            <ClearableSelect value={feedFilters.selected} onChange={(value) => updateFeedFilter('selected', value)} label="选择状态"><option value="">全部</option><option value="selected">已选</option><option value="unselected">未选</option></ClearableSelect>
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
