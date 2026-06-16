import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';
import Layout from './components/Layout';
import LoadingState from './components/LoadingState';
import DocsPage from './pages/DocsPage';
import EntriesPage from './pages/EntriesPage';
import FeedDetailPage from './pages/FeedDetailPage';
import FeedsPage from './pages/FeedsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import GroupsPage from './pages/GroupsPage';
import OverviewPage from './pages/OverviewPage';
import StatusPage from './pages/StatusPage';
import './styles.css';

const validPages = new Set(['overview', 'feeds', 'feed-detail', 'groups', 'group-detail', 'entries', 'status', 'docs']);

function initialPage() {
  const page = new URLSearchParams(window.location.search).get('page');
  return validPages.has(page) ? page : 'overview';
}

function App() {
  const [page, setPageState] = useState(initialPage);
  const [globalKeyword, setGlobalKeyword] = useState('');
  const [overview, setOverview] = useState({ stats: {}, trend: [], recent_feeds: [], groups: [], abnormal_feeds: [] });
  const [feeds, setFeeds] = useState([]);
  const [groups, setGroups] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const setPage = useCallback((nextPage) => {
    setPageState((current) => {
      const value = typeof nextPage === 'function' ? nextPage(current) : nextPage;
      if (!validPages.has(value)) return current;
      const url = new URL(window.location.href);
      if (value === 'overview') url.searchParams.delete('page');
      else url.searchParams.set('page', value);
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      return value;
    });
  }, []);

  const loadOverview = useCallback(async () => {
    try { setOverview(await api.get('/overview', undefined, { cache: false })); }
    catch (err) { setError(err.message); }
  }, []);
  const loadFeeds = useCallback(async () => {
    try { setFeeds(await api.get('/feeds', undefined, { cache: false })); }
    catch (err) { setError(err.message); }
  }, []);
  const loadGroups = useCallback(async () => {
    try { setGroups(await api.get('/groups', undefined, { cache: false })); }
    catch (err) { setError(err.message); }
  }, []);
  const loadLogs = useCallback(async () => {
    try { setLogs(await api.get('/fetch-logs', undefined, { cache: false })); }
    catch (err) { setError(err.message); }
  }, []);
  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      await Promise.allSettled([loadOverview(), loadFeeds(), loadGroups(), loadLogs()]);
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, [loadOverview, loadFeeds, loadGroups, loadLogs]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (!globalKeyword.trim()) return;
    setPage('entries');
  }, [globalKeyword]);

  const content = useMemo(() => {
    if (page === 'feeds') return <FeedsPage feeds={feeds} reloadFeeds={loadFeeds} setPage={setPage} setSelectedFeed={setSelectedFeed} />;
    if (page === 'feed-detail') return <FeedDetailPage feedId={selectedFeed || feeds[0]?.id} setPage={setPage} />;
    if (page === 'groups') return <GroupsPage groups={groups} feeds={feeds} reloadGroups={loadGroups} setPage={setPage} setSelectedGroup={setSelectedGroup} />;
    if (page === 'group-detail') return <GroupDetailPage groupId={selectedGroup || groups[0]?.id} setPage={setPage} />;
    if (page === 'entries') return <EntriesPage feeds={feeds} groups={groups} initialKeyword={globalKeyword} />;
    if (page === 'status') return <StatusPage feeds={feeds} logs={logs} reloadFeeds={loadFeeds} reloadLogs={loadLogs} />;
    if (page === 'docs') return <DocsPage />;
    return <OverviewPage overview={overview} reloadOverview={loadOverview} setPage={setPage} setSelectedFeed={setSelectedFeed} setSelectedGroup={setSelectedGroup} />;
  }, [page, feeds, groups, logs, overview, selectedFeed, selectedGroup, globalKeyword, loadOverview, loadFeeds, loadGroups, loadLogs]);

  return (
    <Layout page={page} setPage={setPage} globalKeyword={globalKeyword} setGlobalKeyword={setGlobalKeyword}>
      {error && <div className="error-banner" role="alert"><span>{error}</span><div><button onClick={loadAll} disabled={refreshing}>重试</button><button onClick={() => setError('')}>关闭</button></div></div>}
      {refreshing && !initialLoading && <div className="inline-loading" role="status" aria-live="polite">正在同步最新数据...</div>}
      {initialLoading ? <LoadingState title="正在加载平台数据..." rows={4} /> : content}
    </Layout>
  );
}

createRoot(document.getElementById('root')).render(<App />);
