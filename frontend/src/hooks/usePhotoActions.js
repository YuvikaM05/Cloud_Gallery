import { useQueryClient } from '@tanstack/react-query'
import api, { errMsg } from '../services/api'
import { toast, useLightbox, useModal, useSelection } from '../store'
import { getExt, pluralPhotos, saveBlob, stripExt } from '../utils/format'
import { useBulk } from './usePhotos'

const refresh = (qc, keys) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))

/**
 * Every photo action lives here, so the card menu, page menu, selection toolbar,
 * lightbox and keyboard shortcuts all behave identically.
 */
export default function usePhotoActions({ albumId } = {}) {
  const qc = useQueryClient()
  const bulkMut = useBulk()
  const openModal = useModal((s) => s.open)
  const clear = useSelection((s) => s.clear)

  const bulk = async (action, ids, { album_id, silent = false, keepSelection = false } = {}) => {
    if (!ids.length) return toast.info('Select at least one photo')
    try {
      await bulkMut.mutateAsync({ ids, action, album_id })
    } catch {
      return
    }
    if (!keepSelection) clear()
    if (silent) return
    const n = pluralPhotos(ids.length)
    const messages = {
      favorite: `Added ${n} to favourites`,
      unfavorite: `Removed ${n} from favourites`,
      delete: `${n} moved to bin`,
      restore: `Restored ${n}`,
      delete_forever: `Deleted ${n} forever`,
      move: `Moved ${n} to the album`,
      remove_from_album: `Removed ${n} from the album`,
    }
    toast.success(messages[action], action === 'delete' ? { action: { label: 'Undo', onClick: () => bulk('restore', ids, { silent: true }) } } : undefined)
  }

  const confirm = (props) => openModal('confirm', props)

  const downloadZip = async (ids) => {
    if (ids.length > 500) return toast.error('ZIP downloads support up to 500 photos at a time')
    toast.info(`Preparing ZIP of ${pluralPhotos(ids.length)}...`)
    try {
      const { data } = await api.post('/photos/download-zip', { ids }, { responseType: 'blob' })
      saveBlob(data, 'cloudgallery-photos.zip')
      clear()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const download = async (photo) => {
    try {
      const { data } = await api.get(`/photos/${photo.id}/download`, { responseType: 'blob' })
      saveBlob(data, photo.name)
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const share = (ids) =>
    openModal('share', { payload: ids.length === 1 ? { kind: 'photo', photo_ids: ids } : { kind: 'photos', photo_ids: ids } })

  const pickAlbum = (ids) =>
    openModal('albumPicker', { onPick: (id) => bulk('move', ids, { album_id: id }) })

  const createAlbumFrom = (ids) =>
    openModal('prompt', {
      title: 'Create new album',
      label: 'Album name',
      confirmText: 'Create',
      onSubmit: async (name) => {
        await api.post('/albums', { name, photo_ids: ids })
        refresh(qc, ['albums', 'photos'])
        toast.success(`Album "${name}" created`)
        clear()
      },
    })

  const setCover = async (ids) => {
    if (ids.length !== 1) return toast.info('Select exactly one photo to use as the cover')
    try {
      await api.patch(`/albums/${albumId}`, { cover_photo_id: ids[0] })
      refresh(qc, ['albums'])
      toast.success('Album cover updated')
      clear()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  /** Runs an action key from utils/actions.js on a list of ids. */
  const run = (action, ids) => {
    switch (action) {
      case 'delete': return bulk('delete', ids)
      case 'favorite': return bulk('favorite', ids)
      case 'unfavorite': return bulk('unfavorite', ids)
      case 'restore': return bulk('restore', ids)
      case 'removeFromAlbum': return bulk('remove_from_album', ids)
      case 'deleteForever':
        if (!ids.length) return toast.info('Select at least one photo')
        return confirm({ title: 'Delete forever?', message: `${pluralPhotos(ids.length)} will be permanently deleted. This cannot be undone.`, confirmText: 'Delete forever', danger: true, onConfirm: () => bulk('delete_forever', ids) })
      case 'move':
        if (!ids.length) return toast.info('Select at least one photo')
        return pickAlbum(ids)
      case 'createAlbum':
        if (!ids.length) return toast.info('Select at least one photo')
        return createAlbumFrom(ids)
      case 'setCover': return setCover(ids)
      case 'zip':
        if (!ids.length) return toast.info('Select at least one photo')
        return downloadZip(ids)
      case 'share':
        if (!ids.length) return toast.info('Select at least one photo')
        return share(ids)
      default: return undefined
    }
  }

  const toggleFavorite = (photo) => bulk(photo.favorite ? 'unfavorite' : 'favorite', [photo.id], { silent: true, keepSelection: true })

  const rename = (photo) =>
    openModal('prompt', {
      title: 'Rename photo',
      label: 'Name',
      initial: stripExt(photo.name),
      confirmText: 'Rename',
      onSubmit: async (value) => {
        await api.patch(`/photos/${photo.id}`, { name: value + getExt(photo.name) })
        refresh(qc, ['photos', 'analytics'])
        toast.success('Renamed')
      },
    })

  const emptyBin = () =>
    confirm({
      title: 'Empty the bin?',
      message: 'Every photo in the bin will be permanently deleted.',
      confirmText: 'Empty bin',
      danger: true,
      onConfirm: async () => {
        try {
          const { data } = await api.delete('/bin')
          refresh(qc, ['photos', 'storage', 'analytics'])
          toast.success(`Deleted ${pluralPhotos(data.deleted)} forever`)
        } catch (e) {
          toast.error(errMsg(e))
        }
      },
    })

  return {
    bulk, run, toggleFavorite, download, downloadZip, share, rename, emptyBin, pickAlbum, createAlbumFrom,
    open: (photo) => useLightbox.getState().open(photo.id),
    edit: (photo) => openModal('editor', { photo }),
    details: (photo) => openModal('details', { photoId: photo.id }),
  }
}
