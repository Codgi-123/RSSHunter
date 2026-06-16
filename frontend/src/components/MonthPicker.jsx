import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const months = Array.from({ length: 12 }, (_, index) => index + 1);

function parseMonth(value) {
  const now = new Date();
  const [year, month] = String(value || '').split('-').map(Number);
  return {
    year: year || now.getFullYear(),
    month: month || now.getMonth() + 1,
  };
}

function formatMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export default function MonthPicker({ value, onChange }) {
  const selected = useMemo(() => parseMonth(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.year);
  const ref = useRef(null);

  useEffect(() => {
    if (open) setViewYear(selected.year);
  }, [open, selected.year]);

  useEffect(() => {
    if (!open) return undefined;

    function close(event) {
      if (event.key === 'Escape') setOpen(false);
      if (event.type === 'mousedown' && ref.current && !ref.current.contains(event.target)) setOpen(false);
    }

    document.addEventListener('keydown', close);
    document.addEventListener('mousedown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('mousedown', close);
    };
  }, [open]);

  function choose(month) {
    onChange?.(formatMonth(viewYear, month));
    setOpen(false);
  }

  function chooseCurrentMonth() {
    const now = new Date();
    onChange?.(formatMonth(now.getFullYear(), now.getMonth() + 1));
    setOpen(false);
  }

  return (
    <div className="month-picker" ref={ref}>
      <button type="button" className="month-picker-trigger" aria-label="选择月份" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <CalendarDays size={16} />
        <span>{selected.year} 年 {String(selected.month).padStart(2, '0')} 月</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="month-popover" role="dialog" aria-label="选择月份">
          <div className="month-popover-header">
            <button type="button" className="icon-button" aria-label="上一年" onClick={() => setViewYear((year) => year - 1)}><ChevronLeft size={16} /></button>
            <strong>{viewYear}</strong>
            <button type="button" className="icon-button" aria-label="下一年" onClick={() => setViewYear((year) => year + 1)}><ChevronRight size={16} /></button>
          </div>
          <div className="month-option-grid">
            {months.map((month) => {
              const active = selected.year === viewYear && selected.month === month;
              return (
                <button key={month} type="button" className={`month-option ${active ? 'active' : ''}`} aria-pressed={active} onClick={() => choose(month)}>
                  {month} 月
                </button>
              );
            })}
          </div>
          <div className="month-popover-footer">
            <button type="button" className="link-button" onClick={() => { setViewYear(selected.year); }}>回到已选</button>
            <button type="button" className="primary-button" onClick={chooseCurrentMonth}>本月</button>
          </div>
        </div>
      )}
    </div>
  );
}
