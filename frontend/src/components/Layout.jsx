import { BookOpen, ChevronLeft, ChevronRight, Database, FileText, Home, List, Menu, Search, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const nav = [
  ['/', '首页概览', Home],
  ['/feeds', '订阅管理', FileText],
  ['/groups', '订阅组管理', Users],
  ['/entries', '全局动态', List],
  ['/docs', 'API 文档', BookOpen],
];

function isActive(pathname, path) {
  return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalKeyword, setGlobalKeyword] = useState('');
  const mainRef = useRef(null);

  useEffect(() => {
    setMobileOpen(false);
    const activeElement = document.activeElement;
    if (activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  function search(value) {
    setGlobalKeyword(value);
    const params = value.trim() ? `?keyword=${encodeURIComponent(value.trim())}` : '';
    navigate(`/entries${params}`, { replace: location.pathname === '/entries' });
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-sidebar-open' : ''}`}>
      <a className="skip-link" href="#main-content">跳至主要内容</a>
      <button className="mobile-menu-button" type="button" aria-controls="app-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={20} />菜单</button>
      <aside className="sidebar" id="app-sidebar">
        <div className="brand-mark"><span className="brand-logo"><Database size={21} strokeWidth={2.25} /></span><strong>数据库动态 RSS 管理平台</strong></div>
        <nav className="side-nav" aria-label="主导航">
          {nav.map(([path, label, Icon]) => {
            const active = isActive(location.pathname, path);
            return (
              <Link key={path} to={path} title={label} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''}>
                <Icon size={21} /><span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <button className="collapse-button" type="button" aria-expanded={!collapsed} aria-label={collapsed ? '展开菜单' : '收起菜单'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}<span>{collapsed ? '展开菜单' : '收起菜单'}</span></button>
      </aside>
      {mobileOpen && <button className="sidebar-mask" onClick={() => setMobileOpen(false)} aria-label="关闭菜单" />}
      <main className="main-panel" id="main-content" ref={mainRef} tabIndex={-1}>
        <header className="topbar">
          <label className="top-search">
            <input aria-label="全局搜索" value={globalKeyword} onChange={(event) => search(event.target.value)} placeholder="搜索订阅源、订阅组或动态..." />
            {globalKeyword && <button type="button" className="search-clear-button" onClick={() => search('')} aria-label="清空搜索"><X size={16} /></button>}
            <Search size={20} />
          </label>
        </header>
        {children}
      </main>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
