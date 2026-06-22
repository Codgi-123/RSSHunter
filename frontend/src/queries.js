import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from './api';

// react-query hashes object query keys by value, so passing filter/param objects
// straight through keys each distinct request and caches it independently.

export function useOverview() {
  return useQuery({ queryKey: ['overview'], queryFn: () => api.get('/overview') });
}

export function useSyncStatus() {
  return useQuery({ queryKey: ['sync-status'], queryFn: () => api.get('/sync-status'), staleTime: 30 * 1000 });
}

export function useFeeds(filters) {
  return useQuery({ queryKey: ['feeds', filters || {}], queryFn: () => api.get('/feeds', filters), placeholderData: keepPreviousData });
}

export function useFeed(feedId) {
  return useQuery({ queryKey: ['feed', feedId], queryFn: () => api.get(`/feeds/${feedId}`), enabled: feedId != null });
}

export function useFeedEntries(feedId, params) {
  return useQuery({ queryKey: ['feed', feedId, 'entries', params], queryFn: () => api.get(`/feeds/${feedId}/entries`, params), enabled: feedId != null, placeholderData: keepPreviousData });
}

export function useFeedCalendar(feedId, month, enabled = true) {
  return useQuery({ queryKey: ['feed', feedId, 'calendar', month], queryFn: () => api.get(`/feeds/${feedId}/calendar`, { month }), enabled: enabled && feedId != null });
}

export function useFetchLogs(feedId, enabled = true) {
  const params = feedId != null ? { feed_id: feedId, limit: 200 } : { limit: 200 };
  return useQuery({ queryKey: ['fetch-logs', feedId ?? 'all'], queryFn: () => api.get('/fetch-logs', params), enabled });
}

export function useGroups() {
  return useQuery({ queryKey: ['groups'], queryFn: () => api.get('/groups') });
}

export function useGroup(groupId) {
  return useQuery({ queryKey: ['group', groupId], queryFn: () => api.get(`/groups/${groupId}`), enabled: groupId != null });
}

export function useGroupEntries(groupId, params, enabled = true) {
  return useQuery({ queryKey: ['group', groupId, 'entries', params], queryFn: () => api.get(`/groups/${groupId}/entries`, params), enabled: enabled && groupId != null, placeholderData: keepPreviousData });
}

export function useGroupEntriesBySource(groupId, params, enabled = true) {
  return useQuery({ queryKey: ['group', groupId, 'by-source', params], queryFn: () => api.get(`/groups/${groupId}/entries-by-source`, params), enabled: enabled && groupId != null });
}

export function useGroupCalendar(groupId, params, enabled = true) {
  return useQuery({ queryKey: ['group', groupId, 'calendar', params], queryFn: () => api.get(`/groups/${groupId}/calendar`, params), enabled: enabled && groupId != null });
}

export function useEntries(params) {
  return useQuery({ queryKey: ['entries', params], queryFn: () => api.get('/entries', params), placeholderData: keepPreviousData });
}

export function useCalendar(params, enabled = true) {
  return useQuery({ queryKey: ['calendar', params], queryFn: () => api.get('/calendar', params), enabled });
}

export function useInvalidateAll() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries(), [queryClient]);
}
