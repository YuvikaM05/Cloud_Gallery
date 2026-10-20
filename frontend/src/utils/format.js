import { API_BASE } from '../services/config'

export function formatBytes(bytes, digits = 1) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / 1024 ** i
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`
}

export function stripExt(name = '') {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

export function getExt(name = '') {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i) : ''
}

/** Local files come back as "/files/..." -> prefix the API origin. Cloud URLs are already absolute. */
export function absUrl(url) {
  if (!url) return ''
  return url.startsWith('/') ? `${API_BASE}${url}` : url
}

export function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export function pluralPhotos(n) {
  return `${n} photo${n === 1 ? '' : 's'}`
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
