import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '../ui/Modal'
import api, { errMsg } from '../../services/api'
import { useAlbums } from '../../hooks/usePhotos'
import { absUrl } from '../../utils/format'

export default function AlbumPickerModal({ onPick, onClose }) {
  const qc = useQueryClient()
  const { data: albums = [], isLoading } = useAlbums()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const choose = (id) => {
    onClose()
    onPick(id)
  }

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const { data } = await api.post('/albums', { name: name.trim() })
      qc.invalidateQueries({ queryKey: ['albums'] })
      choose(data.id)
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <Modal title="Move to album" onClose={onClose}>
      <form className="inline-form" onSubmit={create}>
        <input placeholder="New album name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <button className="btn primary" type="submit" disabled={!name.trim()}>Create & move</button>
      </form>
      {error && <p className="form-error">{error}</p>}
      <div className="picker-list">
        {isLoading && <p className="muted">Loading albums...</p>}
        {!isLoading && albums.length === 0 && <p className="muted">No albums yet. Create your first one above.</p>}
        {albums.map((a) => (
          <button key={a.id} className="picker-item" onClick={() => choose(a.id)}>
            {a.cover_url ? <img src={absUrl(a.cover_url)} alt="" /> : <span className="picker-ph">📁</span>}
            <span className="picker-name">{a.name}</span>
            <span className="muted">{a.photo_count}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
