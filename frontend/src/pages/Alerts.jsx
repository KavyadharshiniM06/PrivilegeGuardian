import { useState, useEffect, useRef } from 'react'
import { api } from '../utils/api'
import { Badge, Table, Spinner, Btn } from '../components/UI'
import { format } from 'date-fns'

export default function Alerts({ addToast }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ severity: '', days: 30 })
  const intervalRef = useRef(null)

  const load = async () => {
    try {
      const data = await api.getAlerts(filter)
      setAlerts(data)
    } catch (e) { addToast('Failed to load alerts', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, 20000)
    return () => clearInterval(intervalRef.current)
  }, [filter])

  const acknowledge = async (id) => {
    try {
      await api.acknowledgeAlert(id)
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, acknowledged: true } : a))
      addToast('Alert acknowledged')
    } catch { addToast('Failed', 'error') }
  }

  const remove = async (id) => {
    try {
      await api.deleteAlert(id)
      setAlerts(prev => prev.filter(a => a._id !== id))
      addToast('Alert deleted')
    } catch { addToast('Failed', 'error') }
  }

  const columns = [
    { key: 'createdAt', label: 'Time', render: v => <span style={{ fontFamily:'JetBrains Mono', fontSize:11, color:'var(--text2)' }}>{v ? format(new Date(v), 'MM/dd HH:mm:ss') : '—'}</span> },
    { key: 'severity', label: 'Severity', render: v => <Badge label={v} /> },
    { key: 'username', label: 'User', render: v => <span style={{ fontWeight:700, color:'var(--accent)' }}>{v}</span> },
    { key: 'action', label: 'Action', render: v => <span style={{ fontFamily:'JetBrains Mono', fontSize:12 }}>{v}</span> },
    { key: 'file', label: 'Resource', render: v => <span style={{ fontFamily:'JetBrains Mono', fontSize:11, color:'var(--text2)' }}>{v}</span> },
    { key: 'riskScore', label: 'Risk', render: v => <span style={{ fontFamily:'JetBrains Mono', fontWeight:700, color: v>=85?'var(--red)':v>=75?'var(--orange)':v>=60?'var(--yellow)':'var(--cyan)' }}>{v}</span> },
    { key: 'acknowledged', label: 'Status', render: v => (
      <span style={{ fontSize:11, fontWeight:700, color: v ? 'var(--green)' : 'var(--yellow)' }}>{v ? '✓ ACK' : '● OPEN'}</span>
    )},
    { key: '_id', label: 'Actions', render: (id, row) => (
      <div style={{ display:'flex', gap:6 }}>
        {!row.acknowledged && <Btn onClick={() => acknowledge(id)} variant="ghost" style={{ padding:'4px 10px', fontSize:11 }}>Ack</Btn>}
        <Btn onClick={() => remove(id)} variant="danger" style={{ padding:'4px 10px', fontSize:11 }}>Del</Btn>
      </div>
    )},
  ]

  const unacked = alerts.filter(a => !a.acknowledged).length

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>Security Alerts</h1>
          <div style={{ color:'var(--text2)', fontSize:13 }}>
            {unacked > 0 ? <span style={{ color:'var(--red)', fontWeight:700 }}>{unacked} unacknowledged</span> : 'All acknowledged'}
            {' · '}{alerts.length} total
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <select value={filter.severity} onChange={e => setFilter(f=>({...f,severity:e.target.value}))}
            style={{ padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13 }}>
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select value={filter.days} onChange={e => setFilter(f=>({...f,days:+e.target.value}))}
            style={{ padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13 }}>
            <option value={1}>24h</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
          <Btn onClick={load} variant="ghost">↻ Refresh</Btn>
        </div>
      </div>

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        {loading ? <Spinner /> : <Table columns={columns} data={alerts} emptyMsg="No alerts — system is clean ✓" />}
      </div>
    </div>
  )
}
