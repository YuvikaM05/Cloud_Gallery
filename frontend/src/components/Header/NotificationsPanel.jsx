import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Menu } from '../ui/Menu'
import api from '../../services/api'
import { formatDateTime } from '../../utils/format'

const ICONS = { upload: '⬆️', share_viewed: '👀', bin_warning: '⏳', info: '🔔' }

export default function NotificationsPanel() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30_000,
  })
  const unread = data?.unread ?? 0

  const markAll = async () => {
    await api.post('/notifications/read-all')
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <Menu
      button={
        <button className="icon-btn bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          🔔{unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
      }
    >
      <div className="notif-panel">
        <div className="notif-head">
          <strong>Notifications</strong>
          <button className="link-btn" disabled={!unread} onClick={markAll}>Mark all read</button>
        </div>
        {!data?.items?.length && <p className="muted notif-empty">You are all caught up.</p>}
        {data?.items?.map((n) => (
          <div key={n.id} className={`notif${n.read ? '' : ' unread'}`}>
            <span className="notif-icon">{ICONS[n.kind] || ICONS.info}</span>
            <div>
              <div className="notif-title">{n.title}</div>
              {n.body && <div className="notif-body">{n.body}</div>}
              <div className="notif-time">{formatDateTime(n.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </Menu>
  )
}
