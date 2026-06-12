import { BookOpen, ChevronLeft, ChevronRight, Database, FileText, Home, List, Menu, Search, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';

const nav = [
  ['overview', '首页概览', Home],
  ['feeds', '订阅管理', FileText],
  ['groups', '订阅组管理', Users],
  ['entries', '全局动态', List],
  ['status', '源状态', ShieldCheck],
  ['docs', 'API 文档', BookOpen],
];

export default function Layout({ page, setPage, globalKeyword, setGlobalKeyword, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function go(nextPage) {
    setPage(nextPage);
    setMobileOpen(false);
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-sidebar-open' : ''}`}>
      <button className="mobile-menu-button" onClick={() => setMobileOpen(true)}><Menu size={20} />菜单</button>
      <aside className="sidebar">
        <div className="brand-mark"><Database size={28} /><strong>数据库动态 RSS 管理平台</strong></div>
        <nav className="side-nav">
          {nav.map(([id, label, Icon]) => (
            <button key={id} title={label} className={page === id ? 'active' : ''} onClick={() => go(id)}>
              <Icon size={21} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}<span>{collapsed ? '展开菜单' : '收起菜单'}</span></button>
      </aside>
      {mobileOpen && <button className="sidebar-mask" onClick={() => setMobileOpen(false)} aria-label="关闭菜单" />}
      <main className="main-panel">
        <header className="topbar">
          <label className="top-search">
            <input value={globalKeyword} onChange={(event) => setGlobalKeyword(event.target.value)} placeholder="搜索订阅源、订阅组或动态..." />
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
