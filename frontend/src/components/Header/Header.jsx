import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import SearchBar from './SearchBar'
import NotificationsPanel from './NotificationsPanel'
import ProfileMenu from './ProfileMenu'
import { Menu, MenuDivider, MenuItem } from '../ui/Menu'
import { useModal, useUI } from '../../store'
import { filesFromNative, uploadFiles } from '../../services/uploader'
import logo from '../../assets/Logogallery.png'
import '../../styles/Header.css'

const VIEWS = [['large', 'Large', '🟦'], ['medium', 'Medium', '▦'], ['small', 'Small', '▩']]
const SORTS = [
  ['date-new', 'Newest first'], ['date-old', 'Oldest first'], ['name-asc', 'Name A → Z'],
  ['name-desc', 'Name Z → A'], ['size-large', 'Largest first'], ['size-small', 'Smallest first'],
]

export default function Header() {
  const qc = useQueryClient()
  const viewMode = useUI((s) => s.viewMode)
  const setViewMode = useUI((s) => s.setViewMode)
  const sortBy = useUI((s) => s.sortBy)
  const setSortBy = useUI((s) => s.setSortBy)
  const openModal = useModal((s) => s.open)
  const fileRef = useRef(null)
  const folderRef = useRef(null)

  const chooseFiles = async () => {
    if (window.electronAPI) {
      const list = await window.electronAPI.openFiles() // native OS dialog
      if (list?.length) uploadFiles(filesFromNative(list), qc)
    } else {
      fileRef.current.click()
    }
  }

  const onPicked = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'))
    uploadFiles(files, qc)
    e.target.value = ''
  }

  return (
    <header className="header">
      <Link to="/" className="logo-link" aria-label="CloudGallery home">
        <img src={logo} alt="" className="logo-img" />
        <span className="logo-text">CloudGallery</span>
      </Link>

      <SearchBar />

      <div className="header-actions">
        <Menu button={<button className="btn ghost small">View ▾</button>}>
          {VIEWS.map(([v, label, icon]) => (
            <MenuItem key={v} icon={icon} checked={viewMode === v} onClick={() => setViewMode(v)}>{label}</MenuItem>
          ))}
        </Menu>

        <Menu button={<button className="btn ghost small">Sort ▾</button>}>
          {SORTS.map(([v, label]) => (
            <MenuItem key={v} checked={sortBy === v} onClick={() => setSortBy(v)}>{label}</MenuItem>
          ))}
        </Menu>

        <Menu button={<button className="btn primary small">⬆ Upload</button>}>
          <MenuItem icon="🖼" onClick={chooseFiles}>Choose files</MenuItem>
          <MenuItem icon="📂" onClick={() => folderRef.current.click()}>Choose folder</MenuItem>
          <MenuDivider />
          <MenuItem icon="📸" onClick={() => openModal('camera')}>Camera</MenuItem>
        </Menu>

        <NotificationsPanel />
        <ProfileMenu />
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPicked} />
      <input ref={folderRef} type="file" webkitdirectory="" multiple hidden onChange={onPicked} />
    </header>
  )
}
