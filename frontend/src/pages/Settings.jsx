import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api, { errMsg } from '../services/api'
import { isElectron } from '../services/config'
import { toast, useUI } from '../store'
import { useAuth } from '../store/auth'
import '../styles/pages.css'

function Row({ title, hint, children }) {
  return <div className="setting-row"><div><strong>{title}</strong>{hint && <p className="muted">{hint}</p>}</div><div className="setting-control">{children}</div></div>
}

export default function Settings() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const user = useAuth((s) => s.user)
  const setUser = useAuth((s) => s.setUser)
  const logout = useAuth((s) => s.logout)
  const applySettings = useUI((s) => s.applySettings)
  const [name, setName] = useState(user?.name || '')
  const [syncDir, setSyncDir] = useState(null)
  const s = user?.settings || {}

  useEffect(() => {
    if (isElectron) window.electronAPI.syncStatus().then(setSyncDir)
  }, [])

  const save = async (patch, message = 'Saved') => {
    try {
      const { data } = await api.patch('/auth/me', patch)
      setUser(data)
      applySettings(data.settings)
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success(message)
    } catch (e) { toast.error(errMsg(e)) }
  }
  const setting = (key) => (e) => save({ settings: { [key]: key === 'bin_days' ? Number(e.target.value) : e.target.value } })

  const chooseSync = async () => {
    const dir = await window.electronAPI.chooseSyncFolder()
    if (dir) { await window.electronAPI.startSync(dir); setSyncDir(dir); toast.success('Watching folder for new photos') }
  }
  const stopSync = async () => { await window.electronAPI.stopSync(); setSyncDir(null); toast.info('Folder sync stopped') }

  return (
    <section className="page narrow">
      <div className="page-head"><div><h2>Settings</h2></div></div>

      <div className="card">
        <h3>Appearance</h3>
        <Row title="Theme" hint="System follows your operating system.">
          <select value={s.theme || 'system'} onChange={setting('theme')}>
            <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </Row>
        <Row title="Default photo size">
          <select value={s.default_view || 'medium'} onChange={setting('default_view')}>
            <option value="large">Large</option><option value="medium">Medium</option><option value="small">Small</option>
          </select>
        </Row>
        <Row title="Default sort order">
          <select value={s.default_sort || 'date-new'} onChange={setting('default_sort')}>
            <option value="date-new">Newest first</option><option value="date-old">Oldest first</option>
            <option value="name-asc">Name A → Z</option><option value="name-desc">Name Z → A</option>
            <option value="size-large">Largest first</option><option value="size-small">Smallest first</option>
          </select>
        </Row>
      </div>

      <div className="card">
        <h3>Uploads & storage</h3>
        <Row title="Upload quality" hint="Compressed shrinks photos to max 2048 px (JPEG) and saves space.">
          <select value={s.upload_quality || 'original'} onChange={setting('upload_quality')}>
            <option value="original">Original</option><option value="compressed">Compressed</option>
          </select>
        </Row>
        <Row title="Storage provider" hint={`Currently: ${s.storage_provider || 'local'}`}>
          <Link className="btn small" to="/cloud-storage">Manage providers</Link>
        </Row>
        <Row title="Empty bin automatically after" hint="Days before binned photos are deleted forever.">
          <select value={s.bin_days || 30} onChange={setting('bin_days')}>
            {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </Row>
      </div>

      {isElectron && (
        <div className="card">
          <h3>Desktop</h3>
          <Row title="Sync folder" hint={syncDir ? `Watching: ${syncDir}` : 'New images added to a folder are uploaded automatically.'}>
            {syncDir ? <button className="btn small" onClick={stopSync}>Stop</button> : <button className="btn small" onClick={chooseSync}>Choose folder</button>}
          </Row>
        </div>
      )}

      <div className="card">
        <h3>Account</h3>
        <Row title="Name">
          <div className="inline-form">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <button className="btn small primary" disabled={!name.trim() || name === user?.name} onClick={() => save({ name: name.trim() }, 'Name updated')}>Save</button>
          </div>
        </Row>
        <Row title="Email"><span className="muted">{user?.email}</span></Row>
        <Row title="Log out of this device"><button className="btn small danger-text" onClick={() => { logout(); qc.clear(); nav('/login') }}>Log out</button></Row>
      </div>
    </section>
  )
}
