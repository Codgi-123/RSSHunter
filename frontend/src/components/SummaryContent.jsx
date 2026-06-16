import { useMemo } from 'react';
import { htmlToText, sanitizeHtml } from '../utils/html';

export default function SummaryContent({ value, compact = false }) {
  const content = useMemo(() => (compact ? htmlToText(value) : sanitizeHtml(value)), [compact, value]);
  if (!content) return <span>-</span>;

  if (compact) return <span className="summary-inline" title={content}>{content}</span>;
  return <div className="summary-rich" dangerouslySetInnerHTML={{ __html: content }} />;
}
