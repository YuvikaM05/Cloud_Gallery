import { useState } from 'react'
import Modal from '../ui/Modal'
import { errMsg } from '../../services/api'

export default function PromptModal({ title, label, initial = '', confirmText = 'OK', onSubmit, onClose }) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const v = value.trim()
    if (!v) return setError('Please enter a value')
    setBusy(true)
    setError('')
    try {
      await onSubmit(v)
      onClose()
    } catch (err) {
      setError(errMsg(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>{label}</span>
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Working...' : confirmText}</button>
        </div>
      </form>
    </Modal>
  )
}
