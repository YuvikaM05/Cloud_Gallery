import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Menu, MenuItem } from '../components/ui/Menu'

describe('Menu', () => {
  it('opens, runs an item, and closes', () => {
    const onClick = vi.fn()
    render(
      <Menu button={<button>Open menu</button>}>
        <MenuItem onClick={onClick}>Delete</MenuItem>
      </Menu>,
    )
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByText('Open menu'))
    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Escape and on outside click', () => {
    render(<Menu button={<button>Open menu</button>}><MenuItem>One</MenuItem></Menu>)
    fireEvent.click(screen.getByText('Open menu'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(screen.getByText('Open menu'))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
