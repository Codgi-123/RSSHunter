import { AlertTriangle, Download, Edit3, Eye, PauseCircle, Plus, RefreshCw, Rss, Search, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import ActionDialog from '../components/ActionDialog';
import CopyButton from '../components/CopyButton';
import { PageTitle } from '../components/Layout';
import MetricCard from '../components/MetricCard';
import Modal from '../components/Modal';
import Pagination, { getPageItems } from '../components/Pagination';
import StatusPill from '../components/StatusPill';
import TagInput from '../components/TagInput';
import TagList from '../components/TagList';
import VendorBadge from '../components/VendorBadge';
import { formatDateTime, splitTags, unique } from '../utils/format';

const emptyFeed = { name: '', rss_url: '', vendor: '', product: '', db_type: '关系型', tags: [], description: '', enabled: true };

function newFeedForm() {
  return { ...emptyFeed, tags: [] };
}

export default function FeedsPage({ feeds, reloadFeeds, setPage, setSelectedFeed }) {
  const [filters, setFilters] = useState({ keyword: '', vendor: '', product: '', db_type: '', status: '' });
  const [items, setItems] = useState(feeds);
  const [editing, setEditing] = useState(undefined);
  const [form, setForm] = useState(newFeedForm());
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [page, setLocalPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => { setItems(feeds); }, [feeds]);
  useEffect(() => {
    const handle = setTimeout(() => api.get('/feeds', filters, { cache: false }).then(setItems), 180);
    return () => clearTimeout(handle);
  }, [filters]);

  const stats = useMemo(() => ({
    total: items.length,
    ok: items.filter((feed) => feed.enabled && feed.status === 'normal').length,
    bad: items.filter((feed) => ['fetch_failed', 'parse_error'].includes(feed.status)).length,
    disabled: items.filter((feed) => !feed.enabled).length,
  }), [items]);

  const vendors = unique(feeds, 'vendor');
  const products = unique(feeds, 'product');
  const dbTypes = unique(feeds, 'db_type');
  const pagedItems = useMemo(() => getPageItems(items, page, pageSize), [items, page, pageSize]);

  function updateFilter(key, value) {
    setLocalPage(1);
    setFilters({ ...filters, [key]: value });
  }

  function openCreate() {
    setEditing(null);
    setForm(newFeedForm());
  }

  function openEdit(feed) {
    setEditing(feed);
    setForm({ ...feed, tags: splitTags(feed.tags) });
  }

  function closeModal() {
    setEditing(undefined);
    setForm(newFeedForm());
  }

  async function reloadList() {
    await reloadFeeds();
    setItems(await api.get('/feeds', filters, { cache: false }));
  }

  async function submitFeed() {
    setBusy(true);
    const payload = { ...form, tags: splitTags(form.tags), enabled: Boolean(form.enabled) };
    try {
      if (editing) await api.put(`/feeds/${editing.id}`, payload);
      else await api.post('/feeds', payload);
      closeModal();
      await reloadList();
    } finally { setBusy(false); }
  }

  async function deleteFeed(feed) {
    if (!confirm(`确认删除订阅源「${feed.name}」？`)) return;
    await api.delete(`/feeds/${feed.id}`);
    await reloadList();
  }

  async function refreshFeed(feed) {
    setBusy(true);
    try {
      await api.post(`/feeds/${feed.id}/refresh`, {});
      await reloadList();
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageTitle title="订阅管理" subtitle="统一管理所有数据库 RSS 订阅源，支持搜索、筛选、状态维护与手动刷新" />
      <section className="toolbar-panel">
        <button className="primary-button" onClick={openCreate}><Plus size={18} />新增订阅</button>
        <button onClick={() => setBulkOpen(true)}><Upload size={17} />批量导入</button>
        <label className="filter-search"><input value={filters.keyword} onChange={(event) => updateFilter('keyword', event.target.value)} placeholder="搜索订阅名称、厂商、产品或 URL" /><Search size={18} /></label>
        <select value={filters.vendor} onChange={(event) => updateFilter('vendor', event.target.value)}><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.product} onChange={(event) => updateFilter('product', event.target.value)}><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.db_type} onChange={(event) => updateFilter('db_type', event.target.value)}><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">状态</option><option value="normal">正常</option><option value="fetch_failed">抓取失败</option><option value="parse_error">解析异常</option></select>
        <button onClick={() => { setLocalPage(1); setFilters({ keyword: '', vendor: '', product: '', db_type: '', status: '' }); }}><RefreshCw size={16} />重置筛选</button>
      </section>

      <section className="metric-grid"><MetricCard icon={Rss} label="订阅源总数" value={stats.total} hint="所有订阅源数量" /><MetricCard icon={ShieldCheck} label="正常订阅源" value={stats.ok} tone="green" hint="运行正常的订阅源" /><MetricCard icon={AlertTriangle} label="异常订阅源" value={stats.bad} tone="red" hint="存在异常的订阅源" /><MetricCard icon={PauseCircle} label="停用订阅源" value={stats.disabled} tone="gray" hint="已停用的订阅源" /></section>

      <section className="panel">
        <div className="panel-header"><h2>RSS 订阅列表</h2><div className="header-tools"><button><Download size={16} />导出</button><button onClick={() => api.get('/feeds', filters, { cache: false }).then(setItems)}><RefreshCw size={16} />刷新列表</button></div></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>订阅名称</th><th>厂商</th><th>产品</th><th>数据库类型</th><th>标签</th><th>RSS URL</th><th>最近更新时间</th><th>最近抓取时间</th><th>状态</th><th>所属订阅组</th><th>操作</th></tr></thead>
            <tbody>
              {pagedItems.map((feed) => (
                <tr key={feed.id}>
                  <td><button className="table-title-link cell-with-icon" onClick={() => { setSelectedFeed(feed.id); setPage('feed-detail'); }}><Rss size={15} />{feed.name}</button></td>
                  <td><VendorBadge vendor={feed.vendor} /></td>
                  <td>{feed.product}</td>
                  <td>{feed.db_type}</td>
                  <td><TagList tags={feed.tags} /></td>
                  <td className="url-cell"><div className="url-cell-inner"><span>{feed.rss_url}</span><CopyButton text={feed.rss_url} /></div></td>
                  <td>{formatDateTime(feed.latest_item_published_at)}</td>
                  <td>{formatDateTime(feed.last_fetched_at)}</td>
                  <td><StatusPill status={feed.status} enabled={feed.enabled} /></td>
                  <td>{feed.groups || '-'}</td>
                  <td className="row-actions action-cell">
                    <ActionDialog
                      title={feed.name}
                      actions={[
                        { label: '查看详情', icon: <Eye size={16} />, onClick: () => { setSelectedFeed(feed.id); setPage('feed-detail'); } },
                        { label: '编辑订阅', icon: <Edit3 size={16} />, onClick: () => openEdit(feed) },
                        { label: feed.status === 'normal' ? '刷新订阅' : '重试抓取', icon: <RefreshCw size={16} />, primary: true, disabled: busy, onClick: () => refreshFeed(feed) },
                        { label: '删除订阅', icon: <Trash2 size={16} />, danger: true, onClick: () => deleteFeed(feed) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan="11" className="empty-cell">暂无订阅源</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination total={items.length} page={page} pageSize={pageSize} onPageChange={setLocalPage} onPageSizeChange={(size) => { setPageSize(size); setLocalPage(1); }} />
      </section>

      {editing !== undefined && <FeedModal title={editing ? '编辑订阅' : '新增订阅'} form={form} setForm={setForm} busy={busy} onClose={closeModal} onSubmit={submitFeed} />}
      {bulkOpen && <BulkImportModal busy={busy} setBusy={setBusy} onClose={() => setBulkOpen(false)} onDone={reloadList} />}
    </>
  );
}

function FeedModal({ title, form, setForm, busy, onClose, onSubmit }) {
  const update = (key, value) => setForm({ ...form, [key]: value });
  return (
    <Modal title={title} onClose={onClose} footer={<><button onClick={onClose}>取消</button><button className="primary-button" onClick={onSubmit} disabled={busy || !form.name || !form.rss_url}>保存</button></>}>
      <div className="form-grid">
        <label>订阅名称<input value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
        <label>RSS URL<input value={form.rss_url} onChange={(event) => update('rss_url', event.target.value)} /></label>
        <label>厂商<input value={form.vendor} onChange={(event) => update('vendor', event.target.value)} /></label>
        <label>产品名称<input value={form.product} onChange={(event) => update('product', event.target.value)} /></label>
        <label>数据库类型<select value={form.db_type} onChange={(event) => update('db_type', event.target.value)}><option>关系型</option><option>缓存</option><option>文档数据库</option><option>搜索数据库</option><option>向量数据库</option><option>图数据库</option><option>时序数据库</option></select></label>
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

  async function submit() {
    const feeds = parseBulkFeeds(text);
    if (!feeds.length) return;
    setBusy(true);
    try {
      const data = await api.post('/feeds/bulk', { feeds });
      setResult(data);
      await onDone();
    } finally { setBusy(false); }
  }

  return (
    <Modal title="批量导入订阅" onClose={onClose} footer={<><button onClick={onClose}>关闭</button><button className="primary-button" onClick={submit} disabled={busy || !text.trim()}>导入</button></>}>
      <div className="bulk-import-box">
        <p>支持每行一个订阅：名称, RSS URL, 厂商, 产品, 数据库类型, 标签, 描述；也支持粘贴 JSON 数组。</p>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="腾讯云向量数据库动态, https://rsshub.codgi.xin/tencent/cloud/document/product-updates/向量数据库, 腾讯云, 向量数据库, 向量数据库, 腾讯云|向量数据库, 产品更新 RSS" />
        {result && <div className="import-result">导入 {result.created.length} 条，跳过 {result.skipped.length} 条。</div>}
      </div>
    </Modal>
  );
}
