import { AlertTriangle, Download, PauseCircle, Plus, RefreshCw, Rss, Search, ShieldCheck, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { PageTitle } from '../components/Layout';
import MetricCard from '../components/MetricCard';
import Modal from '../components/Modal';
import StatusPill from '../components/StatusPill';
import { formatDateTime, joinTags, splitTags, unique } from '../utils/format';

const emptyFeed = { name: '', rss_url: '', vendor: '', product: '', db_type: '关系型', tags: '', website_url: '', description: '', enabled: true };

export default function FeedsPage({ feeds, reloadFeeds, setPage, setSelectedFeed }) {
  const [filters, setFilters] = useState({ keyword: '', vendor: '', product: '', db_type: '', status: '' });
  const [items, setItems] = useState(feeds);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyFeed);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setItems(feeds); }, [feeds]);
  useEffect(() => {
    const handle = setTimeout(() => api.get('/feeds', filters).then(setItems), 180);
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

  function openCreate() { setEditing(null); setForm(emptyFeed); }
  function openEdit(feed) { setEditing(feed); setForm({ ...feed, tags: joinTags(feed.tags) }); }
  function closeModal() { setEditing(undefined); setForm(emptyFeed); }
  async function submitFeed() {
    setBusy(true);
    const payload = { ...form, tags: splitTags(form.tags), enabled: Boolean(form.enabled) };
    try {
      if (editing) await api.put(`/feeds/${editing.id}`, payload);
      else await api.post('/feeds', payload);
      closeModal();
      await reloadFeeds();
      setItems(await api.get('/feeds', filters));
    } finally { setBusy(false); }
  }
  async function deleteFeed(feed) {
    if (!confirm(`确认删除订阅源「${feed.name}」？`)) return;
    await api.delete(`/feeds/${feed.id}`);
    await reloadFeeds();
    setItems(await api.get('/feeds', filters));
  }
  async function refreshFeed(feed) {
    setBusy(true);
    try { await api.post(`/feeds/${feed.id}/refresh`, {}); await reloadFeeds(); setItems(await api.get('/feeds', filters)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageTitle title="订阅管理" subtitle="统一管理所有数据库 RSS 订阅源，支持搜索、筛选、状态维护与手动刷新" />
      <section className="toolbar-panel">
        <button className="primary-button" onClick={openCreate}><Plus size={18} />新增订阅</button>
        <button><Upload size={17} />批量导入</button>
        <label className="filter-search"><input value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} placeholder="搜索订阅名称、厂商、产品或 URL" /><Search size={18} /></label>
        <select value={filters.vendor} onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}><option value="">厂商</option>{vendors.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })}><option value="">产品</option>{products.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.db_type} onChange={(e) => setFilters({ ...filters, db_type: e.target.value })}><option value="">数据库类型</option>{dbTypes.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">状态</option><option value="normal">正常</option><option value="fetch_failed">抓取失败</option><option value="parse_error">解析异常</option></select>
        <button onClick={() => setFilters({ keyword: '', vendor: '', product: '', db_type: '', status: '' })}><RefreshCw size={16} />重置筛选</button>
      </section>

      <section className="metric-grid"><MetricCard icon={Rss} label="订阅源总数" value={stats.total} hint="所有订阅源数量" /><MetricCard icon={ShieldCheck} label="正常订阅源" value={stats.ok} tone="green" hint="运行正常的订阅源" /><MetricCard icon={AlertTriangle} label="异常订阅源" value={stats.bad} tone="red" hint="存在异常的订阅源" /><MetricCard icon={PauseCircle} label="停用订阅源" value={stats.disabled} tone="gray" hint="已停用的订阅源" /></section>

      <section className="panel">
        <div className="panel-header"><h2>RSS 订阅列表</h2><div className="header-tools"><button><Download size={16} />导出</button><button onClick={() => api.get('/feeds', filters).then(setItems)}><RefreshCw size={16} />刷新列表</button></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>订阅名称</th><th>厂商</th><th>产品</th><th>数据库类型</th><th>RSS URL</th><th>最近更新时间</th><th>最近抓取时间</th><th>状态</th><th>所属订阅组</th><th>操作</th></tr></thead><tbody>{items.map((feed) => <tr key={feed.id}><td><Rss size={15} />{feed.name}</td><td>{feed.vendor}</td><td>{feed.product}</td><td>{feed.db_type}</td><td className="url-cell">{feed.rss_url}</td><td>{formatDateTime(feed.latest_item_published_at)}</td><td>{formatDateTime(feed.last_fetched_at)}</td><td><StatusPill status={feed.status} enabled={feed.enabled} /></td><td>{feed.groups || '-'}</td><td className="row-actions"><button onClick={() => { setSelectedFeed(feed.id); setPage('feed-detail'); }}>查看</button><button onClick={() => openEdit(feed)}>编辑</button><button className="danger-link" onClick={() => deleteFeed(feed)}>删除</button><button onClick={() => refreshFeed(feed)} disabled={busy}>{feed.status === 'normal' ? '刷新' : '重试'}</button></td></tr>)}{!items.length && <tr><td colSpan="10" className="empty-cell">暂无订阅源</td></tr>}</tbody></table></div><p className="result-count">共 {items.length} 条</p>
      </section>

      {editing !== undefined && <FeedModal title={editing ? '编辑订阅' : '新增订阅'} form={form} setForm={setForm} busy={busy} onClose={closeModal} onSubmit={submitFeed} />}
    </>
  );
}

function FeedModal({ title, form, setForm, busy, onClose, onSubmit }) {
  const update = (key, value) => setForm({ ...form, [key]: value });
  return <Modal title={title} onClose={onClose} footer={<><button onClick={onClose}>取消</button><button className="primary-button" onClick={onSubmit} disabled={busy || !form.name || !form.rss_url}>保存</button></>}><div className="form-grid"><label>订阅名称<input value={form.name} onChange={(e) => update('name', e.target.value)} /></label><label>RSS URL<input value={form.rss_url} onChange={(e) => update('rss_url', e.target.value)} /></label><label>厂商<input value={form.vendor} onChange={(e) => update('vendor', e.target.value)} /></label><label>产品名称<input value={form.product} onChange={(e) => update('product', e.target.value)} /></label><label>数据库类型<select value={form.db_type} onChange={(e) => update('db_type', e.target.value)}><option>关系型</option><option>缓存</option><option>文档数据库</option><option>搜索数据库</option><option>向量数据库</option><option>图数据库</option><option>时序数据库</option></select></label><label>标签<input value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="PostgreSQL,云厂商" /></label><label>官网链接<input value={form.website_url || ''} onChange={(e) => update('website_url', e.target.value)} /></label><label className="switch-line"><input type="checkbox" checked={Boolean(form.enabled)} onChange={(e) => update('enabled', e.target.checked)} />启用订阅</label><label className="span-2">描述<textarea value={form.description || ''} onChange={(e) => update('description', e.target.value)} /></label></div></Modal>;
}
