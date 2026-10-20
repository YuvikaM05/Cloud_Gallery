import { describe, expect, it } from 'vitest'
import { groupOf, groupPhotos } from '../utils/dates'
import { formatBytes, getExt, stripExt } from '../utils/format'

const now = new Date(2026, 9, 20, 12, 0, 0) // 20 Oct 2026

describe('date grouping', () => {
  it('labels today and yesterday', () => {
    expect(groupOf(new Date(2026, 9, 20, 8), now).label).toBe('Today')
    expect(groupOf(new Date(2026, 9, 19, 23), now).label).toBe('Yesterday')
  })

  it('groups older photos by month and keeps order', () => {
    const photos = [
      { id: 1, taken_at: new Date(2026, 9, 20, 9) },
      { id: 2, taken_at: new Date(2026, 8, 3) },
      { id: 3, taken_at: new Date(2026, 8, 1) },
    ]
    const groups = groupPhotos(photos, now)
    expect(groups.map((g) => g.photos.length)).toEqual([1, 2])
    expect(groups[0].label).toBe('Today')
  })
})

describe('format helpers', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })
  it('splits file extensions', () => {
    expect(stripExt('holiday.final.jpg')).toBe('holiday.final')
    expect(getExt('holiday.final.jpg')).toBe('.jpg')
    expect(getExt('noext')).toBe('')
  })
})
