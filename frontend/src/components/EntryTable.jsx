import { ExternalLink } from 'lucide-react';
import { formatDateTime } from '../utils/format';
import VendorBadge from './VendorBadge';

export default function EntryTable({ entries = [], compact = false, onDetail }) {
  return (
    <div className="table-wrap">
      <table className="data-table entry-table">
        <thead>
          <tr>
            <th>标题</th>
            <th>来源订阅源</th>
            {!compact && <th>厂商</th>}
            {!compact && <th>产品</th>}
            <th>发布时间</th>
            <th>摘要</th>
            <th>原文链接</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="title-cell">{entry.title}</td>
              <td><span className="source-chip">{entry.feed_name}</span></td>
              {!compact && <td><VendorBadge vendor={entry.vendor} /></td>}
              {!compact && <td>{entry.product}</td>}
              <td>{formatDateTime(entry.published_at)}</td>
              <td className="summary-cell">{entry.summary || '-'}</td>
              <td>{entry.link ? <a href={entry.link} target="_blank" rel="noreferrer">查看原文 <ExternalLink size={14} /></a> : '-'}</td>
              <td><button className="outline-mini" onClick={() => onDetail?.(entry)} disabled={!onDetail}>详情</button></td>
            </tr>
          ))}
          {!entries.length && <tr><td colSpan={compact ? 6 : 8} className="empty-cell">暂无动态条目</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
