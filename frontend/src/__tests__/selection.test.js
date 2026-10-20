import { beforeEach, describe, expect, it } from 'vitest'
import { useSelection } from '../store'

const ids = ['a', 'b', 'c', 'd', 'e']

describe('massive selection store', () => {
  beforeEach(() => useSelection.getState().clear())

  it('toggles single photos', () => {
    const s = useSelection.getState()
    s.toggle('a')
    expect(useSelection.getState().selected.has('a')).toBe(true)
    useSelection.getState().toggle('a')
    expect(useSelection.getState().selected.size).toBe(0)
  })

  it('shift-click selects the whole range from the anchor', () => {
    useSelection.getState().toggle('b')
    useSelection.getState().selectRange(ids, 'd')
    expect([...useSelection.getState().selected].sort()).toEqual(['b', 'c', 'd'])
  })

  it('works backwards too', () => {
    useSelection.getState().toggle('d')
    useSelection.getState().selectRange(ids, 'b')
    expect(useSelection.getState().selected.size).toBe(3)
  })

  it('select-all and clear', () => {
    useSelection.getState().selectAll(ids)
    expect(useSelection.getState().selected.size).toBe(5)
    useSelection.getState().clear()
    expect(useSelection.getState().selected.size).toBe(0)
  })

  it('startAction enters selection mode with an empty selection', () => {
    useSelection.getState().toggle('a')
    useSelection.getState().startAction('delete')
    const s = useSelection.getState()
    expect(s.mode).toBe(true)
    expect(s.action).toBe('delete')
    expect(s.selected.size).toBe(0)
  })
})
