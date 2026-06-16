const allowedTags = new Set(['a', 'b', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'h4', 'i', 'li', 'ol', 'p', 'pre', 'strong', 'u', 'ul']);
const dangerousTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'link', 'meta']);
const allowedProtocols = new Set(['http:', 'https:', 'mailto:']);

function unwrapElement(element) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

function sanitizeLink(element) {
  const href = element.getAttribute('href');
  if (!href) return;
  try {
    const url = new URL(href, window.location.origin);
    if (!allowedProtocols.has(url.protocol)) {
      element.removeAttribute('href');
      return;
    }
    element.setAttribute('href', url.href);
    element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noreferrer');
  } catch {
    element.removeAttribute('href');
  }
}

export function sanitizeHtml(value = '') {
  if (!value) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return String(value);

  const doc = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  root.querySelectorAll('*').forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (dangerousTags.has(tag)) {
      element.remove();
      return;
    }
    if (!allowedTags.has(tag)) {
      unwrapElement(element);
      return;
    }
    [...element.attributes].forEach((attr) => {
      if (tag !== 'a' || !['href', 'title'].includes(attr.name)) element.removeAttribute(attr.name);
    });
    if (tag === 'a') sanitizeLink(element);
  });

  return root.innerHTML.trim();
}

export function htmlToText(value = '') {
  if (!value) return '';
  if (typeof document === 'undefined') return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const element = document.createElement('div');
  element.innerHTML = sanitizeHtml(value);
  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}
