export default function LoadingState({ title = '正在加载数据...', rows = 3, compact = false }) {
  return (
    <section className={`panel loading-panel ${compact ? 'compact-state' : ''}`} role="status" aria-live="polite" aria-busy="true">
      <span className="loading-label">{title}</span>
      <div className="skeleton-stack" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <span className="skeleton-line" key={index} />
        ))}
      </div>
    </section>
  );
}
