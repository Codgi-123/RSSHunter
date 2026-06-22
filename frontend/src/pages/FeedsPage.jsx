import { AlertTriangle, ChevronDown, ChevronUp, ChevronsUpDown, Copy, Download, Edit3, Eye, PauseCircle, Plus, RefreshCw, Rss, Search, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ActionDialog from '../components/ActionDialog';
import { writeClipboard } from '../components/CopyButton';
import { ClearableInput, ClearableSelect } from '../components/FilterControls';
import Modal from '../components/Modal';
import Pagination, { getPageItems } from '../components/Pagination';
import StatusPill from '../components/StatusPill';
import TagInput from '../components/TagInput';
import { useToast } from '../components/Toast';
import TagList from '../components/TagList';
import VendorBadge from '../components/VendorBadge';
import { useFeeds, useInvalidateAll } from '../queries';
import { formatDateTime, splitTags, unique } from '../utils/format';

const emptyFeed = { name: '', rss_url: '', vendor: '', product: '', db_type: '关系型', tags: [], description: '', enabled: true };

function newFeedForm() {
  return { ...emptyFeed, tags: [] };
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateFeedForm(form) {
  const errors = {};
  if (!form.name?.trim()) errors.name = '请输入订阅名称';
  if (!form.rss_url?.trim()) errors.rss_url = '请输入 RSS URL';
  else if (!validUrl(form.rss_url.trim())) errors.rss_url = 'RSS URL 必须是 http 或 https 地址';
  if (!form.vendor?.trim()) errors.vendor = '请输入厂商';
  if (!form.product?.trim()) errors.product = '请输入产品名称';
  if (!form.db_type?.trim()) errors.db_type = '请选择数据库类型';
  return errors;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportFeeds(items) {
  const header = ['订阅名称', '厂商', '产品', '数据库类型', 'RSS URL', '状态', '标签'];
  const lines = [header, ...items.map((feed) => [feed.name, feed.vendor, feed.product, feed.db_type, feed.rss_url, feed.status, splitTags(feed.tags).join('|')])];
  const blob = new Blob([lines.map((line) => line.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `feeds-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function compareField(a, b, key) {
  return String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'zh-Hans-CN', { numeric: true });
}

export default function FeedsPage() {
  const navigate = useNavigate();
  const invalidate = useInvalidateAll();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = {
    keyword: searchParams.get('keyword') || '',
    vendor: searchParams.get('vendor') || '',
    product: searchParams.get('product') || '',
    db_type: searchParams.get('db_type') || '',
    status: searchParams.get('status') || '',
  };
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 10;
  const sort = { key: searchParams.get('sortKey') || 'id', direction: searchParams.get('sortDir') || 'asc' };

  const { data: items = [], isLoading: listLoading, isFetching } = useFeeds(filters);
  const { data: allFeeds = [] } = useFeeds();
  const [editing, setEditing] = useState(undefined);
  const [form, setForm] = useState(newFeedForm());
  const [busy, setBusy] = useState(false);
  const [busyFeedId, setBusyFeedId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const toast = useToast();
  const [bulkOpen, setBulkOpen] = useState(false);

  // URL search params hold all list state, so leaving and returning (or sharing
  // the link) restores filters, sort and page; ScrollRestoration handles scroll.
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

  const stats = useMemo(() => ({
    total: items.length,
    ok: items.filter((feed) => feed.enabled && feed.status === 'normal').length,
    bad: items.filter((feed) => ['fetch_failed', 'parse_error'].includes(feed.status)).length,
    disabled: items.filter((feed) => !feed.enabled).length,
  }), [items]);

  const vendors = unique(allFeeds, 'vendor');
  const products = unique(allFeeds, 'product');
  const dbTypes = unique(allFeeds, 'db_type');
  const sortedItems = useMemo(() => {
    const nextItems = [...items].sort((a, b) => compareField(a, b, sort.key));
    return sort.direction === 'desc' ? nextItems.reverse() : nextItems;
  }, [items, sort]);
  const pagedItems = useMemo(() => getPageItems(sortedItems, page, pageSize), [sortedItems, page, pageSize]);

  function updateSort(key) {
    patchParams({ sortKey: key, sortDir: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc' });
  }

  function updateFilter(key, value) {
    patchParams({ [key]: value, page: '' });
  }

  function openCreate() {
    setEditing(null);
    setForm(newFeedForm());
    setFormErrors({});
  }

  function openEdit(feed) {
    setEditing(feed);
    setForm({ ...feed, tags: splitTags(feed.tags) });
    setFormErrors({});
  }

  function closeModal() {
    setEditing(undefined);
    setForm(newFeedForm());
    setFormErrors({});
  }

  async function submitFeed() {
    const errors = validateFeedForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    const payload = { ...form, name: form.name.trim(), rss_url: form.rss_url.trim(), vendor: form.vendor.trim(), product: form.product.trim(), tags: splitTags(form.tags), enabled: Boolean(form.enabled) };
    try {
      if (editing) await api.put(`/feeds/${editing.id}`, payload);
      else await api.post('/feeds', payload);
      closeModal();
      await invalidate();
      toast.success(editing ? '订阅已更新' : '订阅已创建');
    } catch (err) {
      toast.error(err.message);
    } finally { setBusy(false); }
  }

  async function deleteFeed(feed) {
    if (!confirm(`确认删除订阅源「${feed.name}」？`)) return;
    setBusyFeedId(feed.id);
    try {
      await api.delete(`/feeds/${feed.id}`);
      await invalidate();
      toast.success('订阅已删除');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyFeedId(null);
    }
  }

  async function copyRssUrl(feed) {
    try {
      await writeClipboard(feed.rss_url);
      toast.success('RSS URL 已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }

  async function refreshFeed(feed) {
    setBusyFeedId(feed.id);
    try {
      await api.post(`/feeds/${feed.id}/refresh`, {});
      await invalidate();
      toast.success('订阅刷新完成');
    } catch (err) {
      toast.error(err.message);
    } finally { setBusyFeedId(null); }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>订阅管理</h1>
          <p>统一管理所有数据库 RSS 订阅源，支持搜索、筛选与手动刷新</p>
        </div>
        <div className="page-actions">
          <button className="primary-button" onClick={openCreate}><Plus size={16} />新增订阅</button>
          <button onClick={() => setBulkOpen(true)}><Upload size={15} />批量导入</button>
        </div>
      </div>

      <div className="stat-strip standalone">
        <div className="stat-strip-item">
          <div className="stat-label">订阅源总数</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-label">正常</div>
          <div className="stat-value" style={{ color: 'var(--ok)' }}>{stats.ok}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-label">异常</div>
          <div className={`stat-value ${stats.bad > 0 ? 'stat-value-warm' : ''}`}>{stats.bad}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-label">停用</div>
          <div className="stat-value" style={{ color: 'var(--muted)' }}>{stats.disabled}</div>
        </div>
      </div>

      <div className="page-block">
        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
            <ClearableInput className="filter-field" value={filters.keyword} onChange={(value) => updateFilter('keyword', value)} placeholder="搜索订阅名称、厂商、产品或 URL" label="订阅搜索" icon={<Search size={15} />} />
            <ClearableSelect value={filters.vendor} onChange={(value) => updateFilter('vendor', value)} label="厂商"><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
            <ClearableSelect value={filters.product} onChange={(value) => updateFilter('product', value)} label="产品"><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
            <ClearableSelect value={filters.db_type} onChange={(value) => updateFilter('db_type', value)} label="数据库类型"><option value="">类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</ClearableSelect>
            <ClearableSelect value={filters.status} onChange={(value) => updateFilter('status', value)} label="状态"><option value="">状态</option><option value="abnormal">异常</option><option value="normal">正常</option><option value="fetch_failed">抓取失败</option><option value="parse_error">解析异常</option><option value="disabled">已停用</option></ClearableSelect>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => invalidate()} disabled={isFetching}><RefreshCw size={14} />{isFetching ? '刷新中' : '刷新'}</button>
            <button onClick={() => exportFeeds(sortedItems)} disabled={!sortedItems.length}><Download size={15} />导出</button>
            <button onClick={() => setSearchParams({}, { replace: true })}>重置筛选</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th><button className="table-sort-button" onClick={() => updateSort('name')}>订阅名称 {sort.key === 'name' ? (sort.direction === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronsUpDown size={13} style={{ opacity: 0.4 }} />}</button></th><th><button className="table-sort-button" onClick={() => updateSort('vendor')}>厂商 {sort.key === 'vendor' ? (sort.direction === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronsUpDown size={13} style={{ opacity: 0.4 }} />}</button></th><th><button className="table-sort-button" onClick={() => updateSort('product')}>产品 {sort.key === 'product' ? (sort.direction === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronsUpDown size={13} style={{ opacity: 0.4 }} />}</button></th><th>数据库类型</th><th>标签</th><th>最近更新时间</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {!listLoading && pagedItems.map((feed) => (
                <tr key={feed.id}>
                  <td><button className="table-title-link cell-with-icon" onClick={() => navigate(`/feeds/${feed.id}`)}><Rss size={15} />{feed.name}</button></td>
                  <td><VendorBadge vendor={feed.vendor} /></td>
                  <td>{feed.product}</td>
                  <td>{feed.db_type}</td>
                  <td><TagList tags={feed.tags} /></td>
                  <td>{formatDateTime(feed.latest_item_published_at)}</td>
                  <td><StatusPill status={feed.status} enabled={feed.enabled} /></td>
                  <td className="row-actions action-cell">
                    <ActionDialog
                      title={feed.name}
                      actions={[
                        { label: '查看详情', icon: <Eye size={16} />, onClick: () => navigate(`/feeds/${feed.id}`) },
                        { label: '复制 RSS URL', icon: <Copy size={16} />, onClick: () => copyRssUrl(feed) },
                        { label: '编辑订阅', icon: <Edit3 size={16} />, onClick: () => openEdit(feed) },
                        { label: feed.status === 'normal' ? '刷新订阅' : '重试抓取', icon: <RefreshCw size={16} />, primary: true, disabled: busyFeedId === feed.id, onClick: () => refreshFeed(feed) },
                        { label: '删除订阅', icon: <Trash2 size={16} />, danger: true, disabled: busyFeedId === feed.id, onClick: () => deleteFeed(feed) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {listLoading && <tr><td colSpan="8" className="empty-cell"><span className="loading-label">正在加载订阅源...</span></td></tr>}
              {!listLoading && !items.length && <tr><td colSpan="8" className="empty-cell">暂无订阅源</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination total={sortedItems.length} page={page} pageSize={pageSize} onPageChange={(next) => patchParams({ page: next === 1 ? '' : next })} onPageSizeChange={(size) => patchParams({ pageSize: size, page: '' })} />
      </div>

      {editing !== undefined && <FeedModal title={editing ? '编辑订阅' : '新增订阅'} form={form} setForm={setForm} busy={busy} errors={formErrors} onClose={closeModal} onSubmit={submitFeed} />}
      {bulkOpen && <BulkImportModal busy={busy} setBusy={setBusy} onClose={() => setBulkOpen(false)} onDone={invalidate} />}
    </>
  );
}

function FeedModal({ title, form, setForm, busy, errors = {}, onClose, onSubmit }) {
  const update = (key, value) => setForm({ ...form, [key]: value });
  return (
    <Modal title={title} onClose={onClose} footer={<><button onClick={onClose} disabled={busy}>取消</button><button className="primary-button" onClick={onSubmit} disabled={busy || !form.name || !form.rss_url}>{busy ? '保存中...' : '保存'}</button></>}>
      <div className="form-grid">
        <label>订阅名称<input value={form.name} onChange={(event) => update('name', event.target.value)} />{errors.name && <small className="field-error">{errors.name}</small>}</label>
        <label>RSS URL<input value={form.rss_url} onChange={(event) => update('rss_url', event.target.value)} />{errors.rss_url && <small className="field-error">{errors.rss_url}</small>}</label>
        <label>厂商<input value={form.vendor} onChange={(event) => update('vendor', event.target.value)} />{errors.vendor && <small className="field-error">{errors.vendor}</small>}</label>
        <label>产品名称<input value={form.product} onChange={(event) => update('product', event.target.value)} />{errors.product && <small className="field-error">{errors.product}</small>}</label>
        <label>数据库类型<select value={form.db_type} onChange={(event) => update('db_type', event.target.value)}><option>关系型</option><option>缓存</option><option>文档数据库</option><option>搜索数据库</option><option>向量数据库</option><option>图数据库</option><option>时序数据库</option></select>{errors.db_type && <small className="field-error">{errors.db_type}</small>}</label>
        <label className="switch-line"><input type="checkbox" checked={Boolean(form.enabled)} onChange={(event) => update('enabled', event.target.checked)} />启用订阅</label>
        <label className="span-2">标签<TagInput value={form.tags} onChange={(tags) => update('tags', tags)} placeholder="PostgreSQL, 云厂商" /></label>
        <label className="span-2">描述<textarea value={form.description || ''} onChange={(event) => update('description', event.target.value)} /></label>
      </div>
    </Modal>
  );
}

function parseBulkFeeds(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) return JSON.parse(trimmed).map((item) => ({ ...item, tags: splitTags(item.tags), enabled: item.enabled !== false }));
  return trimmed.split(/\n+/).map((line) => {
    const [name, rss_url, vendor = '', product = '', db_type = '关系型', tags = '', description = ''] = line.split(/\t|,/).map((item) => item.trim());
    return { name, rss_url, vendor, product, db_type, tags: splitTags(tags), description, enabled: true };
  }).filter((item) => item.name && item.rss_url);
}

function BulkImportModal({ busy, setBusy, onClose, onDone }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    let feeds = [];
    try {
      feeds = parseBulkFeeds(text);
    } catch (err) {
      setError(`导入内容格式错误：${err.message}`);
      return;
    }
    if (!feeds.length) {
      setError('请至少输入一条有效订阅');
      return;
    }
    const invalid = feeds.find((feed) => Object.keys(validateFeedForm(feed)).length);
    if (invalid) {
      setError(`订阅「${invalid.name || invalid.rss_url || '未命名'}」字段不完整或 URL 无效`);
      return;
    }
    setBusy(true);
    try {
      const data = await api.post('/feeds/bulk', { feeds });
      setResult(data);
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <Modal title="批量导入订阅" onClose={onClose} footer={<><button onClick={onClose} disabled={busy}>关闭</button><button className="primary-button" onClick={submit} disabled={busy || !text.trim()}>{busy ? '导入中...' : '导入'}</button></>}>
      <div className="bulk-import-box">
        <p>支持每行一个订阅：名称, RSS URL, 厂商, 产品, 数据库类型, 标签, 描述；也支持粘贴 JSON 数组。</p>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="腾讯云向量数据库动态, https://rsshub.codgi.xin/tencent/cloud/document/product-updates/向量数据库, 腾讯云, 向量数据库, 向量数据库, 腾讯云|向量数据库, 产品更新 RSS" />
        {error && <div className="form-error">{error}</div>}
        {result && <div className="import-result">导入 {result.created.length} 条，跳过 {result.skipped.length} 条。</div>}
      </div>
    </Modal>
  );
}
