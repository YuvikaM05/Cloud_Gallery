import { Menu, MenuDivider, MenuItem, MenuLabel } from './ui/Menu'
import { useSelection, useModal } from '../store'
import { ACTIONS, PAGE_ACTIONS } from '../utils/actions'
import '../styles/GalleryMenu.css'

/**
 * Page-level ⋮ menu. Every page has its own list (see utils/actions.js).
 * Picking an action starts selection mode: tick photos, then press Done in the toolbar.
 */
export default function GalleryMenu({ page, album, actions, onSelectAll, hasPhotos }) {
  const startAction = useSelection((s) => s.startAction)
  const openModal = useModal((s) => s.open)
  const items = PAGE_ACTIONS[page] || []

  return (
    <Menu button={<button className="page-menu-btn" aria-label="Page options">⋮</button>}>
      <MenuLabel>Select photos to...</MenuLabel>
      {items.map((key, i) => {
        if (key === '|') return <MenuDivider key={`d${i}`} />
        const a = ACTIONS[key]
        return (
          <MenuItem key={key} icon={a.icon} danger={a.danger} disabled={!hasPhotos} onClick={() => startAction(key)}>
            {a.label}
          </MenuItem>
        )
      })}
      <MenuDivider />
      <MenuItem icon="☑️" disabled={!hasPhotos} onClick={onSelectAll}>Select all</MenuItem>

      {page === 'bin' && (
        <>
          <MenuDivider />
          <MenuItem icon="🧹" danger disabled={!hasPhotos} onClick={actions.emptyBin}>Empty Bin</MenuItem>
        </>
      )}

      {page === 'album' && album && (
        <>
          <MenuDivider />
          <MenuLabel>Album</MenuLabel>
          <MenuItem icon="🖼" onClick={() => openModal('addPhotos', { albumId: album.id })}>Add photos</MenuItem>
          <MenuItem icon="✏️" onClick={() => album.rename()}>Rename album</MenuItem>
          <MenuItem icon="📤" onClick={() => openModal('share', { payload: { kind: 'album', album_id: album.id } })}>Share album</MenuItem>
          <MenuItem icon="🗑" danger onClick={() => album.remove()}>Delete album</MenuItem>
        </>
      )}
    </Menu>
  )
}
