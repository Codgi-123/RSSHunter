import { DayPicker } from '@daypicker/react';
import '@daypicker/react/style.css';
import { CalendarDays, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

function parseDate(value) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function monthRange(offset = 0) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: formatDate(first), end: formatDate(last) };
}

export default function DateRangeFilter({ start = '', end = '', onChange }) {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const ref = useRef(null);
  const selected = useMemo(() => {
    const from = parseDate(start);
    const to = parseDate(end);
    return from || to ? { from: from || to, to } : undefined;
  }, [start, end]);
  const label = start && end ? `${start} 至 ${end}` : start ? `${start} 起` : end ? `截至 ${end}` : '选择时间范围';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
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
  }, []);

  function updateRange(range) {
    onChange({ start: formatDate(range?.from), end: formatDate(range?.to) });
  }

  const today = formatDate(new Date());
  const presets = useMemo(() => [
    { label: '今天', value: { start: today, end: today } },
    { label: '近 7 天', value: { start: formatDate(addDays(new Date(), -6)), end: today } },
    { label: '本月', value: monthRange(0) },
    { label: '上月', value: monthRange(-1) },
  ], [today]);
  const activePreset = presets.find((p) => p.value.start === start && p.value.end === end)?.label;

  function applyPreset(next) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div className="date-range-filter" ref={ref}>
      <button type="button" className={`date-range-trigger ${start || end ? 'has-value' : ''}`} onClick={() => setOpen((value) => !value)} aria-label="选择时间范围" aria-expanded={open} aria-haspopup="dialog">
        <CalendarDays size={16} />
        <span>{label}</span>
      </button>
      {(start || end) && <button type="button" className="filter-clear-button date-clear-button" onClick={() => onChange({ start: '', end: '' })} aria-label="清空时间范围"><X size={14} /></button>}
      {open && (
        <div className="date-popover" role="dialog" aria-label="选择时间范围">
          <div className="date-presets">
            {presets.map((p) => (
              <button key={p.label} type="button" className={activePreset === p.label ? 'primary-button' : ''} onClick={() => applyPreset(p.value)}>{p.label}</button>
            ))}
          </div>
          <DayPicker mode="range" selected={selected} onSelect={updateRange} numberOfMonths={compact ? 1 : 2} captionLayout="dropdown" />
          <div className="date-popover-footer">
            <span>{label}</span>
            <button type="button" className="primary-button" onClick={() => setOpen(false)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
