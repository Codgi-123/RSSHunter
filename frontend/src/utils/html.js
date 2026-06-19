import DOMPurify from 'dompurify';

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['a', 'b', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'h4', 'i', 'li', 'ol', 'p', 'pre', 'strong', 'u', 'ul'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
};

// Force every surviving link to open safely in a new tab.
if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noreferrer');
    }
  });
}

export function sanitizeHtml(value = '') {
  if (!value || typeof window === 'undefined') return String(value || '');
  return DOMPurify.sanitize(value, SANITIZE_CONFIG).trim();
}

export function htmlToText(value = '') {
  if (!value) return '';
  const clean = sanitizeHtml(value);
  if (typeof document === 'undefined') return clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const element = document.createElement('div');
  element.innerHTML = clean;
  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}
