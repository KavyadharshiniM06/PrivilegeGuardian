import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.username || !form.password) { setError('Fill in all fields'); return }
    setLoading(true); setError('')
    try {
      await login(form.username, form.password)
      navigate('/')
    } catch (e) {
      setError(e.message || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{ width: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
            background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}>🛡</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>PrivilegeGuardian</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Security Information & Event Management</p>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 32,
        }}>
          <h2 style={{ fontWeight: 700, marginBottom: 24, fontSize: 18 }}>Sign In</h2>

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--red)18', border: '1px solid var(--red)44', borderRadius: 8, color: 'var(--red)', fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Username</label>
            <input
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="admin"
              autoFocus
              style={{
                width: '100%', padding: '11px 14px', background: 'var(--surface2)',
                border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)',
                fontSize: 14, outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '11px 14px', background: 'var(--surface2)',
                border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)',
                fontSize: 14, outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          <button
            onClick={submit}
            disabled={loading}
            style={{
              width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div style={{ marginTop: 24, padding: 14, background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--text2)' }}>
            <div style={{ marginBottom: 4, fontWeight: 700, color: 'var(--text3)' }}>DEFAULT CREDENTIALS</div>
            <div>Admin: <code style={{ color: 'var(--accent)' }}>admin / admin123</code></div>
            <div>Auditor: <code style={{ color: 'var(--cyan)' }}>auditor / auditor123</code></div>
          </div>
        </div>
      </div>
    </div>
  )
}
