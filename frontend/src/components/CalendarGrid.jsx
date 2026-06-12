import { CalendarDays } from 'lucide-react';
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

export default function CalendarGrid({ days = [], month, onMonthChange, onDayClick }) {
  const dayMap = Object.fromEntries(days.map((day) => [day.date, day]));
  const max = Math.max(1, ...days.map((day) => day.count || 0));
  const activeMonth = month || new Date().toISOString().slice(0, 7);
  return (
    <section className="panel calendar-panel">
      <div className="panel-header">
        <h2>日历视图</h2>
        <label className="month-picker"><CalendarDays size={16} /><input type="month" value={activeMonth} onChange={(event) => onMonthChange?.(event.target.value)} /></label>
      </div>
      <div className="week-row">{['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>周{day}</span>)}</div>
      <div className="calendar-grid">
        {monthCells(activeMonth).map((date) => {
          const key = date.toISOString().slice(0, 10);
          const data = dayMap[key];
          const muted = key.slice(0, 7) !== activeMonth;
          return (
            <button key={key} className={`calendar-cell ${muted ? 'muted' : ''}`} onClick={() => data && onDayClick?.(data)}>
              <b>{date.getDate()}</b>
              {data && <em style={{ height: 22 + ((data.count || 0) / max) * 56 }}>{data.count}</em>}
              <small>{data?.items?.[0]?.title || formatDate(key)}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
