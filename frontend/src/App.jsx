import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useSSE } from './hooks/useSSE'
import Layout from './components/Layout'
import { Toast } from './components/UI'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import Alerts from './pages/Alerts'
import Users from './pages/Users'
import Reports from './pages/Reports'
import Simulation from './pages/Simulation'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--text2)' }}>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppInner() {
  const { user } = useAuth()
  const [toasts, setToasts] = useState([])
  const [liveEvents, setLiveEvents] = useState([])

  const addToast = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const handleSSEEvent = useCallback((data) => {
    if (data.type === 'event' && data.event) {
      setLiveEvents(prev => [data.event, ...prev].slice(0, 100))
      if (data.alert) {
        addToast(`🚨 ${data.alert.severity}: ${data.alert.username} → ${data.alert.action}`, 'error')
      }
    }
  }, [addToast])

  const sseConnected = useSSE(user ? handleSSEEvent : null)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <Protected>
            <Layout sseConnected={sseConnected}>
              <Routes>
                <Route path="/" element={<Dashboard liveEvents={liveEvents} addToast={addToast} />} />
                <Route path="/events" element={<Events liveEvents={liveEvents} />} />
                <Route path="/alerts" element={<Alerts addToast={addToast} />} />
                <Route path="/users" element={<Users addToast={addToast} />} />
                <Route path="/reports" element={<Reports addToast={addToast} />} />
                <Route path="/simulation" element={<Simulation addToast={addToast} />} />
              </Routes>
            </Layout>
          </Protected>
        } />
      </Routes>
      <Toast toasts={toasts} />
    </BrowserRouter>
  )
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>
}
