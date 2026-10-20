import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PhotoCard from './PhotoCard'
import { useSelection } from '../store'
import { groupPhotos } from '../utils/dates'
import '../styles/PhotoGrid.css'

const PAD = 16
const GAP = 4
const HEADER_H = 52
const MIN_TILE = { large: 320, medium: 200, small: 130 }

/**
 * Virtualised grid: only the rows near the viewport exist in the DOM, so thousands of photos stay smooth.
 * Selection: click / Ctrl+click / Shift+click range / drag-rectangle / group checkbox.
 */
export default function PhotoGrid({ photos, viewMode, groupByDate, isBin, hasMore, fetchNext, isFetchingNext, actions }) {
  const scrollRef = useRef(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [scrollTop, setScrollTop] = useState(0)
  const [rect, setRect] = useState(null)
  const selected = useSelection((s) => s.selected)
  const mode = useSelection((s) => s.mode)
  const selectionActive = selected.size > 0 || mode

  // ---- measure the scroll area
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---- layout
  const contentW = Math.max(0, dims.w - PAD * 2)
  const cols = Math.max(1, Math.floor((contentW + GAP) / (MIN_TILE[viewMode] + GAP)))
  const tile = contentW ? Math.floor((contentW - GAP * (cols - 1)) / cols) : 0

  const { rows, totalHeight } = useMemo(() => {
    const out = []
    let top = 8
    const pushPhotos = (list) => {
      for (let i = 0; i < list.length; i += cols) {
        out.push({ type: 'row', top, photos: list.slice(i, i + cols) })
        top += tile + GAP
      }
    }
    if (groupByDate) {
      for (const g of groupPhotos(photos)) {
        out.push({ type: 'header', top, label: g.label, ids: g.photos.map((p) => p.id), key: g.key })
        top += HEADER_H
        pushPhotos(g.photos)
      }
    } else {
      pushPhotos(photos)
    }
    return { rows: out, totalHeight: top + 24 }
  }, [photos, cols, tile, groupByDate])

  const orderedIds = useMemo(() => photos.map((p) => p.id), [photos])
  const layout = useRef({ rows: [], tile: 0, orderedIds: [] })
  useEffect(() => {
    layout.current = { rows, tile, orderedIds }
  })

  // ---- virtualisation + infinite loading
  const onScroll = useCallback((e) => setScrollTop(e.currentTarget.scrollTop), [])
  const overscan = 600
  const visible = useMemo(
    () => rows.filter((r) => {
      const h = r.type === 'header' ? HEADER_H : tile
      return r.top + h >= scrollTop - overscan && r.top <= scrollTop + dims.h + overscan
    }),
    [rows, scrollTop, dims.h, tile],
  )

  useEffect(() => {
    if (hasMore && !isFetchingNext && dims.h && scrollTop + dims.h > totalHeight - 900) fetchNext()
  }, [scrollTop, dims.h, totalHeight, hasMore, isFetchingNext, fetchNext])

  // ---- clicking
  const suppressClick = useRef(false)

  const onTileClick = (photo, e) => {
    if (suppressClick.current) return
    const sel = useSelection.getState()
    const active = sel.selected.size > 0 || sel.mode
    if (e.shiftKey && (active || sel.anchor)) return sel.selectRange(layout.current.orderedIds, photo.id)
    if (e.ctrlKey || e.metaKey || active) return sel.toggle(photo.id)
    return actions.open(photo)
  }

  const onCheck = (photo, e) => {
    const sel = useSelection.getState()
    if (e.shiftKey) sel.selectRange(layout.current.orderedIds, photo.id)
    else sel.toggle(photo.id)
  }

  const toggleGroup = (ids) => {
    const sel = useSelection.getState()
    const all = ids.every((id) => sel.selected.has(id))
    sel.setMany(ids, !all)
  }

  // ---- drag-rectangle selection
  const hitTest = (a, b) => {
    const { rows: rs, tile: t } = layout.current
    const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x)
    const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y)
    const hits = []
    for (const r of rs) {
      if (r.type !== 'row' || r.top + t < y1 || r.top > y2) continue
      r.photos.forEach((p, i) => {
        const left = PAD + i * (t + GAP)
        if (left + t >= x1 && left <= x2) hits.push(p.id)
      })
    }
    return hits
  }

  const onMouseDown = (e) => {
    if (e.button !== 0 || e.target.closest('button, input, a, [role="menu"]')) return
    const el = scrollRef.current
    const point = (ev) => {
      const box = el.getBoundingClientRect()
      return { x: ev.clientX - box.left + el.scrollLeft, y: ev.clientY - box.top + el.scrollTop }
    }
    const start = point(e)
    const additive = e.ctrlKey || e.metaKey || e.shiftKey
    const base = additive ? [...useSelection.getState().selected] : []
    let active = false

    const move = (ev) => {
      if (!active && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 6) return
      active = true
      const box = el.getBoundingClientRect()
      if (ev.clientY < box.top + 40) el.scrollTop -= 24 // auto-scroll while dragging near the edges
      else if (ev.clientY > box.bottom - 40) el.scrollTop += 24
      const cur = point(ev)
      setRect({ x: Math.min(start.x, cur.x), y: Math.min(start.y, cur.y), w: Math.abs(cur.x - start.x), h: Math.abs(cur.y - start.y) })
      useSelection.getState().replace([...base, ...hitTest(start, cur)])
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      if (active) {
        suppressClick.current = true
        setTimeout(() => { suppressClick.current = false }, 60)
      }
      setRect(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div ref={scrollRef} className="grid-scroll" onScroll={onScroll} onMouseDown={onMouseDown}>
      <div className="grid-inner" style={{ height: totalHeight }}>
        {tile > 0 && visible.map((r) =>
          r.type === 'header' ? (
            <div key={`h-${r.key}-${r.top}`} className="group-header" style={{ top: r.top, height: HEADER_H, left: PAD, right: PAD }}>
              <button
                className={`group-check${r.ids.every((id) => selected.has(id)) ? ' on' : ''}`}
                aria-label={`Select all photos from ${r.label}`}
                onClick={() => toggleGroup(r.ids)}
              >
                {r.ids.every((id) => selected.has(id)) ? '✓' : ''}
              </button>
              <h3>{r.label}</h3>
              <span className="group-count">{r.ids.length}</span>
            </div>
          ) : (
            r.photos.map((p, i) => (
              <div key={p.id} className="tile-slot" style={{ top: r.top, left: PAD + i * (tile + GAP), width: tile, height: tile }}>
                <PhotoCard
                  photo={p}
                  selected={selected.has(p.id)}
                  selectionActive={selectionActive}
                  isBin={isBin}
                  onTileClick={onTileClick}
                  onCheck={onCheck}
                  actions={actions}
                />
              </div>
            ))
          ),
        )}
        {rect && <div className="select-rect" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
        {isFetchingNext && <div className="grid-loading" style={{ top: totalHeight - 40 }}>Loading more...</div>}
      </div>
    </div>
  )
}
