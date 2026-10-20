import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '../ui/Modal'
import { uploadFiles } from '../../services/uploader'

export default function CameraModal({ onClose }) {
  const qc = useQueryClient()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported here.')
      return undefined
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        videoRef.current.srcObject = stream
        setReady(true)
      })
      .catch((e) => setError(e.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'No camera found.'))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const capture = () => {
    const v = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onClose()
      await uploadFiles([file], qc)
    }, 'image/jpeg', 0.92)
  }

  return (
    <Modal title="Take a photo" onClose={onClose} wide>
      {error ? <p className="form-error">{error}</p> : <video ref={videoRef} className="camera-video" autoPlay playsInline muted />}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ready} onClick={capture}>📸 Capture & upload</button>
      </div>
    </Modal>
  )
}
