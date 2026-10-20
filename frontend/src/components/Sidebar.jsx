import { NavLink } from 'react-router-dom'
import { useStorage } from '../hooks/usePhotos'
import { formatBytes } from '../utils/format'
import '../styles/Sidebar.css'

const LINKS = [
  ['/', '🖼', 'Gallery'],
  ['/albums', '📁', 'Albums'],
  ['/favorites', '❤️', 'Favorites'],
  ['/shared', '🔗', 'Shared'],
  ['/bin', '🗑', 'Bin'],
  ['/cloud-storage', '☁️', 'Cloud Storage'],
  ['/storage-analytics', '📊', 'Storage Analytics'],
  ['/settings', '⚙️', 'Settings'],
]

export default function Sidebar() {
  const { data } = useStorage()
  const pct = data ? Math.min(100, (data.used_bytes / data.quota_bytes) * 100) : 0

  return (
    <aside className="sidebar">
      <nav aria-label="Main">
        {LINKS.map(([to, icon, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
            <span className="side-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      {data && (
        <div className="side-storage">
          <div className="bar"><div className={pct > 90 ? 'danger' : ''} style={{ width: `${pct}%` }} /></div>
          <small>{formatBytes(data.used_bytes)} of {formatBytes(data.quota_bytes, 0)} used</small>
        </div>
      )}
    </aside>
  )
}
