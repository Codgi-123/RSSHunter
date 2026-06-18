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
import './styles.css';

const validPages = new Set(['overview', 'feeds', 'feed-detail', 'groups', 'group-detail', 'entries', 'status', 'docs']);

function readPage(search = window.location.search) {
  const page = new URLSearchParams(search).get('page');
  return validPages.has(page) ? page : 'overview';
}

function readId(key, search = window.location.search) {
  const value = new URLSearchParams(search).get(key);
  return value ? Number(value) : null;
}

function buildLocation(page, feedId, groupId) {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  if (page === 'overview') params.delete('page');
  else params.set('page', page);
  if (page === 'feed-detail' && feedId) params.set('feedId', String(feedId));
  else params.delete('feedId');
  if (page === 'group-detail' && groupId) params.set('groupId', String(groupId));
  else params.delete('groupId');
  return `${url.pathname}${url.search}${url.hash}`;
}

function currentLocation() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function App() {
  const [page, setPageState] = useState(readPage);
  const [globalKeyword, setGlobalKeyword] = useState('');
  const [overview, setOverview] = useState({ stats: {}, trend: [], recent_feeds: [], groups: [], abnormal_feeds: [] });
  const [feeds, setFeeds] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedFeed, setSelectedFeed] = useState(() => readId('feedId'));
  const [selectedGroup, setSelectedGroup] = useState(() => readId('groupId'));
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const setPage = useCallback((nextPage) => {
    setPageState((current) => {
      const value = typeof nextPage === 'function' ? nextPage(current) : nextPage;
      return validPages.has(value) ? value : current;
    });
  }, []);

  // Sync navigation state -> URL. Pushes a new history entry only when the
  // target location actually differs (so back/forward stays meaningful and the
  // initial mount / popstate updates don't create duplicate entries).
  useEffect(() => {
    const target = buildLocation(page, selectedFeed, selectedGroup);
    if (target !== currentLocation()) window.history.pushState(null, '', target);
  }, [page, selectedFeed, selectedGroup]);

  // Sync URL -> state when the user uses the browser back/forward buttons.
  useEffect(() => {
    const onPopState = () => {
      setPageState(readPage());
      setSelectedFeed(readId('feedId'));
      setSelectedGroup(readId('groupId'));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
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
  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      await Promise.allSettled([loadOverview(), loadFeeds(), loadGroups()]);
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, [loadOverview, loadFeeds, loadGroups]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (!globalKeyword.trim()) return;
    setPage('entries');
  }, [globalKeyword]);

  const content = useMemo(() => {
    if (page === 'feeds') return <FeedsPage feeds={feeds} reloadFeeds={loadFeeds} setPage={setPage} setSelectedFeed={setSelectedFeed} />;
    if (page === 'feed-detail') return <FeedDetailPage feedId={selectedFeed || feeds[0]?.id} setPage={setPage} />;
    if (page === 'groups') return <GroupsPage groups={groups} feeds={feeds} reloadGroups={loadGroups} setPage={setPage} setSelectedGroup={setSelectedGroup} />;
    if (page === 'group-detail') return <GroupDetailPage groupId={selectedGroup || groups[0]?.id} setPage={setPage} feeds={feeds} reloadGroups={loadGroups} />;
    if (page === 'entries') return <EntriesPage feeds={feeds} groups={groups} initialKeyword={globalKeyword} />;
    if (page === 'docs') return <DocsPage />;
    return <OverviewPage overview={overview} reloadOverview={loadOverview} setPage={setPage} setSelectedFeed={setSelectedFeed} setSelectedGroup={setSelectedGroup} />;
  }, [page, feeds, groups, overview, selectedFeed, selectedGroup, globalKeyword, loadOverview, loadFeeds, loadGroups]);

  return (
    <Layout page={page} setPage={setPage} globalKeyword={globalKeyword} setGlobalKeyword={setGlobalKeyword}>
      {error && <div className="error-banner" role="alert"><span>{error}</span><div><button onClick={loadAll} disabled={refreshing}>重试</button><button onClick={() => setError('')}>关闭</button></div></div>}
      {refreshing && !initialLoading && <div className="inline-loading" role="status" aria-live="polite">正在同步最新数据...</div>}
      {initialLoading ? <LoadingState title="正在加载平台数据..." rows={4} /> : content}
    </Layout>
  );
}

createRoot(document.getElementById('root')).render(<App />);
