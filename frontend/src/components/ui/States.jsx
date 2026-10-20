export function EmptyState({ icon = '🖼', title, text, children }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">⚠️</div>
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function GridSkeleton({ count = 18 }) {
  return (
    <div className="skeleton-grid" aria-label="Loading photos">
      {Array.from({ length: count }, (_, i) => <div key={i} className="skeleton-tile" />)}
    </div>
  )
}

export function PageSkeleton() {
  return <div className="page-skeleton"><div className="skeleton-line w40" /><div className="skeleton-line" /><div className="skeleton-line w70" /></div>
}
