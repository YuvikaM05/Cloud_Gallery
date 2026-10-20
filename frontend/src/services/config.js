export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
export const MAX_UPLOAD_MB = 50
export const isElectron = typeof window !== 'undefined' && !!window.electronAPI
