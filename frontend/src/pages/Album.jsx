import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Menu, MenuDivider, MenuItem } from '../components/ui/Menu'
import { EmptyState, PageSkeleton } from '../components/ui/States'
import api from '../services/api'
import { useAlbums } from '../hooks/usePhotos'
import { toast, useModal } from '../store'
import { absUrl, formatBytes, pluralPhotos } from '../utils/format'
import '../styles/pages.css'

export default function Albums() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const openModal = useModal((s) => s.open)
  const { data: albums, isLoading } = useAlbums()
  const refresh = () => qc.invalidateQueries({ queryKey: ['albums'] })

  const create = () =>
    openModal('prompt', {
      title: 'Create new album', label: 'Album name', confirmText: 'Create',
      onSubmit: async (name) => {
        const { data } = await api.post('/albums', { name })
        refresh()
        toast.success(`Album "${name}" created`)
        nav(`/albums/${data.id}`)
      },
    })

  const rename = (a) =>
    openModal('prompt', {
      title: 'Rename album', label: 'Album name', initial: a.name, confirmText: 'Rename',
      onSubmit: async (name) => { await api.patch(`/albums/${a.id}`, { name }); refresh() },
    })

  const remove = (a) =>
    openModal('confirm', {
      title: `Delete "${a.name}"?`, message: 'The album is deleted but its photos stay in your gallery.',
      confirmText: 'Delete album', danger: true,
      onConfirm: async () => { await api.delete(`/albums/${a.id}`); refresh(); qc.invalidateQueries({ queryKey: ['photos'] }); toast.success('Album deleted') },
    })

  return (
    <section className="page">
      <div className="page-head">
        <div><h2>Albums</h2><p className="muted">{albums ? `${albums.length} album${albums.length === 1 ? '' : 's'}` : ' '}</p></div>
        <div className="page-head-actions">
          <button className="btn primary" onClick={create}>➕ New album</button>
          <Menu button={<button className="page-menu-btn" aria-label="Page options">⋮</button>}>
            <MenuItem icon="➕" onClick={create}>Create Album</MenuItem>
          </Menu>
        </div>
      </div>

      {isLoading && <PageSkeleton />}
      {albums && albums.length === 0 && (
        <EmptyState icon="📁" title="No albums yet" text="Group photos into albums to find them faster.">
          <button className="btn primary" onClick={create}>Create your first album</button>
        </EmptyState>
      )}

      <div className="album-grid">
        {albums?.map((a) => (
          <div key={a.id} className="album-card" onClick={() => nav(`/albums/${a.id}`)} role="link" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && nav(`/albums/${a.id}`)}>
            <div className="album-cover">
              {a.cover_url ? <img src={absUrl(a.cover_url)} alt="" loading="lazy" /> : <span>📁</span>}
            </div>
            <div className="album-meta">
              <div>
                <strong>{a.name}</strong>
                <div className="muted">{pluralPhotos(a.photo_count)} · {formatBytes(a.total_size)}</div>
              </div>
              <Menu button={<button className="icon-btn" aria-label={`Options for ${a.name}`}>⋮</button>}>
                <MenuItem icon="✏️" onClick={() => rename(a)}>Rename</MenuItem>
                <MenuItem icon="📤" onClick={() => openModal('share', { payload: { kind: 'album', album_id: a.id } })}>Share</MenuItem>
                <MenuDivider />
                <MenuItem icon="🗑" danger onClick={() => remove(a)}>Delete album</MenuItem>
              </Menu>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
