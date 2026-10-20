import axios from 'axios'
import { API_BASE } from './config'
import { useAuth } from '../store/auth'

const api = axios.create({ baseURL: API_BASE, timeout: 120000 })

api.interceptors.request.use((cfg) => {
  const token = useAuth.getState().token
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || ''
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/register')
    if (err.response?.status === 401 && !isAuthCall) useAuth.getState().logout()
    return Promise.reject(err)
  },
)

export function errMsg(err) {
  const d = err?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => x.msg).join(', ')
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Is the backend running?'
  return err?.message || 'Something went wrong'
}

export default api
