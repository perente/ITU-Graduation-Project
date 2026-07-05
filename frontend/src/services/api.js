import { getStoredToken } from '../context/AuthContext.jsx'

const API_BASE =
  window.location.protocol + '//' + window.location.hostname + ':3000/api'

export class ApiError extends Error {
  constructor(status, data) {
    const msg =
      (Array.isArray(data?.errors) ? data.errors.join(' ') : null) ||
      data?.message ||
      `HTTP ${status}`
    super(msg)
    this.status = status
    this.data = data
  }
}

export async function apiRequest(path, options = {}) {
  const token = getStoredToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('stajchain.auth')
    window.location.href = '/login'
    throw new ApiError(401, { message: 'Oturum süresi doldu, yeniden giriş yapın.' })
  }

  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  if (!res.ok) throw new ApiError(res.status, data)
  return data
}
