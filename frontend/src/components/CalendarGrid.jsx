import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function CalendarGrid({ days = [], monthlyDays = [], month, onMonthChange, onDayClick, onMonthClick }) {
  const [mode, setMode] = useState('day');
  const [selectedKey, setSelectedKey] = useState(null);
  const dayMap = useMemo(() => Object.fromEntries(days.map((day) => [day.date, day])), [days]);
  const monthMap = useMemo(() => Object.fromEntries(monthlyDays.map((m) => [m.date, m])), [monthlyDays]);
  const activeMonth = month || new Date().toISOString().slice(0, 7);
  const activeYear = Number(activeMonth.slice(0, 4));

  useEffect(() => { setSelectedKey(null); }, [activeMonth, mode]);

  function handleDay(key, data) {
    setSelectedKey(key);
    onDayClick?.(data);
  }

  function pickMonth(monthKey, data) {
    setSelectedKey(monthKey);
    onMonthClick?.(monthKey, data);
  }

  return (
    <div className="calendar-panel">
      <div className="calendar-toolbar">
        <div className="segmented-control" role="group" aria-label="日历粒度">
          <button type="button" className={mode === 'day' ? 'active' : ''} aria-pressed={mode === 'day'} onClick={() => setMode('day')}>按天</button>
          <button type="button" className={mode === 'month' ? 'active' : ''} aria-pressed={mode === 'month'} onClick={() => setMode('month')}>按月</button>
        </div>
        <input type="month" className="month-picker-trigger" aria-label="选择月份" value={activeMonth} onChange={(e) => e.target.value && onMonthChange(e.target.value)} />
      </div>
      {mode === 'day'
        ? <DayGrid activeMonth={activeMonth} dayMap={dayMap} selectedKey={selectedKey} onDayClick={handleDay} />
        : <MonthGrid year={activeYear} monthMap={monthMap} selectedKey={selectedKey} onPickMonth={pickMonth} />}
    </div>
  );
}

function DayGrid({ activeMonth, dayMap, selectedKey, onDayClick }) {
  const first = dayjs(`${activeMonth}-01`);
  const firstWeekday = first.day();
  const daysInMonth = first.daysInMonth();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <div className="week-row">{WEEKDAYS.map((d) => <span key={d}>周{d}</span>)}</div>
      <div className="calendar-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} className="calendar-cell empty" />;
          const key = `${activeMonth}-${String(d).padStart(2, '0')}`;
          const data = dayMap[key];
          const hasData = !!data && data.count > 0;
          const isSelected = key === selectedKey && hasData;
          return (
            <button
              key={key}
              type="button"
              disabled={!hasData}
              aria-label={`${key}，${data?.count || 0} 条动态`}
              className={`calendar-cell ${isSelected ? 'selected' : ''} ${hasData && !isSelected ? 'has-count' : ''} ${!hasData ? 'empty' : ''}`}
              onClick={() => hasData && onDayClick(key, data)}
            >
              <span className={`cal-day-num ${isSelected ? 'selected' : ''} ${hasData ? 'has-count' : ''}`}>{d}</span>
              {hasData && !isSelected && <span className="cal-day-count">+{data.count >= 1000 ? '999+' : data.count}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function MonthGrid({ year, monthMap, selectedKey, onPickMonth }) {
  return (
    <div className="month-grid">
      {Array.from({ length: 12 }, (_, index) => {
        const month = `${year}-${String(index + 1).padStart(2, '0')}`;
        const data = monthMap[month];
        const hasData = !!data && data.count > 0;
        const isSelected = month === selectedKey;
        return (
          <button
            key={month}
            type="button"
            disabled={!hasData}
            aria-label={`${month}，${data?.count || 0} 条动态`}
            className={`month-cell ${hasData ? 'has-count' : 'empty'} ${isSelected ? 'selected' : ''}`}
            onClick={() => hasData && onPickMonth(month, data)}
          >
            <span className="month-cell-label">{index + 1} 月</span>
            <span className={`month-cell-count ${hasData ? 'has-count' : ''}`}>{hasData ? `+${data.count}` : '—'}</span>
          </button>
        );
      })}
    </div>
  );
}
