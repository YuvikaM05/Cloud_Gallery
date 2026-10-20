import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { errMsg } from '../services/api'
import { toast } from '../store'

export const PAGE_SIZE = 100

export function useInfinitePhotos(params) {
  return useInfiniteQuery({
    queryKey: ['photos', params],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api.get('/photos', { params: { ...params, page: pageParam, limit: PAGE_SIZE }, signal }).then((r) => r.data),
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    staleTime: 30_000,
  })
}

export const useAlbums = () =>
  useQuery({ queryKey: ['albums'], queryFn: () => api.get('/albums').then((r) => r.data), staleTime: 30_000 })

export const useStorage = (includeProvider = false) =>
  useQuery({
    queryKey: includeProvider ? ['storage', 'full'] : ['storage'],
    queryFn: () => api.get('/storage/summary', { params: { include_provider: includeProvider } }).then((r) => r.data),
    staleTime: 30_000,
  })

/** Apply a bulk action to cached pages immediately (optimistic UI). */
export function applyToCache(data, params, action, idSet, albumId) {
  if (!data?.pages) return data
  let removed = 0
  const pages = data.pages.map((p) => {
    let items = p.items
    const set = (patch) => items.map((i) => (idSet.has(i.id) ? { ...i, ...patch } : i))
    const drop = () => items.filter((i) => !idSet.has(i.id))
    switch (action) {
      case 'favorite': items = set({ favorite: true }); break
      case 'unfavorite': items = params.favorite ? drop() : set({ favorite: false }); break
      case 'delete': if (!params.deleted) items = drop(); break
      case 'restore':
      case 'delete_forever': if (params.deleted) items = drop(); break
      case 'move': items = params.album_id && params.album_id !== albumId ? drop() : set({ album_id: albumId }); break
      case 'remove_from_album': items = params.album_id ? drop() : set({ album_id: null }); break
      default: break
    }
    removed += p.items.length - items.length
    return { ...p, items }
  })
  return { ...data, pages: pages.map((p) => ({ ...p, total: Math.max(0, p.total - removed) })) }
}

export function useBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v) => api.post('/photos/bulk', { ids: v.ids, action: v.action, album_id: v.album_id }).then((r) => r.data),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['photos'] })
      const snapshot = qc.getQueriesData({ queryKey: ['photos'] })
      const idSet = new Set(v.ids)
      snapshot.forEach(([key, data]) => qc.setQueryData(key, applyToCache(data, key[1] || {}, v.action, idSet, v.album_id)))
      return { snapshot }
    },
    onError: (err, _v, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data))
      toast.error(errMsg(err))
    },
    onSettled: () => {
      ;['photos', 'albums', 'storage', 'analytics', 'shares'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    },
  })
}
