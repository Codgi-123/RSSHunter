import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export default function CopyButton({ text, label = '复制' }) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return <button className="copy-button" type="button" onClick={copyText} disabled={!text}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? '已复制' : label}</button>;
}
