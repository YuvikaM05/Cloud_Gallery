// One source of truth for every bulk action. The page menu AND the selection toolbar read from here.
export const ACTIONS = {
  delete: { label: 'Delete Photos', short: 'Delete', icon: '🗑', danger: true },
  favorite: { label: 'Add to Favourites', short: 'Favourite', icon: '❤️' },
  unfavorite: { label: 'Remove from Favourites', short: 'Unfavourite', icon: '🤍' },
  move: { label: 'Move to Album', short: 'Move', icon: '📁' },
  createAlbum: { label: 'Create New Album', short: 'New album', icon: '➕' },
  removeFromAlbum: { label: 'Remove from Album', short: 'Remove', icon: '➖' },
  setCover: { label: 'Set as Album Cover', short: 'Set cover', icon: '🖼' },
  zip: { label: 'Download as ZIP', short: 'ZIP', icon: '⬇' },
  share: { label: 'Share', short: 'Share', icon: '📤' },
  restore: { label: 'Restore', short: 'Restore', icon: '↩' },
  deleteForever: { label: 'Delete Forever', short: 'Delete forever', icon: '❌', danger: true },
}

// '|' = divider
export const PAGE_ACTIONS = {
  gallery: ['delete', 'favorite', '|', 'move', 'createAlbum', '|', 'zip', 'share'],
  favorites: ['unfavorite', 'delete', 'move', '|', 'zip', 'share'],
  bin: ['restore', 'deleteForever'],
  album: ['move', 'favorite', 'delete', 'removeFromAlbum', '|', 'setCover', 'createAlbum', '|', 'zip', 'share'],
}
