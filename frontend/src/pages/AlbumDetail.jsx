import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PhotoLibrary from '../components/PhotoLibrary'
import { ErrorState, PageSkeleton } from '../components/ui/States'
import api, { errMsg } from '../services/api'
import { toast, useModal } from '../store'
import { pluralPhotos } from '../utils/format'

export default function AlbumDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const openModal = useModal((s) => s.open)
  const { data: album, isLoading, error } = useQuery({
    queryKey: ['album', id],
    queryFn: () => api.get(`/albums/${id}`).then((r) => r.data),
  })
  const filters = useMemo(() => ({ album_id: id }), [id])

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState message={errMsg(error)} onRetry={() => nav('/albums')} />

  const refresh = () => ['albums', 'album'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
  const controls = {
    id,
    rename: () => openModal('prompt', {
      title: 'Rename album', label: 'Album name', initial: album.name, confirmText: 'Rename',
      onSubmit: async (name) => { await api.patch(`/albums/${id}`, { name }); refresh() },
    }),
    remove: () => openModal('confirm', {
      title: `Delete "${album.name}"?`, message: 'The album is deleted but its photos stay in your gallery.',
      confirmText: 'Delete album', danger: true,
      onConfirm: async () => {
        await api.delete(`/albums/${id}`)
        refresh()
        qc.invalidateQueries({ queryKey: ['photos'] })
        toast.success('Album deleted')
        nav('/albums')
      },
    }),
  }

  return (
    <PhotoLibrary
      page="album"
      title={album.name}
      subtitle={pluralPhotos(album.photo_count)}
      filters={filters}
      album={{ ...album, ...controls }}
      headerExtra={<Link className="btn ghost small" to="/albums">← Albums</Link>}
      emptyIcon="📁"
      emptyTitle="This album is empty"
      emptyText="Open the ⋮ menu and choose “Add photos”."
    />
  )
}
