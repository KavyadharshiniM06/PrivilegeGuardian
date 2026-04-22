import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../utils/api'
import { Badge, RiskBar, Table, Spinner, Btn, LiveDot } from '../components/UI'
import { format } from 'date-fns'

const ACTIONS = ['read','write','delete','execute','login','logout','sudo','ssh_login','chmod','chown','mount','network','add_user','del_user','file_modified','selinux_denial','promisc_mode','seccomp_kill']

export default function Events({ liveEvents }) {
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ user: '', status: '', action: '', minRisk: 0, maxRisk: 100, days: 30 })
  const [showLive, setShowLive] = useState(false)
  const intervalRef = useRef(null)

  const load = useCallback(async (pg = page) => {
    setLoading(true)
    try {
      const res = await api.getEvents({ page: pg, limit: 50, ...filters })
      setEvents(res.events || [])
      setTotal(res.total || 0)
      setPages(res.pages || 1)
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => {
    load(1); setPage(1)
    intervalRef.current = setInterval(() => load(1), 30000)
    return () => clearInterval(intervalRef.current)
  }, [filters])

  useEffect(() => { load() }, [page])

  const displayed = showLive && liveEvents.length > 0 ? liveEvents : events

  const columns = [
    { key: 'timestamp', label: 'Time', render: v => <span style={{ fontFamily:'JetBrains Mono', fontSize:11, color:'var(--text2)' }}>{v ? format(new Date(v), 'MM/dd HH:mm:ss') : '—'}</span> },
    { key: 'username', label: 'User', render: v => <span style={{ fontWeight:700, color:'var(--accent)' }}>{v}</span> },
    { key: 'action', label: 'Action', render: v => <span style={{ fontFamily:'JetBrains Mono', fontSize:12 }}>{v}</span> },
    { key: 'file', label: 'Resource', render: v => <span style={{ fontFamily:'JetBrains Mono', fontSize:11, color:'var(--text2)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{v}</span> },
    { key: 'status', label: 'Status', render: v => <Badge label={v} type="status" /> },
    { key: 'finalRisk', label: 'Risk', render: v => <RiskBar score={v} /> },
    { key: 'rawType', label: 'Type', render: v => v ? <span style={{ fontFamily:'JetBrains Mono', fontSize:10, color:'var(--text3)' }}>{v}</span> : '—' },
  ]

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>Audit Events</h1>
          <div style={{ color:'var(--text2)', fontSize:13 }}>{total.toLocaleString()} total events</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => setShowLive(v => !v)} style={{
            padding:'8px 16px', borderRadius:8, border:`1px solid ${showLive?'var(--accent)':'var(--border2)'}`,
            background: showLive ? 'var(--accent)22' : 'var(--surface)', color: showLive ? 'var(--accent)' : 'var(--text2)',
            cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6,
          }}>
            <LiveDot active={liveEvents.length > 0} /> Live ({liveEvents.length})
          </button>
          <Btn onClick={() => load(1)} variant="ghost">↻ Refresh</Btn>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:20 }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:4 }}>USER</label>
            <input value={filters.user} onChange={e => setFilters(f=>({...f,user:e.target.value}))}
              placeholder="Filter user..." style={{ padding:'8px 12px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13, width:140, fontFamily:'inherit' }} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:4 }}>STATUS</label>
            <select value={filters.status} onChange={e => setFilters(f=>({...f,status:e.target.value}))}
              style={{ padding:'8px 12px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13 }}>
              <option value="">All</option>
              <option value="allowed">Allowed</option>
              <option value="denied">Denied</option>
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:4 }}>ACTION</label>
            <select value={filters.action} onChange={e => setFilters(f=>({...f,action:e.target.value}))}
              style={{ padding:'8px 12px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13 }}>
              <option value="">All</option>
              {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:4 }}>MIN RISK</label>
            <input type="number" value={filters.minRisk} min={0} max={100}
              onChange={e => setFilters(f=>({...f,minRisk:+e.target.value}))}
              style={{ padding:'8px 12px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13, width:80, fontFamily:'inherit' }} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:4 }}>DAYS</label>
            <select value={filters.days} onChange={e => setFilters(f=>({...f,days:+e.target.value}))}
              style={{ padding:'8px 12px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13 }}>
              <option value={1}>24h</option>
              <option value={7}>7d</option>
              <option value={30}>30d</option>
              <option value={90}>90d</option>
            </select>
          </div>
          <Btn onClick={() => setFilters({ user:'', status:'', action:'', minRisk:0, maxRisk:100, days:30 })} variant="ghost">Clear</Btn>
        </div>
      </div>

      {/* Table */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        {loading ? <Spinner /> : <Table columns={columns} data={displayed} emptyMsg="No events match your filters" />}
      </div>

      {/* Pagination */}
      {!showLive && pages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, marginTop:20 }}>
          <Btn onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page<=1} variant="ghost">← Prev</Btn>
          <span style={{ color:'var(--text2)', fontSize:13 }}>Page {page} of {pages}</span>
          <Btn onClick={() => setPage(p=>Math.min(pages,p+1))} disabled={page>=pages} variant="ghost">Next →</Btn>
        </div>
      )}
    </div>
  )
}
