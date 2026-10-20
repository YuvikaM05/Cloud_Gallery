import { Menu, MenuDivider, MenuItem } from './ui/Menu'
import { absUrl } from '../utils/format'
import '../styles/PhotoCard.css'

/** One square tile. Hover shows checkbox, heart and the ⋮ menu. */
export default function PhotoCard({ photo, selected, selectionActive, isBin, onTileClick, onCheck, actions }) {
  return (
    <div
      className={`photo-card${selected ? ' selected' : ''}${selectionActive ? ' selecting' : ''}`}
      onClick={(e) => onTileClick(photo, e)}
      role="button"
      tabIndex={0}
      aria-label={`${photo.name}${selected ? ', selected' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onTileClick(photo, e)
        if (e.key === ' ') {
          e.preventDefault()
          onCheck(photo, e)
        }
      }}
    >
      <img src={absUrl(photo.thumb_url)} alt={photo.name} loading="lazy" decoding="async" draggable={false} />

      <button className="pc-check" aria-label={selected ? 'Deselect photo' : 'Select photo'}
        onClick={(e) => { e.stopPropagation(); onCheck(photo, e) }}>
        {selected ? '✓' : ''}
      </button>

      {!isBin && (
        <button className={`pc-fav${photo.favorite ? ' on' : ''}`} aria-label={photo.favorite ? 'Remove from favourites' : 'Add to favourites'}
          onClick={(e) => { e.stopPropagation(); actions.toggleFavorite(photo) }}>
          {photo.favorite ? '❤️' : '🤍'}
        </button>
      )}
      {isBin && photo.days_left != null && <span className="pc-days">{photo.days_left}d left</span>}

      <div className="pc-bottom">
        <span className="pc-name">{photo.name}</span>
        <Menu button={<button className="pc-menu-btn" aria-label="Photo options">⋮</button>}>
          {isBin ? (
            <>
              <MenuItem icon="↩" onClick={() => actions.bulk('restore', [photo.id], { keepSelection: true })}>Restore</MenuItem>
              <MenuItem icon="ℹ️" onClick={() => actions.details(photo)}>Details</MenuItem>
              <MenuDivider />
              <MenuItem icon="❌" danger onClick={() => actions.run('deleteForever', [photo.id])}>Delete Forever</MenuItem>
            </>
          ) : (
            <>
              <MenuItem icon="👁" onClick={() => actions.open(photo)}>Open</MenuItem>
              <MenuItem icon="✏️" onClick={() => actions.edit(photo)}>Edit</MenuItem>
              <MenuItem icon="🔤" onClick={() => actions.rename(photo)}>Rename</MenuItem>
              <MenuItem icon="⬇" onClick={() => actions.download(photo)}>Download</MenuItem>
              <MenuItem icon="📤" onClick={() => actions.share([photo.id])}>Share</MenuItem>
              <MenuItem icon="📁" onClick={() => actions.pickAlbum([photo.id])}>Move to Album</MenuItem>
              <MenuItem icon="ℹ️" onClick={() => actions.details(photo)}>Details</MenuItem>
              <MenuDivider />
              <MenuItem icon="🗑" danger onClick={() => actions.bulk('delete', [photo.id], { keepSelection: true })}>Delete</MenuItem>
            </>
          )}
        </Menu>
      </div>
    </div>
  )
}
