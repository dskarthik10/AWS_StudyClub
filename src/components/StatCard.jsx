import './StatCard.css';

export default function StatCard({ title, value, icon, color, trend }) {
  return (
    <div className="stat-card" style={{ '--card-accent': color }}>
      <div className="stat-icon" style={{ background: `${color}15` }}>
        {icon}
      </div>
      <div className="stat-content">
        <p className="stat-title">{title}</p>
        <h3 className="stat-value">{value}</h3>
        {trend && (
          <span className={`stat-trend ${trend.direction}`}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
