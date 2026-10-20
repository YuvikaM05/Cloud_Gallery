import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '../ui/Modal'
import api, { errMsg } from '../../services/api'
import { API_BASE } from '../../services/config'
import { toast } from '../../store'

const EXPIRY = [
  { label: 'Never expires', value: '' },
  { label: '1 day', value: '1' },
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
]

export default function ShareModal({ payload, onClose }) {
  const qc = useQueryClient()
  const [days, setDays] = useState('7')
  const [link, setLink] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/share', { ...payload, expires_in_days: days ? Number(days) : null })
      setLink(`${API_BASE}${data.path}`)
      qc.invalidateQueries({ queryKey: ['shares'] })
    } catch (e) {
      setError(errMsg(e))
    }
    setBusy(false)
  }

  const copy = () => navigator.clipboard.writeText(link).then(() => toast.success('Link copied'))

  return (
    <Modal title="Share" onClose={onClose}>
      {!link ? (
        <>
          <label className="field">
            <span>Link expires</span>
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              {EXPIRY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <p className="muted">Anyone with the link can view the photos (no login needed). You can revoke it any time from the Shared page.</p>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={create} disabled={busy}>{busy ? 'Creating...' : 'Create link'}</button>
          </div>
        </>
      ) : (
        <>
          <div className="url-cell">
            <input readOnly autoFocus value={link} onFocus={(e) => e.target.select()} />
            <button className="btn primary" onClick={copy}>Copy</button>
          </div>
          <p className="muted">Your link is ready.</p>
          <div className="modal-actions"><button className="btn" onClick={onClose}>Done</button></div>
        </>
      )}
    </Modal>
  )
}
