import { useEffect } from 'react'
import { useUI } from '../store'

/** Writes data-theme="light|dark" on <html>. 'system' follows the OS and updates live. */
export default function ThemeSync() {
  const theme = useUI((s) => s.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  return null
}
