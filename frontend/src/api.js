import { clearCache, getCache, setCache } from './utils/cache';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const cacheKey = `${method}:${path}`;
  if (method === 'GET' && options.cache !== false) {
    const cached = getCache(cacheKey);
    if (cached) return cached;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    cache: undefined,
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch (_) {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }
  const data = await response.json();
  if (method === 'GET' && options.cache !== false) return setCache(cacheKey, data, options.ttl);
  if (method !== 'GET') clearCache();
  return data;
}

export function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

export const api = {
  get: (path, params, options) => request(`${path}${toQuery(params)}`, options),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
