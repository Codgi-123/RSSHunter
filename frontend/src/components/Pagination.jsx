import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const pageSizes = [5, 10, 20, 50];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getPageItems(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export default function Pagination({ total = 0, page = 1, pageSize = 10, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [jumpPage, setJumpPage] = useState(String(page));

  useEffect(() => { setJumpPage(String(page)); }, [page]);
  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
  }, [page, totalPages, onPageChange]);

  const pages = useMemo(() => {
    const start = clamp(page - 2, 1, Math.max(1, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, totalPages]);

  function go(nextPage) {
    onPageChange(clamp(nextPage, 1, totalPages));
  }

function submitJump() {
    const nextPage = Number.parseInt(jumpPage, 10);
    if (Number.isFinite(nextPage)) go(nextPage);
    else setJumpPage(String(page));
  }

  return (
    <div className="pagination-bar">
      <p className="result-count">共 {total} 条</p>
      <div className="pagination-controls">
        <select className="pagination-select" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {pageSizes.map((size) => <option key={size} value={size}>{size} 条/页</option>)}
        </select>
        <button className="page-button icon-page" aria-label="上一页" onClick={() => go(page - 1)} disabled={page <= 1}><ChevronLeft size={16} /></button>
        {pages.map((item) => <button key={item} className={`page-button ${item === page ? 'active' : ''}`} aria-current={item === page ? 'page' : undefined} onClick={() => go(item)}>{item}</button>)}
        <button className="page-button icon-page" aria-label="下一页" onClick={() => go(page + 1)} disabled={page >= totalPages}><ChevronRight size={16} /></button>
        <label className="page-jump">前往<input value={jumpPage} inputMode="numeric" aria-label="跳转页码" onChange={(event) => setJumpPage(event.target.value.replace(/\D/g, ''))} onBlur={submitJump} onKeyDown={(event) => { if (event.key === 'Enter') submitJump(); }} />页</label>
      </div>
    </div>
  );
}
