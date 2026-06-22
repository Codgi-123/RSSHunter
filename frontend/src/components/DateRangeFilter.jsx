import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from '@daypicker/react';
import { zhCN } from '@daypicker/react/locale';
import '@daypicker/react/style.css';
import dayjs from 'dayjs';
import { CalendarDays, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const fmt = (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '');
const parseDate = (value) => (value ? dayjs(value).toDate() : undefined);

function monthRange(offset = 0) {
  const month = dayjs().add(offset, 'month');
  return { start: month.startOf('month').format('YYYY-MM-DD'), end: month.endOf('month').format('YYYY-MM-DD') };
}

export default function DateRangeFilter({ start = '', end = '', onChange }) {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
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

  function updateRange(range) {
    onChange({ start: fmt(range?.from), end: fmt(range?.to) });
  }

  const today = dayjs().format('YYYY-MM-DD');
  const presets = useMemo(() => [
    { label: '今天', value: { start: today, end: today } },
    { label: '近 7 天', value: { start: dayjs().subtract(6, 'day').format('YYYY-MM-DD'), end: today } },
    { label: '本月', value: monthRange(0) },
    { label: '上月', value: monthRange(-1) },
  ], [today]);
  const activePreset = presets.find((p) => p.value.start === start && p.value.end === end)?.label;

  function applyPreset(next) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className="date-range-filter">
        <Popover.Trigger asChild>
          <button type="button" className={`date-range-trigger ${start || end ? 'has-value' : ''}`} aria-label="选择时间范围">
            <CalendarDays size={16} />
            <span>{label}</span>
          </button>
        </Popover.Trigger>
        {(start || end) && <button type="button" className="filter-clear-button date-clear-button" onClick={() => onChange({ start: '', end: '' })} aria-label="清空时间范围"><X size={14} /></button>}
      </div>
      <Popover.Portal>
        <Popover.Content className="date-popover" role="dialog" aria-label="选择时间范围" align="start" sideOffset={8}>
          <div className="date-presets">
            {presets.map((p) => (
              <button key={p.label} type="button" className={activePreset === p.label ? 'primary-button' : ''} onClick={() => applyPreset(p.value)}>{p.label}</button>
            ))}
          </div>
          <DayPicker mode="range" selected={selected} onSelect={updateRange} numberOfMonths={compact ? 1 : 2} captionLayout="dropdown" locale={zhCN} />
          <div className="date-popover-footer">
            <span>{label}</span>
            <button type="button" className="primary-button" onClick={() => setOpen(false)}>关闭</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
