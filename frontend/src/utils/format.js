export function formatDateTime(value) {
  if (!value) return '-';
  const date = parseBackendDate(value);
  if (!date) return String(value).replace('T', ' ').replace('Z', '').slice(0, 19);
  const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (item) => String(item).padStart(2, '0');
  return `${chinaTime.getUTCFullYear()}-${pad(chinaTime.getUTCMonth() + 1)}-${pad(chinaTime.getUTCDate())} ${pad(chinaTime.getUTCHours())}:${pad(chinaTime.getUTCMinutes())}:${pad(chinaTime.getUTCSeconds())}`;
}

export function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function parseBackendDate(value) {
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
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
