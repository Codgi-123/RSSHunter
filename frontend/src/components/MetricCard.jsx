export default function MetricCard({ icon: Icon, label, value, hint, tone = 'blue', delta }) {
  return (
    <article className="metric-card">
      <div className={`metric-orb tone-${tone}`}><Icon size={30} /></div>
      <div className="metric-body">
        <p>{label}</p>
        <strong>{value}</strong>
        {delta && <em>{delta}</em>}
        <span>{hint}</span>
      </div>
    </article>
  );
}
