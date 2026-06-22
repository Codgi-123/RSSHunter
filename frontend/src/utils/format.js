import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

// The backend stores naive UTC timestamps; interpret zone-less input as UTC.
function parseTs(value) {
  const text = String(value);
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(text);
  return hasZone ? dayjs(text) : dayjs.utc(text.replace(' ', 'T'));
}

export function formatDateTime(value) {
  if (!value) return '-';
  const parsed = parseTs(value);
  if (!parsed.isValid()) return String(value).replace('T', ' ').replace('Z', '').slice(0, 19);
  return parsed.tz(TZ).format('YYYY-MM-DD HH:mm:ss');
}

// Compact label for timeline meta lines: 月-日 时:分（跨天列表用）。
export function formatShortDateTime(value) {
  if (!value) return '';
  const parsed = parseTs(value);
  if (!parsed.isValid()) return '';
  return parsed.tz(TZ).format('MM-DD HH:mm');
}

// 仅时:分（用于已限定在某一天/今日的语境）。
export function formatEntryTime(value) {
  if (!value) return '';
  const parsed = parseTs(value);
  if (!parsed.isValid()) return '';
  return parsed.tz(TZ).format('HH:mm');
}

// 动态条目按订阅源标签推断类别徽标（版本/安全）；无匹配时不显示徽标。
export function getEntryBadge(feedTags) {
  const tags = (feedTags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const secKw = ['安全', 'cve', 'security', 'vulnerability'];
  const verKw = ['版本', 'release', 'version'];
  for (const t of tags) {
    const tl = t.toLowerCase();
    if (secKw.some((k) => tl.includes(k))) return { text: '安全', cls: 'entry-badge-security' };
    if (verKw.some((k) => tl.includes(k))) return { text: '版本', cls: 'entry-badge-version' };
  }
  return null;
}

// 取名称的两字母单色角标缩写。
export function monoAbbr(name = '') {
  const parts = name.trim().split(/[\s/·]/);
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function splitTags(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(/[,，|]/).map((item) => item.trim()).filter(Boolean);
}

export function unique(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))];
}
