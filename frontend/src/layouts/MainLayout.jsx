import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '../components/Header/Header'
import Sidebar from '../components/Sidebar'
import ModalHost from '../components/ModalHost'
import Toasts from '../components/ui/Toasts'
import UploadTray from '../components/UploadTray'
import api from '../services/api'
import { filesFromNative, uploadFiles } from '../services/uploader'
import { useUI } from '../store'
import { useAuth } from '../store/auth'
import '../styles/MainLayout.css'

export default function MainLayout() {
  const token = useAuth((s) => s.token)
  const setUser = useAuth((s) => s.setUser)
  const applySettings = useUI((s) => s.applySettings)
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)

  // refresh profile + settings (also validates the saved token)
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me').then((r) => r.data), enabled: !!token })
  useEffect(() => {
    if (me) {
      setUser(me)
      applySettings(me.settings)
    }
  }, [me, setUser, applySettings])

  // drag files from the desktop onto the window
  useEffect(() => {
    const hasFiles = (e) => e.dataTransfer?.types?.includes('Files')
    const enter = (e) => { if (hasFiles(e)) { depth.current++; setDragging(true) } }
    const leave = (e) => { if (hasFiles(e) && --depth.current <= 0) { depth.current = 0; setDragging(false) } }
    const over = (e) => hasFiles(e) && e.preventDefault()
    const drop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
      uploadFiles(files, qc)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [qc])

  // Electron "sync folder": the main process sends new files here
  useEffect(() => {
    if (!window.electronAPI?.onSyncFile) return undefined
    return window.electronAPI.onSyncFile((f) => uploadFiles(filesFromNative([f]), qc))
  }, [qc])

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="app-shell">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="app-main"><Outlet /></main>
      </div>
      <ModalHost />
      <Toasts />
      <UploadTray />
      {dragging && <div className="drop-overlay"><div>⬆ Drop photos to upload</div></div>}
    </div>
  )
}
