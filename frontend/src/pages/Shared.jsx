import { useQuery, useQueryClient } from '@tanstack/react-query'
import { EmptyState, ErrorState, PageSkeleton } from '../components/ui/States'
import api, { errMsg } from '../services/api'
import { API_BASE } from '../services/config'
import { toast, useModal } from '../store'
import { formatDateTime } from '../utils/format'
import '../styles/pages.css'

export default function Shared() {
  const qc = useQueryClient()
  const openModal = useModal((s) => s.open)
  const { data: shares, isLoading, error, refetch } = useQuery({ queryKey: ['shares'], queryFn: () => api.get('/share').then((r) => r.data) })

  const link = (s) => `${API_BASE}${s.path}`
  const copy = (s) => navigator.clipboard.writeText(link(s)).then(() => toast.success('Link copied'))
  const revoke = (s) =>
    openModal('confirm', {
      title: 'Revoke this link?', message: 'People who have the link will no longer be able to open it.',
      confirmText: 'Revoke', danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/share/${s.id}`)
          qc.invalidateQueries({ queryKey: ['shares'] })
          qc.invalidateQueries({ queryKey: ['analytics'] })
          toast.success('Link revoked')
        } catch (e) { toast.error(errMsg(e)) }
      },
    })

  return (
    <section className="page">
      <div className="page-head"><div><h2>Shared</h2><p className="muted">Links you created. Anyone with a link can view - no login needed.</p></div></div>
      {isLoading && <PageSkeleton />}
      {error && <ErrorState message={errMsg(error)} onRetry={refetch} />}
      {shares?.length === 0 && <EmptyState icon="🔗" title="Nothing shared yet" text="Use ⋮ → Share on a photo or an album to create a link." />}
      {shares?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>What</th><th>Views</th><th>Created</th><th>Expires</th><th>Status</th><th /></tr></thead>
            <tbody>
              {shares.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.title}</strong><div className="muted">{s.kind}</div></td>
                  <td>{s.views}</td>
                  <td>{formatDateTime(s.created_at)}</td>
                  <td>{s.expires_at ? formatDateTime(s.expires_at) : 'Never'}</td>
                  <td><span className={`pill ${s.expired ? 'bad' : 'good'}`}>{s.expired ? 'Expired' : 'Active'}</span></td>
                  <td className="row-actions">
                    <button className="btn small" disabled={s.expired} onClick={() => copy(s)}>Copy link</button>
                    <a className="btn small" href={link(s)} target="_blank" rel="noreferrer" aria-disabled={s.expired}>Open</a>
                    <button className="btn small danger-text" onClick={() => revoke(s)}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
