import { AlertTriangle, FileText, Home, List, Menu, RefreshCw, Search, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useInvalidateAll, useOverview, useSyncStatus } from '../queries';
import { useToast } from './Toast';
import { formatEntryTime } from '../utils/format';

const nav = [
  ['/', '首页概览', Home],
  ['/feeds', '订阅管理', FileText],
  ['/groups', '订阅组管理', Users],
  ['/entries', '全局动态', List],
];

function isActive(pathname, path) {
  return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

function RssIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 11a9 9 0 0 1 9 9M5 5a15 15 0 0 1 15 15" />
      <circle cx="6" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const invalidate = useInvalidateAll();
  const toast = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalKeyword, setGlobalKeyword] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const mainRef = useRef(null);
  const searchRef = useRef(null);

  const { data: overview = {} } = useOverview();
  const { data: syncStatus } = useSyncStatus();
  const abnormalCount = overview?.stats?.abnormal_count ?? 0;

  useEffect(() => {
    setMobileOpen(false);
    const activeEl = document.activeElement;
    if (activeEl?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement;
        if (active?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function search(value) {
    setGlobalKeyword(value);
    const params = value.trim() ? `?keyword=${encodeURIComponent(value.trim())}` : '';
    navigate(`/entries${params}`, { replace: location.pathname === '/entries' });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await invalidate();
      toast.success('数据已刷新');
    } catch (err) {
      toast.error(err.message || '刷新失败');
    } finally {
      setRefreshing(false);
    }
  }

  const syncOk = !syncStatus || syncStatus.ok !== false;
  const syncTime = syncStatus?.last_at ? formatEntryTime(syncStatus.last_at) : null;

  return (
    <div className={`app-shell ${mobileOpen ? 'mobile-sidebar-open' : ''}`}>
      <a className="skip-link" href="#main-content">跳至主要内容</a>
      <button
        className="mobile-menu-button"
        type="button"
        aria-controls="app-sidebar"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={18} /> 菜单
      </button>

      <aside className="sidebar" id="app-sidebar">
        <div className="brand-mark">
          <div className="brand-logo">
            <RssIcon />
          </div>
          <strong>数据库动态 RSS</strong>
        </div>
        <div className="side-nav-label">导航</div>
        <nav className="side-nav" aria-label="主导航">
          {nav.map(([path, label, Icon]) => {
            const active = isActive(location.pathname, path);
            return (
              <Link
                key={path}
                to={path}
                title={label}
                aria-current={active ? 'page' : undefined}
                className={active ? 'active' : ''}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span className={`status-dot ${syncOk ? 'status-dot-ok' : 'status-dot-bad'}`} />
          <span className="sidebar-status-text">{syncOk ? '同步正常' : '同步异常'}</span>
          {syncTime && <span className="sidebar-status-time">{syncTime} 更新</span>}
        </div>
      </aside>

      {mobileOpen && (
        <button className="sidebar-mask" onClick={() => setMobileOpen(false)} aria-label="关闭菜单" />
      )}

      <div className="main-panel" id="main-content" ref={mainRef} tabIndex={-1}>
        <header className="topbar">
          <label className="top-search-wrap" onClick={() => searchRef.current?.focus()}>
            <Search size={15} style={{ flexShrink: 0 }} />
            <input
              ref={searchRef}
              aria-label="全局搜索"
              value={globalKeyword}
              onChange={(e) => search(e.target.value)}
              placeholder="搜索订阅源、订阅组或动态…"
            />
            {globalKeyword && (
              <button type="button" className="search-clear-button" onClick={() => search('')} aria-label="清空搜索">
                <X size={15} />
              </button>
            )}
            {!globalKeyword && <span className="search-shortcut">/</span>}
          </label>
          <div className="topbar-actions">
            {abnormalCount > 0 && (
              <button
                className="topbar-btn topbar-btn-warn"
                type="button"
                onClick={() => navigate('/feeds?status=abnormal')}
                title="查看异常订阅源"
              >
                <AlertTriangle size={15} />
                <span>异常订阅源</span>
                <span className="topbar-badge">{abnormalCount}</span>
              </button>
            )}
            <div className="topbar-divider" />
            <button
              className="topbar-btn"
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="立即刷新所有数据"
            >
              <RefreshCw size={15} style={refreshing ? { animation: 'ui-spin 0.8s linear infinite' } : {}} />
              <span>立即刷新</span>
            </button>
          </div>
        </header>
        <div className="page-content" key={location.pathname}>
          {children}
        </div>
      </div>
    </div>
  );
}
