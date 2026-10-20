import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '../ui/Modal'
import api, { errMsg } from '../../services/api'
import { uploadFiles } from '../../services/uploader'
import { stripExt } from '../../utils/format'

const RATIOS = [['original', 'Original'], ['1:1', '1:1'], ['4:3', '4:3'], ['16:9', '16:9'], ['9:16', '9:16']]
const MAX_SIDE = 2400

/** Canvas editor: rotate, flip, brightness, contrast, centre-crop. Saves as a NEW photo (original is untouched). */
export default function EditorModal({ photo, onClose }) {
  const qc = useQueryClient()
  const canvasRef = useRef(null)
  const [img, setImg] = useState(null)
  const [error, setError] = useState('')
  const [rot, setRot] = useState(0)
  const [flip, setFlip] = useState(false)
  const [bright, setBright] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [ratio, setRatio] = useState('original')

  // Load through the API (blob) so the canvas is never "tainted" by cross-origin images.
  useEffect(() => {
    let url
    let cancelled = false
    api.get(`/photos/${photo.id}/download`, { responseType: 'blob' })
      .then(({ data }) => {
        url = URL.createObjectURL(data)
        const i = new Image()
        i.onload = () => !cancelled && setImg(i)
        i.onerror = () => setError('Could not load this image')
        i.src = url
      })
      .catch((e) => setError(errMsg(e)))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [photo.id])

  useEffect(() => {
    if (!img || !canvasRef.current) return
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const w = img.naturalWidth * k
    const h = img.naturalHeight * k
    const swap = rot % 2 === 1
    const cw = swap ? h : w
    const ch = swap ? w : h

    const stage = document.createElement('canvas')
    stage.width = cw
    stage.height = ch
    const c = stage.getContext('2d')
    c.filter = `brightness(${bright}%) contrast(${contrast}%)`
    c.translate(cw / 2, ch / 2)
    c.rotate((rot * Math.PI) / 2)
    if (flip) c.scale(-1, 1)
    c.drawImage(img, -w / 2, -h / 2, w, h)

    let sw = cw
    let sh = ch
    if (ratio !== 'original') {
      const [a, b] = ratio.split(':').map(Number)
      const target = a / b
      if (cw / ch > target) sw = ch * target
      else sh = cw / target
    }
    const out = canvasRef.current
    out.width = Math.round(sw)
    out.height = Math.round(sh)
    out.getContext('2d').drawImage(stage, (cw - sw) / 2, (ch - sh) / 2, sw, sh, 0, 0, out.width, out.height)
  }, [img, rot, flip, bright, contrast, ratio])

  const reset = () => { setRot(0); setFlip(false); setBright(100); setContrast(100); setRatio('original') }

  const save = () => {
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `${stripExt(photo.name)}-edited.jpg`, { type: 'image/jpeg' })
      onClose()
      await uploadFiles([file], qc)
    }, 'image/jpeg', 0.92)
  }

  return (
    <Modal title={`Edit - ${photo.name}`} onClose={onClose} wide
      footer={
        <>
          <button className="btn ghost" onClick={reset}>Reset</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!img} onClick={save}>Save as copy</button>
        </>
      }>
      {error && <p className="form-error">{error}</p>}
      {!img && !error && <p className="muted">Loading image...</p>}
      <div className="editor" style={{ display: img ? 'grid' : 'none' }}>
        <div className="editor-canvas"><canvas ref={canvasRef} /></div>
        <div className="editor-tools">
          <div className="tool-row">
            <button className="btn" onClick={() => setRot((r) => (r + 3) % 4)}>⟲ Rotate left</button>
            <button className="btn" onClick={() => setRot((r) => (r + 1) % 4)}>⟳ Rotate right</button>
            <button className="btn" onClick={() => setFlip((f) => !f)}>⇋ Flip</button>
          </div>
          <label className="field"><span>Brightness {bright}%</span>
            <input type="range" min="40" max="180" value={bright} onChange={(e) => setBright(+e.target.value)} /></label>
          <label className="field"><span>Contrast {contrast}%</span>
            <input type="range" min="40" max="180" value={contrast} onChange={(e) => setContrast(+e.target.value)} /></label>
          <div className="field"><span>Crop (centre)</span>
            <div className="chip-row">
              {RATIOS.map(([v, l]) => (
                <button key={v} className={`chip${ratio === v ? ' active' : ''}`} onClick={() => setRatio(v)}>{l}</button>
              ))}
            </div>
          </div>
          <p className="muted">Your original stays untouched - the edit is saved as a new photo.</p>
        </div>
      </div>
    </Modal>
  )
}
