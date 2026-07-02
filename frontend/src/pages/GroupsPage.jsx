import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import CopyButton from '../components/CopyButton';
import { ClearableInput, ClearableSelect } from '../components/FilterControls';
import LoadingState from '../components/LoadingState';
import Modal from '../components/Modal';
import TagInput from '../components/TagInput';
import { useToast } from '../components/Toast';
import { useFeeds, useGroups, useInvalidateAll } from '../queries';
import { splitTags, unique } from '../utils/format';

const GROUP_COLORS = [
  'oklch(0.55 0.12 255)',
  'oklch(0.6 0.14 35)',
  'oklch(0.55 0.12 165)',
  'oklch(0.6 0.1 310)',
  'oklch(0.6 0.12 80)',
  'oklch(0.55 0.14 220)',
  'oklch(0.55 0.12 130)',
  'oklch(0.6 0.12 350)',
  'oklch(0.5 0.13 35)',
];

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
  const { data: groups = [], isLoading } = useGroups();
  const { data: feeds = [] } = useFeeds();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(newGroupForm());
  const [busy, setBusy] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const toast = useToast();

  const summary = useMemo(() => ({
    total: groups.length,
    covered: groups.reduce((sum, g) => sum + (g.feed_count || 0), 0),
    today: groups.reduce((sum, g) => sum + (g.today_new || 0), 0),
  }), [groups]);

  function openCreate() {
    setForm(newGroupForm());
    setFormErrors({});
    setCreating(true);
  }

  async function submitGroup() {
    const errors = validateGroupForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    const payload = { ...form, tags: splitTags(form.tags), enabled: Boolean(form.enabled), feed_ids: form.feed_ids.map(Number) };
    setBusy(true);
    try {
      await api.post('/groups', payload);
      setCreating(false);
      await invalidate();
      toast.success('订阅组已创建');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <LoadingState title="正在加载订阅组..." rows={3} />;

  return (
    <>
      <div className="overview-head">
        <div>
          <div className="overview-eyebrow">GROUPS / 订阅组管理</div>
          <div className="overview-title">订阅组管理</div>
        </div>
        <button className="primary-button" onClick={openCreate} disabled={busy}><Plus size={16} />新建订阅组</button>
      </div>


      <div className="stat-strip editorial summary-3">
        <div className="stat-strip-item">
          <div className="stat-label">订阅组总数</div>
          <div className="stat-value summary-value">{summary.total}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-label">覆盖订阅源</div>
          <div className="stat-value summary-value">{summary.covered}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-label">今日总动态</div>
          <div className="stat-value summary-value stat-value-accent">{summary.today}</div>
        </div>
      </div>

      {groups.length ? (
        <div className="group-card-grid">
          {groups.map((group, index) => (
            <a
              className="group-card"
              key={group.id}
              style={{ borderTopColor: GROUP_COLORS[index % GROUP_COLORS.length] }}
              onClick={() => navigate(`/groups/${group.id}`)}
            >
              <div className="group-card-name">{group.name}</div>
              <div className="group-card-desc">{group.description || '暂无描述'}</div>
              <div className="group-card-foot">
                <div className="group-card-stats">
                  <span><b>{group.feed_count || 0}</b> 订阅源</span>
                  <span><b className="accent-mono">+{group.today_new || 0}</b> 今日</span>
                </div>
                <span className="group-card-link">查看详情 →</span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="state-panel">暂无订阅组</div>
      )}

      {creating && <GroupModal form={form} setForm={setForm} feeds={feeds} title="新建订阅组" busy={busy} errors={formErrors} onClose={() => setCreating(false)} onSubmit={submitGroup} />}
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
    const anyMatch = (filter, test) => !filter || filter.split(',').some(test); // ponytail: multi filters are comma-joined
    return (!keyword || text.includes(keyword))
      && anyMatch(feedFilters.vendor, (v) => feed.vendor === v)
      && anyMatch(feedFilters.product, (v) => feed.product === v)
      && anyMatch(feedFilters.db_type, (v) => feed.db_type === v)
      && anyMatch(feedFilters.tag, (v) => tags.includes(v))
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
            <ClearableSelect multiple value={feedFilters.vendor} onChange={(value) => updateFeedFilter('vendor', value)} label="厂商"><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
            <ClearableSelect multiple value={feedFilters.product} onChange={(value) => updateFeedFilter('product', value)} label="产品"><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
            <ClearableSelect multiple value={feedFilters.db_type} onChange={(value) => updateFeedFilter('db_type', value)} label="数据库类型"><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
            <ClearableSelect multiple value={feedFilters.tag} onChange={(value) => updateFeedFilter('tag', value)} label="标签"><option value="">标签</option>{feedTags.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
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
