import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '../ui/Modal'
import api, { errMsg } from '../../services/api'
import { useInfinitePhotos } from '../../hooks/usePhotos'
import { toast } from '../../store'
import { absUrl, pluralPhotos } from '../../utils/format'

/** Pick photos from the whole library and add them to the current album. */
export default function AddPhotosModal({ albumId, onClose }) {
  const qc = useQueryClient()
  const q = useInfinitePhotos({ deleted: false, sort: 'date-new' })
  const [picked, setPicked] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const photos = useMemo(
    () => (q.data?.pages.flatMap((p) => p.items) ?? []).filter((p) => p.album_id !== albumId),
    [q.data, albumId],
  )

  const toggle = (id) => setPicked((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const add = async () => {
    setBusy(true)
    try {
      await api.post(`/albums/${albumId}/photos`, { photo_ids: [...picked] })
      ;['photos', 'albums'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      toast.success(`Added ${pluralPhotos(picked.size)}`)
      onClose()
    } catch (e) {
      toast.error(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <Modal title="Add photos to album" onClose={onClose} wide
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!picked.size || busy} onClick={add}>Add {picked.size || ''} {picked.size ? 'selected' : ''}</button>
      </>}>
      {q.isLoading && <p className="muted">Loading...</p>}
      {!q.isLoading && photos.length === 0 && <p className="muted">All your photos are already in this album.</p>}
      <div className="mini-grid">
        {photos.map((p) => (
          <button key={p.id} className={`mini-tile${picked.has(p.id) ? ' on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={picked.has(p.id)}>
            <img src={absUrl(p.thumb_url)} alt={p.name} loading="lazy" draggable={false} />
            <span className="mini-check">{picked.has(p.id) ? '✓' : ''}</span>
          </button>
        ))}
      </div>
      {q.hasNextPage && (
        <div className="center"><button className="btn" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>Load more</button></div>
      )}
    </Modal>
  )
}
