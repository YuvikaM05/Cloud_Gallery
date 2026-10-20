import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* ---------------- UI preferences (remembered between launches) ---------------- */
export const useUI = create(
  persist(
    (set) => ({
      viewMode: 'medium',
      sortBy: 'date-new',
      theme: 'system',
      search: '',
      setViewMode: (viewMode) => set({ viewMode }),
      setSortBy: (sortBy) => set({ sortBy }),
      setTheme: (theme) => set({ theme }),
      setSearch: (search) => set({ search }),
      applySettings: (s = {}) =>
        set({
          ...(s.default_view && { viewMode: s.default_view }),
          ...(s.default_sort && { sortBy: s.default_sort }),
          ...(s.theme && { theme: s.theme }),
        }),
    }),
    {
      name: 'cloudgallery-ui',
      partialize: (s) => ({ viewMode: s.viewMode, sortBy: s.sortBy, theme: s.theme }),
    },
  ),
)

/* ---------------- Massive selection ---------------- */
export const useSelection = create((set) => ({
  selected: new Set(),
  anchor: null, // last clicked id -> start of a shift-range
  mode: false, // true while "pick an action, tick photos, press Done" flow is running
  action: null,

  toggle: (id) =>
    set((s) => {
      const next = new Set(s.selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selected: next, anchor: id }
    }),

  /** Shift+click: select everything between the anchor and `id` in the visible order. */
  selectRange: (orderedIds, id) =>
    set((s) => {
      const a = s.anchor ? orderedIds.indexOf(s.anchor) : -1
      const b = orderedIds.indexOf(id)
      const next = new Set(s.selected)
      if (a < 0 || b < 0) {
        next.add(id)
        return { selected: next, anchor: id }
      }
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(orderedIds[i])
      return { selected: next }
    }),

  setMany: (ids, on = true) =>
    set((s) => {
      const next = new Set(s.selected)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return { selected: next }
    }),

  replace: (ids) => set({ selected: new Set(ids) }),
  selectAll: (ids) => set({ selected: new Set(ids) }),
  startAction: (action) => set({ mode: true, action, selected: new Set(), anchor: null }),
  clear: () => set({ selected: new Set(), anchor: null, mode: false, action: null }),
}))

/* ---------------- Modals (one at a time) ---------------- */
export const useModal = create((set) => ({
  modal: null,
  open: (type, props = {}) => set({ modal: { type, props } }),
  close: () => set({ modal: null }),
}))

/* ---------------- Lightbox ---------------- */
export const useLightbox = create((set) => ({
  id: null,
  open: (id) => set({ id }),
  close: () => set({ id: null }),
}))

/* ---------------- Toasts ---------------- */
let toastId = 0
export const useToasts = create((set, get) => ({
  toasts: [],
  push: (message, opts = {}) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, message, type: opts.type || 'info', action: opts.action }] }))
    setTimeout(() => get().dismiss(id), opts.duration ?? (opts.action ? 7000 : 4000))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  info: (m, o) => useToasts.getState().push(m, { ...o, type: 'info' }),
  success: (m, o) => useToasts.getState().push(m, { ...o, type: 'success' }),
  error: (m, o) => useToasts.getState().push(m, { ...o, type: 'error', duration: 6000 }),
}

/* ---------------- Upload tray ---------------- */
let uploadId = 0
export const useUploads = create((set) => ({
  items: [],
  add: (name) => {
    const id = ++uploadId
    set((s) => ({ items: [...s.items, { id, name, progress: 0, status: 'queued', error: null }] }))
    return id
  },
  update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  clearFinished: () => set((s) => ({ items: s.items.filter((i) => i.status === 'queued' || i.status === 'uploading') })),
}))
