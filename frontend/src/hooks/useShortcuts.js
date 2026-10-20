import { useEffect } from 'react'

/** map = { 'delete': fn, 'f': fn, 'mod+a': fn, 'escape': fn }  (mod = Ctrl or Cmd) */
export default function useShortcuts(map, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const key = `${e.ctrlKey || e.metaKey ? 'mod+' : ''}${e.key.toLowerCase()}`
      const fn = map[key]
      if (fn) {
        e.preventDefault()
        fn(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [map, enabled])
}
