import { useState } from 'react'
import { useUploads } from '../store'

export default function UploadTray() {
  const items = useUploads((s) => s.items)
  const clearFinished = useUploads((s) => s.clearFinished)
  const [collapsed, setCollapsed] = useState(false)
  if (!items.length) return null

  const active = items.filter((i) => i.status === 'queued' || i.status === 'uploading').length
  const failed = items.filter((i) => i.status === 'error').length

  return (
    <div className="upload-tray" aria-live="polite">
      <div className="upload-head">
        <strong>{active ? `Uploading ${active} of ${items.length}` : `${items.length - failed} uploaded${failed ? `, ${failed} failed` : ''}`}</strong>
        <div>
          <button className="icon-btn" aria-label={collapsed ? 'Expand' : 'Collapse'} onClick={() => setCollapsed((c) => !c)}>{collapsed ? '▴' : '▾'}</button>
          {!active && <button className="icon-btn" aria-label="Close" onClick={() => { clearFinished(); setCollapsed(false) }}>✕</button>}
        </div>
      </div>
      {!collapsed && (
        <ul className="upload-list">
          {items.map((i) => (
            <li key={i.id} className={`upload-item ${i.status}`}>
              <span className="upload-name" title={i.name}>{i.name}</span>
              {i.status === 'error' ? <span className="upload-err">{i.error}</span>
                : i.status === 'done' ? <span className="upload-ok">✓</span>
                : <span className="upload-pct">{i.progress}%</span>}
              {(i.status === 'uploading' || i.status === 'queued') && <div className="upload-bar"><div style={{ width: `${i.progress}%` }} /></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
