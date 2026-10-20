import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import api, { errMsg } from '../services/api'
import { useUI } from '../store'
import { useAuth } from '../store/auth'
import logo from '../assets/Logogallery.png'
import '../styles/pages.css'

export default function Login() {
  const nav = useNavigate()
  const token = useAuth((s) => s.token)
  const setAuth = useAuth((s) => s.setAuth)
  const applySettings = useUI((s) => s.applySettings)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (token) return <Navigate to="/" replace />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = mode === 'login' ? { email: form.email, password: form.password } : form
      const { data } = await api.post(`/auth/${mode}`, body)
      setAuth(data.access_token, data.user)
      applySettings(data.user.settings)
      nav('/', { replace: true })
    } catch (err) {
      setError(errMsg(err))
    }
    setBusy(false)
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <img src={logo} alt="" className="auth-logo" />
        <h1>CloudGallery</h1>
        <p className="muted">{mode === 'login' ? 'Welcome back. Log in to see your photos.' : 'Create your account to start storing photos.'}</p>

        {mode === 'register' && (
          <label className="field"><span>Name</span><input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
        )}
        <label className="field"><span>Email</span><input type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></label>
        <label className="field"><span>Password</span>
          <input type="password" required minLength={mode === 'register' ? 8 : 1} value={form.password} onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          {mode === 'register' && <small className="muted">At least 8 characters</small>}
        </label>

        {error && <p className="form-error">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        <button type="button" className="link-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
          {mode === 'login' ? 'New here? Create an account' : 'I already have an account'}
        </button>
      </form>
    </div>
  )
}
