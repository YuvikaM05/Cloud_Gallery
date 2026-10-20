import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MenuContext = createContext({ close: () => {} })

/**
 * Dropdown rendered in a portal (never clipped by overflow:hidden).
 * Closes on outside click, Esc, scroll and resize.
 */
export function Menu({ button, children, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const anchor = useRef(null)
  const panel = useRef(null)
  const close = useCallback(() => setOpen(false), [])

  const place = useCallback(() => {
    if (!anchor.current) return
    const r = anchor.current.getBoundingClientRect()
    const pw = panel.current?.offsetWidth || 200
    const ph = panel.current?.offsetHeight || 0
    let left = align === 'right' ? r.right - pw : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8))
    let top = r.bottom + 6
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6)
    setPos({ top, left })
  }, [align])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (panel.current?.contains(e.target) || anchor.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    const onScroll = (e) => {
      if (!panel.current?.contains(e.target)) setOpen(false)
    }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <>
      <span
        ref={anchor}
        className="menu-anchor"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {button}
      </span>
      {open &&
        createPortal(
          <MenuContext.Provider value={{ close }}>
            <div
              ref={panel}
              role="menu"
              className="menu-panel"
              style={{ top: pos.top, left: pos.left }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {children}
            </div>
          </MenuContext.Provider>,
          document.body,
        )}
    </>
  )
}

export function MenuItem({ icon, children, onClick, danger = false, disabled = false, checked = false }) {
  const { close } = useContext(MenuContext)
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={`menu-item${danger ? ' danger' : ''}${checked ? ' checked' : ''}`}
      onClick={(e) => {
        close()
        onClick?.(e)
      }}
    >
      <span className="menu-icon">{icon}</span>
      <span className="menu-text">{children}</span>
      {checked && <span className="menu-check">✓</span>}
    </button>
  )
}

export const MenuDivider = () => <hr className="menu-divider" />
export const MenuLabel = ({ children }) => <div className="menu-label">{children}</div>
