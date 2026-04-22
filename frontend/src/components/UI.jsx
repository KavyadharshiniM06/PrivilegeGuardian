import React, { useState } from 'react'

const S = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
  },
  badge: (color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    fontFamily: 'JetBrains Mono, monospace',
    background: color + '22',
    color: color,
    border: `1px solid ${color}44`,
  }),
}

const SEVERITY_COLOR = {
  CRITICAL: 'var(--red)',
  HIGH: 'var(--orange)',
  MEDIUM: 'var(--yellow)',
  LOW: 'var(--cyan)',
}

const STATUS_COLOR = {
  allowed: 'var(--green)',
  denied: 'var(--red)',
}

export function StatCard({ label, value, sub, color = 'var(--accent)', icon }) {
  return (
    <div style={{
      ...S.card,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '12px 12px 0 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{sub}</div>}
        </div>
        {icon && <div style={{ fontSize: 28, opacity: 0.3 }}>{icon}</div>}
      </div>
    </div>
  )
}

export function Badge({ label, type = 'severity' }) {
  const color = type === 'severity' ? (SEVERITY_COLOR[label] || 'var(--text2)') : (STATUS_COLOR[label] || 'var(--text2)')
  return <span style={S.badge(color)}>{label}</span>
}

export function RiskBar({ score }) {
  const color = score >= 85 ? 'var(--red)' : score >= 75 ? 'var(--orange)' : score >= 60 ? 'var(--yellow)' : score >= 50 ? 'var(--cyan)' : 'var(--green)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono', color, minWidth: 28, textAlign: 'right', fontWeight: 700 }}>{score}</span>
    </div>
  )
}

export function Table({ columns, data, emptyMsg = 'No data' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{
                padding: '10px 14px',
                textAlign: 'left',
                color: 'var(--text3)',
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--border)',
                whiteSpace: 'nowrap',
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{emptyMsg}</td></tr>
          ) : data.map((row, i) => (
            <tr key={row._id || i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {columns.map(col => (
                <td key={col.key} style={{ padding: '10px 14px', color: 'var(--text)', verticalAlign: 'middle' }}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0008', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: 28, minWidth: 420, maxWidth: 560, width: '90%',
        boxShadow: '0 24px 64px #0006',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{label}</label>}
      <input {...props} style={{
        width: '100%', padding: '10px 14px',
        background: 'var(--surface2)', border: '1px solid var(--border2)',
        borderRadius: 8, color: 'var(--text)', fontSize: 14,
        outline: 'none', transition: 'border-color 0.2s',
        fontFamily: 'inherit',
        ...(props.style || {}),
      }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border2)'}
      />
    </div>
  )
}

export function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{label}</label>}
      <select {...props} style={{
        width: '100%', padding: '10px 14px',
        background: 'var(--surface2)', border: '1px solid var(--border2)',
        borderRadius: 8, color: 'var(--text)', fontSize: 14,
        outline: 'none', fontFamily: 'inherit',
        ...(props.style || {}),
      }}>
        {children}
      </select>
    </div>
  )
}

export function Btn({ children, variant = 'primary', loading, ...props }) {
  const colors = {
    primary: { bg: 'var(--accent)', color: '#fff' },
    danger:  { bg: 'var(--red)', color: '#fff' },
    ghost:   { bg: 'var(--surface3)', color: 'var(--text)' },
    success: { bg: 'var(--green)', color: '#fff' },
  }
  const c = colors[variant] || colors.primary
  return (
    <button {...props} disabled={loading || props.disabled} style={{
      padding: '9px 18px', borderRadius: 8, border: 'none',
      background: c.bg, color: c.color,
      fontSize: 13, fontWeight: 700, cursor: 'pointer',
      opacity: (loading || props.disabled) ? 0.6 : 1,
      transition: 'opacity 0.2s, transform 0.1s',
      fontFamily: 'inherit',
      ...(props.style || {}),
    }}
      onMouseEnter={e => { if (!loading && !props.disabled) e.currentTarget.style.opacity = '0.85' }}
      onMouseLeave={e => { if (!loading && !props.disabled) e.currentTarget.style.opacity = '1' }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {loading ? '⟳ Loading...' : children}
    </button>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid var(--border2)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export function LiveDot({ active }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: active ? 'var(--green)' : 'var(--red)',
        boxShadow: active ? '0 0 8px var(--green)' : 'none',
        animation: active ? 'pulse 2s infinite' : 'none',
        display: 'inline-block',
      }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
    </span>
  )
}

export function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13,
          background: t.type === 'error' ? 'var(--red)' : t.type === 'warn' ? 'var(--yellow)' : 'var(--green)',
          color: '#fff', boxShadow: '0 8px 24px #0004',
          animation: 'slideIn 0.3s ease',
        }}>
          {t.msg}
        </div>
      ))}
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>
    </div>
  )
}
