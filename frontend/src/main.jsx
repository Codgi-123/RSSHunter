import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { Navigate, Outlet, RouterProvider, ScrollRestoration, createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import DocsPage from './pages/DocsPage';
import EntriesPage from './pages/EntriesPage';
import FeedDetailPage from './pages/FeedDetailPage';
import FeedsPage from './pages/FeedsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import GroupsPage from './pages/GroupsPage';
import OverviewPage from './pages/OverviewPage';
import StatusPage from './pages/StatusPage';
import '@fontsource-variable/dm-sans';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
  },
});

function RootLayout() {
  return (
    <Layout>
      <Outlet />
      {/* React Router restores the window scroll position per location on
          back/forward and link navigation — replaces the old manual handling. */}
      <ScrollRestoration />
    </Layout>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'feeds', element: <FeedsPage /> },
      { path: 'feeds/:feedId', element: <FeedDetailPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'groups/:groupId', element: <GroupDetailPage /> },
      { path: 'entries', element: <EntriesPage /> },
      { path: 'status', element: <StatusPage /> },
      { path: 'docs', element: <DocsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
