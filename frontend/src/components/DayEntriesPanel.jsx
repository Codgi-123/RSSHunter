import { X } from 'lucide-react';
import { useState } from 'react';
import EntryTimeline from './EntryTimeline';
import Pagination, { getPageItems } from './Pagination';

export default function DayEntriesPanel({ dayItems, onClose, onDetail }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const items = dayItems.items || [];
  const pagedItems = getPageItems(items, page, pageSize);
  return (
    <div className="day-drawer">
      <div className="day-drawer-header">
        <h2>{dayItems.date} 动态</h2>
        <button type="button" className="day-drawer-close" onClick={onClose} aria-label="关闭"><X size={16} /></button>
      </div>
      <div className="day-drawer-body">
        {items.length
          ? <EntryTimeline entries={pagedItems} timeFormat="time" onDetail={onDetail} />
          : <div className="state-panel">当日暂无动态</div>}
      </div>
      {items.length > 0 && (
        <Pagination total={items.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      )}
    </div>
  );
}
