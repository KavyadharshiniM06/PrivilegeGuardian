import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LiveDot } from './UI'

const NAV = [
  { to: '/', icon: '▦', label: 'Dashboard' },
  { to: '/events', icon: '≡', label: 'Events' },
  { to: '/alerts', icon: '⚠', label: 'Alerts' },
  { to: '/users', icon: '◉', label: 'Users', admin: true },
  { to: '/reports', icon: '⬚', label: 'Reports' },
  { to: '/simulation', icon: '⚙', label: 'Simulate' },
]

export default function Layout({ children, sseConnected }) {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const w = collapsed ? 64 : 220

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: w, minWidth: w, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
          }}>🛡</div>
          {!collapsed && <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>Privilege</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)', letterSpacing: 0.5 }}>Guardian</div>
          </div>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.filter(n => !n.admin || isAdmin).map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text2)',
              background: isActive ? 'var(--accent)18' : 'transparent',
              fontWeight: isActive ? 700 : 500, fontSize: 14,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap', overflow: 'hidden',
            })}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          {/* Live indicator */}
          {!collapsed && (
            <div style={{ padding: '8px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <LiveDot active={sseConnected} />
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
                {sseConnected ? 'LIVE FEED' : 'POLLING'}
              </span>
            </div>
          )}
          {/* User */}
          {!collapsed && (
            <div style={{ padding: '8px 12px', marginBottom: 8, background: 'var(--surface2)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{user?.username}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>{user?.role}</div>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)} style={{
            width: '100%', padding: '8px 12px', border: 'none', background: 'var(--surface2)',
            color: 'var(--text2)', borderRadius: 10, cursor: 'pointer', fontSize: 18,
          }}>{collapsed ? '›' : '‹'}</button>
          <button onClick={handleLogout} style={{
            width: '100%', marginTop: 6, padding: '8px 12px', border: 'none', background: 'none',
            color: 'var(--red)', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
          }}>
            {collapsed ? '⏏' : '⏏ Logout'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: w, flex: 1, padding: 28, transition: 'margin-left 0.2s', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
