export default function DateRangeFilter({ start = '', end = '', onChange }) {
  function updateStart(value) {
    onChange(value && end && value > end ? { start: value, end: value } : { start: value });
  }

  function updateEnd(value) {
    onChange(value && start && value < start ? { start: value, end: value } : { end: value });
  }

  return (
    <div className="date-range-filter">
      <label>开始日期<input type="date" value={start} max={end || undefined} onChange={(event) => updateStart(event.target.value)} /></label>
      <label>结束日期<input type="date" value={end} min={start || undefined} onChange={(event) => updateEnd(event.target.value)} /></label>
      {(start || end) && <button type="button" onClick={() => onChange({ start: '', end: '' })}>清空日期</button>}
    </div>
  );
}
