import { AlertTriangle, Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function legacyCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Continue with the legacy path when browser permissions reject the async API.
    }
  }
  if (!legacyCopy(text)) throw new Error('copy failed');
}

export default function CopyButton({ text, label = '复制' }) {
  const [status, setStatus] = useState('idle');
  const timerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  async function copyText(event) {
    event.stopPropagation();
    if (!text) return;
    window.clearTimeout(timerRef.current);
    try {
      await writeClipboard(text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    timerRef.current = window.setTimeout(() => setStatus('idle'), 1400);
  }

  const icon = status === 'copied' ? <Check size={14} /> : status === 'failed' ? <AlertTriangle size={14} /> : <Copy size={14} />;
  const title = status === 'copied' ? '已复制' : status === 'failed' ? '复制失败' : label;

  return <button className={`copy-button ${status === 'failed' ? 'copy-failed' : ''}`} type="button" onClick={copyText} disabled={!text}>{icon}{title}</button>;
}
