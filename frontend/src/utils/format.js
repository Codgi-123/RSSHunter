import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

export function formatDateTime(value) {
  if (!value) return '-';
  const text = String(value);
  // The backend stores naive UTC timestamps; interpret zone-less input as UTC.
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(text);
  const parsed = hasZone ? dayjs(text) : dayjs.utc(text.replace(' ', 'T'));
  if (!parsed.isValid()) return text.replace('T', ' ').replace('Z', '').slice(0, 19);
  return parsed.tz(TZ).format('YYYY-MM-DD HH:mm:ss');
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
