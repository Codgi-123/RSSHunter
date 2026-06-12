export function formatDateTime(value) {
  if (!value) return '-';
  return String(value).replace('T', ' ').replace('Z', '').slice(0, 19);
}

export function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

export function splitTags(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(/[,，|]/).map((item) => item.trim()).filter(Boolean);
}

export function joinTags(value) {
  if (Array.isArray(value)) return value.join(',');
  return value || '';
}

export function unique(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))];
}
