import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Menu, MenuDivider, MenuItem } from '../ui/Menu'
import { useAuth } from '../../store/auth'

export default function ProfileMenu() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase()

  return (
    <Menu button={<button className="avatar" aria-label="Account menu">{initial}</button>}>
      <div className="profile-card">
        <div className="avatar big">{initial}</div>
        <div>
          <strong>{user?.name}</strong>
          <div className="muted">{user?.email}</div>
        </div>
      </div>
      <MenuDivider />
      <MenuItem icon="⚙️" onClick={() => navigate('/settings')}>Settings</MenuItem>
      <MenuItem icon="☁️" onClick={() => navigate('/cloud-storage')}>Cloud storage</MenuItem>
      <MenuDivider />
      <MenuItem icon="🚪" onClick={() => { logout(); qc.clear() }}>Log out</MenuItem>
    </Menu>
  )
}
