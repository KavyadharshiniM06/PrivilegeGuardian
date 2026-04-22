import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../utils/api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pg_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pg_token')
    if (!token) { setLoading(false); return }
    api.me()
      .then(u => { setUser(u); setLoading(false) })
      .catch(() => {
        localStorage.removeItem('pg_token')
        localStorage.removeItem('pg_user')
        setUser(null)
        setLoading(false)
      })
  }, [])

  const login = async (username, password) => {
    const { token, user: u } = await api.login(username, password)
    localStorage.setItem('pg_token', token)
    localStorage.setItem('pg_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem('pg_token')
    localStorage.removeItem('pg_user')
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
