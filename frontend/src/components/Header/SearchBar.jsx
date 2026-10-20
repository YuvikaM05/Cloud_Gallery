import { useRef } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { useUI } from '../../store'
import useShortcuts from '../../hooks/useShortcuts'

const SEARCHABLE = ['/', '/favorites', '/bin', '/albums/:id']

export default function SearchBar() {
  const search = useUI((s) => s.search)
  const setSearch = useUI((s) => s.setSearch)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const ref = useRef(null)

  useShortcuts({ '/': () => ref.current?.focus() })

  const onChange = (e) => {
    setSearch(e.target.value)
    // searching from Settings/Analytics jumps back to the gallery
    if (!SEARCHABLE.some((p) => matchPath(p, pathname))) navigate('/')
  }

  return (
    <div className="search-bar">
      <span className="search-icon" aria-hidden="true">🔍</span>
      <input
        ref={ref}
        type="search"
        placeholder="Search by name, tag or album   ( / )"
        aria-label="Search photos"
        value={search}
        onChange={onChange}
        onKeyDown={(e) => e.key === 'Escape' && (setSearch(''), e.currentTarget.blur())}
      />
      {search && <button className="icon-btn" aria-label="Clear search" onClick={() => setSearch('')}>✕</button>}
    </div>
  )
}
