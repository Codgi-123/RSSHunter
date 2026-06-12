import { CalendarDays } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDate } from '../utils/format';

function monthCells(month) {
  const base = month ? new Date(`${month}-01T00:00:00`) : new Date();
  const year = base.getFullYear();
  const monthIndex = base.getMonth();
  const first = new Date(year, monthIndex, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function monthBuckets(days) {
  const map = new Map();
  days.forEach((day) => {
    const month = day.date.slice(0, 7);
    const bucket = map.get(month) || { date: month, count: 0, items: [] };
    bucket.count += day.count || 0;
    bucket.items.push(...(day.items || []));
    map.set(month, bucket);
  });
  return map;
}

export default function CalendarGrid({ days = [], month, onMonthChange, onDayClick }) {
  const [mode, setMode] = useState('day');
  const dayMap = useMemo(() => Object.fromEntries(days.map((day) => [day.date, day])), [days]);
  const monthMap = useMemo(() => monthBuckets(days), [days]);
  const max = Math.max(1, ...days.map((day) => day.count || 0));
  const activeMonth = month || new Date().toISOString().slice(0, 7);
  const activeYear = Number(activeMonth.slice(0, 4));

  return (
    <section className="panel calendar-panel">
      <div className="panel-header calendar-header">
        <h2>日历视图</h2>
        <div className="calendar-tools">
          <div className="segmented-control"><button className={mode === 'day' ? 'active' : ''} onClick={() => setMode('day')}>按天</button><button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>按月</button></div>
          <label className="month-picker"><CalendarDays size={16} /><input type="month" value={activeMonth} onChange={(event) => onMonthChange?.(event.target.value)} /></label>
        </div>
      </div>
      {mode === 'day' ? <DayGrid activeMonth={activeMonth} dayMap={dayMap} max={max} onDayClick={onDayClick} /> : <MonthGrid year={activeYear} monthMap={monthMap} onMonthChange={onMonthChange} onDayClick={onDayClick} />}
    </section>
  );
}

function DayGrid({ activeMonth, dayMap, max, onDayClick }) {
  return (
    <>
      <div className="week-row">{['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>周{day}</span>)}</div>
      <div className="calendar-grid">
        {monthCells(activeMonth).map((date) => {
          const key = date.toISOString().slice(0, 10);
          const data = dayMap[key];
          const muted = key.slice(0, 7) !== activeMonth;
          const disabled = muted || !data;
          return (
            <button key={key} disabled={disabled} className={`calendar-cell ${muted ? 'muted' : ''} ${disabled ? 'disabled' : ''}`} onClick={() => data && onDayClick?.(data)}>
              <b>{date.getDate()}</b>
              {data && <em style={{ height: 22 + ((data.count || 0) / max) * 56 }}>{data.count}</em>}
              <small>{data?.items?.[0]?.title || formatDate(key)}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}

function MonthGrid({ year, monthMap, onMonthChange, onDayClick }) {
  return (
    <div className="month-grid">
      {Array.from({ length: 12 }, (_, index) => {
        const month = `${year}-${String(index + 1).padStart(2, '0')}`;
        const data = monthMap.get(month);
        return (
          <button key={month} disabled={!data} className={`month-cell ${!data ? 'disabled' : ''}`} onClick={() => { onMonthChange?.(month); onDayClick?.({ ...data, date: `${month} 月` }); }}>
            <b>{index + 1} 月</b>
            <span>{data ? `${data.count} 条动态` : '暂无动态'}</span>
            <small>{data?.items?.[0]?.title || `${year} 年 ${index + 1} 月`}</small>
          </button>
        );
      })}
    </div>
  );
}
