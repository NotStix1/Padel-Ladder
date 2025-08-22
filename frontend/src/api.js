const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const inferredBase = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
  ? runtimeOrigin
  : 'http://localhost:3001'
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || inferredBase

export function getAuthToken() {
  return localStorage.getItem('auth_token')
}

export function setAuthToken(token) {
  if (token) localStorage.setItem('auth_token', token)
  else localStorage.removeItem('auth_token')
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth && getAuthToken()) headers['Authorization'] = `Bearer ${getAuthToken()}`
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    let message = 'Request failed'
    try { const data = await res.json(); message = data.error || message } catch (_) {}
    throw new Error(message)
  }
  return res.json()
}


