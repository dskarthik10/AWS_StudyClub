import './EmptyState.css';

export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-message">{message}</p>
      {action && (
        <button className="empty-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
