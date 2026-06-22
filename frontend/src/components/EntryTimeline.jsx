import SummaryContent from './SummaryContent';
import { formatEntryTime, formatShortDateTime, getEntryBadge } from '../utils/format';

// 时间流式动态列表（来源 · 标签 · 时间 / 标题 / 摘要），替代卡片/表格。
// timeFormat: 'datetime'（跨天列表，显示 月-日 时:分）| 'time'（已限定某天，仅 时:分）。
export default function EntryTimeline({ entries = [], onDetail, timeFormat = 'datetime', empty = '暂无动态' }) {
  const formatTime = timeFormat === 'time' ? formatEntryTime : formatShortDateTime;
  if (!entries.length) {
    return <div className="state-panel">{empty}</div>;
  }
  return (
    <div className="timeline-list">
      {entries.map((entry) => {
        const badge = getEntryBadge(entry.feed_tags);
        return (
          <div
            key={entry.id}
            className="timeline-item"
            role={onDetail ? 'button' : undefined}
            tabIndex={onDetail ? 0 : undefined}
            onClick={() => onDetail?.(entry)}
            onKeyDown={(e) => { if (onDetail && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onDetail(entry); } }}
          >
            <div className="timeline-meta">
              <span className="timeline-source">{entry.feed_name}</span>
              {badge && <span className="timeline-dot" />}
              {badge && <span className={`entry-badge ${badge.cls}`}>{badge.text}</span>}
              <span className="timeline-time">{formatTime(entry.published_at)}</span>
            </div>
            <div className="timeline-title">{entry.title}</div>
            {entry.summary && (
              <div className="timeline-summary">
                <SummaryContent value={entry.summary} compact />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
