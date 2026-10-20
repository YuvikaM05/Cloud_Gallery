const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Google-Photos style group: Today / Yesterday / "October 2026". */
export function groupOf(value, now = new Date()) {
  const d = new Date(value)
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diff === 0) return { key: 'today', label: 'Today' }
  if (diff === 1) return { key: 'yesterday', label: 'Yesterday' }
  return {
    key: `${d.getFullYear()}-${d.getMonth()}`,
    label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  }
}

/** Keeps the incoming order and starts a new group whenever the key changes. */
export function groupPhotos(photos, now = new Date()) {
  const groups = []
  for (const p of photos) {
    const g = groupOf(p.taken_at || p.created_at, now)
    const last = groups[groups.length - 1]
    if (last && last.key === g.key) last.photos.push(p)
    else groups.push({ ...g, photos: [p] })
  }
  return groups
}
