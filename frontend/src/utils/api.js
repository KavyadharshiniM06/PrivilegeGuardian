const BASE = '/api'

function getToken() {
  return localStorage.getItem('pg_token')
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('pg_token')
    localStorage.removeItem('pg_user')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),

  // Auth
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  register: (username, password, role) => request('POST', '/auth/register', { username, password, role }),
  me: () => request('GET', '/auth/me'),

  // Events
  getEvents: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request('GET', `/events${q ? '?' + q : ''}`)
  },
  ingestEvent: (data) => request('POST', '/events/ingest', data),

  // Alerts
  getAlerts: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request('GET', `/alerts${q ? '?' + q : ''}`)
  },
  acknowledgeAlert: (id) => request('PATCH', `/alerts/${id}/acknowledge`),
  deleteAlert: (id) => request('DELETE', `/alerts/${id}`),

  // Stats
  getStats: (days = 30) => request('GET', `/stats?days=${days}`),
  getRiskOverTime: (days = 7) => request('GET', `/stats/risk-over-time?days=${days}`),

  // Users
  getUsers: () => request('GET', '/users'),
  createUser: (data) => request('POST', '/users', data),
  deleteUser: (id) => request('DELETE', `/users/${id}`),

  // Reports
  getReports: () => request('GET', '/reports'),
  createReport: (data) => request('POST', '/reports', data),
  deleteReport: (id) => request('DELETE', `/reports/${id}`),
  exportEvents: (days = 30) => `${BASE}/reports/export/events.csv?days=${days}`,
  exportAlerts: (days = 30) => `${BASE}/reports/export/alerts.csv?days=${days}`,
}
