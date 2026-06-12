const store = new Map();
const DEFAULT_TTL = 60 * 1000;

export function getCache(key) {
  const cached = store.get(key);
  if (!cached || cached.expireAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return cached.value;
}

export function setCache(key, value, ttl = DEFAULT_TTL) {
  store.set(key, { value, expireAt: Date.now() + ttl });
  return value;
}

export function clearCache(prefix = '') {
  Array.from(store.keys()).forEach((key) => {
    if (!prefix || key.startsWith(prefix)) store.delete(key);
  });
}
