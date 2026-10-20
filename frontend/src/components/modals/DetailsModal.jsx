import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Modal from '../ui/Modal'
import api, { errMsg } from '../../services/api'
import { toast } from '../../store'
import { absUrl, formatBytes, formatDateTime } from '../../utils/format'

export default function DetailsModal({ photoId, onClose }) {
  const qc = useQueryClient()
  const { data: p, isLoading, error } = useQuery({
    queryKey: ['photo', photoId],
    queryFn: () => api.get(`/photos/${photoId}`).then((r) => r.data),
  })
  const [tags, setTags] = useState(null)

  const saveTags = async () => {
    try {
      await api.patch(`/photos/${photoId}`, { tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })
      qc.invalidateQueries({ queryKey: ['photos'] })
      qc.invalidateQueries({ queryKey: ['photo', photoId] })
      toast.success('Tags saved')
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const rows = p && [
    ['Name', p.name],
    ['Size', formatBytes(p.size)],
    ['Dimensions', p.width ? `${p.width} × ${p.height}` : '-'],
    ['Type', p.mime],
    ['Taken', formatDateTime(p.taken_at)],
    ['Uploaded', formatDateTime(p.created_at)],
    ['Album', p.album_name || '-'],
    ['Stored on', p.provider],
    ['SHA-256', p.hash ? `${p.hash.slice(0, 16)}…` : '-'],
    ...Object.entries(p.exif || {}),
  ]

  return (
    <Modal title="Details" onClose={onClose} wide>
      {isLoading && <p className="muted">Loading...</p>}
      {error && <p className="form-error">{errMsg(error)}</p>}
      {p && (
        <div className="details">
          <img className="details-img" src={absUrl(p.thumb_url)} alt={p.name} />
          <dl className="details-list">
            {rows.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
            <div>
              <dt>Cloud URL</dt>
              <dd className="url-cell">
                <input readOnly value={absUrl(p.url)} onFocus={(e) => e.target.select()} />
                <button className="btn small" onClick={() => navigator.clipboard.writeText(absUrl(p.url)).then(() => toast.success('URL copied'))}>Copy</button>
              </dd>
            </div>
            <div>
              <dt>Tags</dt>
              <dd className="url-cell">
                <input placeholder="beach, family, 2026" value={tags ?? (p.tags || []).join(', ')} onChange={(e) => setTags(e.target.value)} />
                <button className="btn small" disabled={tags === null} onClick={saveTags}>Save</button>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  )
}
