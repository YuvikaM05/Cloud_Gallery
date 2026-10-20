import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLightbox } from '../store'
import { absUrl } from '../utils/format'
import '../styles/Lightbox.css'

/** The zoomable image. Re-mounted (key = photo id) for each photo, so zoom/pan state resets for free. */
function Stage({ photo }) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [loaded, setLoaded] = useState(false)
  const drag = useRef(null)

  const zoom = (delta) => setScale((s) => {
    const next = Math.min(5, Math.max(1, +(s + delta).toFixed(2)))
    if (next === 1) setOffset({ x: 0, y: 0 })
    return next
  })

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '+' || e.key === '=') zoom(0.5)
      if (e.key === '-') zoom(-0.5)
      if (e.key === '0') { setScale(1); setOffset({ x: 0, y: 0 }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onPointerDown = (e) => {
    if (scale === 1) return
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => drag.current && setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })
  const onPointerUp = () => { drag.current = null }

  return (
    <div className="lb-stage" onWheel={(e) => zoom(e.deltaY < 0 ? 0.3 : -0.3)}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <div className="lb-img-wrap" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, cursor: scale > 1 ? 'grab' : 'zoom-in' }}
        onDoubleClick={() => { if (scale > 1) { setScale(1); setOffset({ x: 0, y: 0 }) } else setScale(2.5) }}>
        <img className="lb-thumb" src={absUrl(photo.thumb_url)} alt="" draggable={false} />
        <img className={`lb-full${loaded ? ' loaded' : ''}`} src={absUrl(photo.url)} alt={photo.name} draggable={false} onLoad={() => setLoaded(true)} />
      </div>
      <div className="lb-zoom">
        <button onClick={() => zoom(-0.5)} aria-label="Zoom out">−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => zoom(0.5)} aria-label="Zoom in">+</button>
      </div>
    </div>
  )
}

export default function Lightbox({ photos, hasMore, fetchNext, isBin, actions }) {
  const id = useLightbox((s) => s.id)
  const open = useLightbox((s) => s.open)
  const close = useLightbox((s) => s.close)
  const [playing, setPlaying] = useState(false)
  const lastIndex = useRef(0)

  const index = id ? photos.findIndex((p) => p.id === id) : -1
  const photo = index >= 0 ? photos[index] : null
  useEffect(() => { if (index >= 0) lastIndex.current = index }, [index])

  // photo disappeared (deleted/moved) -> show the neighbour, or close when nothing is left
  useEffect(() => {
    if (id && index === -1) {
      if (photos.length) open(photos[Math.min(lastIndex.current, photos.length - 1)].id)
      else close()
    }
  }, [id, index, photos, open, close])

  const go = (delta) => {
    const next = index + delta
    if (next >= photos.length) {
      if (hasMore) return fetchNext()
      if (playing) return open(photos[0].id)
      return undefined
    }
    if (next < 0) return undefined
    return open(photos[next].id)
  }

  // keep the latest `go` for the keyboard/slideshow listeners without re-subscribing every render
  const goRef = useRef(go)
  useEffect(() => { goRef.current = go })

  useEffect(() => {
    if (!id) return undefined
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea, select')) return
      if (e.key === 'ArrowRight') goRef.current(1)
      else if (e.key === 'ArrowLeft') goRef.current(-1)
      else if (e.key === 'Escape') close()
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, close])

  useEffect(() => {
    if (!id || !playing) return undefined
    const t = setInterval(() => goRef.current(1), 3000)
    return () => clearInterval(t)
  }, [id, playing])

  // preload neighbours so arrow keys feel instant
  useEffect(() => {
    ;[photos[index + 1], photos[index - 1]].forEach((p) => { if (p) new Image().src = absUrl(p.url) })
  }, [photos, index])

  useEffect(() => { if (!id) setPlaying(false) }, [id])

  if (!photo) return null

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={photo.name}>
      <div className="lb-top">
        <button className="lb-btn" onClick={close} aria-label="Close viewer">✕</button>
        <div className="lb-title">
          <strong>{photo.name}</strong>
          <span>{index + 1} / {photos.length}{hasMore ? '+' : ''}</span>
        </div>
        <div className="lb-actions">
          {isBin ? (
            <>
              <button className="lb-btn" title="Restore" onClick={() => actions.bulk('restore', [photo.id], { keepSelection: true })}>↩</button>
              <button className="lb-btn" title="Delete forever" onClick={() => actions.run('deleteForever', [photo.id])}>❌</button>
            </>
          ) : (
            <>
              <button className="lb-btn" title={photo.favorite ? 'Unfavourite' : 'Favourite'} onClick={() => actions.toggleFavorite(photo)}>{photo.favorite ? '❤️' : '🤍'}</button>
              <button className="lb-btn" title="Edit" onClick={() => actions.edit(photo)}>✏️</button>
              <button className="lb-btn" title="Share" onClick={() => actions.share([photo.id])}>📤</button>
              <button className="lb-btn" title="Download" onClick={() => actions.download(photo)}>⬇</button>
              <button className="lb-btn" title="Delete" onClick={() => actions.bulk('delete', [photo.id], { keepSelection: true })}>🗑</button>
            </>
          )}
          <button className="lb-btn" title="Details" onClick={() => actions.details(photo)}>ℹ️</button>
          <button className={`lb-btn${playing ? ' on' : ''}`} title="Slideshow (Space)" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸' : '▶'}</button>
        </div>
      </div>
      <button className="lb-nav prev" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous photo">‹</button>
      <Stage key={photo.id} photo={photo} />
      <button className="lb-nav next" onClick={() => go(1)} disabled={index >= photos.length - 1 && !hasMore} aria-label="Next photo">›</button>
    </div>,
    document.body,
  )
}
