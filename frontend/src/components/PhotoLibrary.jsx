import { useEffect, useMemo, useState } from 'react'
import PhotoGrid from './PhotoGrid'
import GalleryMenu from './GalleryMenu'
import SelectionToolbar from './SelectionToolbar'
import Lightbox from './Lightbox'
import { EmptyState, ErrorState, GridSkeleton } from './ui/States'
import api, { errMsg } from '../services/api'
import useDebounce from '../hooks/useDebounce'
import usePhotoActions from '../hooks/usePhotoActions'
import useShortcuts from '../hooks/useShortcuts'
import { useInfinitePhotos } from '../hooks/usePhotos'
import { toast, useLightbox, useModal, useSelection, useUI } from '../store'

/**
 * The reusable "page full of photos": Gallery, Favorites, Bin and Album detail all use it.
 * It owns: data loading, search/sort, selection toolbar, ⋮ menu, shortcuts, lightbox.
 */
export default function PhotoLibrary({
  page, title, subtitle, filters = {}, isBin = false, album = null, headerExtra = null,
  emptyIcon = '🖼', emptyTitle = 'No photos yet', emptyText = 'Upload photos to see them here.',
}) {
  const search = useUI((s) => s.search)
  const sortBy = useUI((s) => s.sortBy)
  const viewMode = useUI((s) => s.viewMode)
  const q = useDebounce(search.trim(), 300)

  const filterKey = JSON.stringify(filters)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const params = useMemo(() => ({ ...filters, sort: sortBy, q: q || undefined }), [filterKey, sortBy, q])

  const query = useInfinitePhotos(params)
  const photos = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  const total = query.data?.pages[0]?.total ?? 0
  const actions = usePhotoActions({ albumId: album?.id })
  const [selectingAll, setSelectingAll] = useState(false)

  const modalOpen = useModal((s) => !!s.modal)
  const lightboxOpen = useLightbox((s) => !!s.id)

  // leaving the page clears the selection
  useEffect(() => () => useSelection.getState().clear(), [page, album?.id])

  const selectAll = async () => {
    setSelectingAll(true)
    try {
      const { data } = await api.get('/photos/ids', { params })
      useSelection.getState().selectAll(data.ids)
    } catch (e) {
      toast.error(errMsg(e))
    }
    setSelectingAll(false)
  }

  const shortcuts = useMemo(() => {
    const ids = () => [...useSelection.getState().selected]
    const del = () => ids().length && actions.run(isBin ? 'deleteForever' : 'delete', ids())
    return {
      delete: del,
      backspace: del,
      f: () => ids().length && !isBin && actions.run(page === 'favorites' ? 'unfavorite' : 'favorite', ids()),
      'mod+a': selectAll,
      escape: () => useSelection.getState().clear(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, isBin, params])
  useShortcuts(shortcuts, !modalOpen && !lightboxOpen)

  const groupByDate = !isBin && sortBy.startsWith('date')

  let body
  if (query.isLoading) body = <GridSkeleton />
  else if (query.isError) body = <ErrorState message={errMsg(query.error)} onRetry={() => query.refetch()} />
  else if (photos.length === 0) {
    body = q
      ? <EmptyState icon="🔍" title="No results" text={`Nothing matches "${q}".`} />
      : <EmptyState icon={emptyIcon} title={emptyTitle} text={emptyText} />
  } else {
    body = (
      <PhotoGrid
        photos={photos} viewMode={viewMode} groupByDate={groupByDate} isBin={isBin}
        hasMore={!!query.hasNextPage} fetchNext={query.fetchNextPage} isFetchingNext={query.isFetchingNextPage}
        actions={actions}
      />
    )
  }

  return (
    <section className="library">
      <div className="library-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">{subtitle ?? `${total.toLocaleString()} photo${total === 1 ? '' : 's'}${q ? ` matching "${q}"` : ''}`}</p>
        </div>
        <div className="library-head-actions">
          {headerExtra}
          <GalleryMenu page={page} album={album} actions={actions} onSelectAll={selectAll} hasPhotos={photos.length > 0} />
        </div>
      </div>
      <SelectionToolbar page={page} total={total} actions={actions} onSelectAll={selectAll} selectingAll={selectingAll} />
      {body}
      <Lightbox photos={photos} hasMore={!!query.hasNextPage} fetchNext={query.fetchNextPage} isBin={isBin} actions={actions} />
    </section>
  )
}
