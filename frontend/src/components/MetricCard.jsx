export default function MetricCard({ icon: Icon, label, value, hint, tone = 'blue', delta, onClick }) {
  const Card = onClick ? 'button' : 'article';

  return (
    <Card className={`metric-card${onClick ? ' metric-card-button' : ''}`} type={onClick ? 'button' : undefined} onClick={onClick} aria-label={onClick ? `${label}，查看详情` : undefined}>
      <div className={`metric-orb tone-${tone}`}><Icon size={30} /></div>
      <div className="metric-body">
        <p>{label}</p>
        <strong>{value}</strong>
        {delta && <em>{delta}</em>}
        <span>{hint}</span>
      </div>
    </Card>
  );
}
