import { useState, useEffect, useRef } from 'react'
import { api } from '../utils/api'
import { StatCard, Badge, RiskBar, Spinner, LiveDot } from '../components/UI'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { format } from 'date-fns'

export default function Dashboard({ liveEvents, addToast }) {
  const [stats, setStats] = useState(null)
  const [riskTime, setRiskTime] = useState([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)
  const intervalRef = useRef(null)

  const load = async () => {
    try {
      const [s, r] = await Promise.all([api.getStats(days), api.getRiskOverTime(days)])
      setStats(s)
      setRiskTime(r.map(d => ({ ...d, time: d._id?.slice(11, 16) || d._id })))
    } catch (e) {
      addToast('Failed to load stats', 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, 15000)
    return () => clearInterval(intervalRef.current)
  }, [days])

  if (loading) return <Spinner />

  const alertBreakdown = [
    { name: 'CRITICAL', count: stats?.critical || 0, color: 'var(--red)' },
    { name: 'HIGH', count: stats?.high || 0, color: 'var(--orange)' },
    { name: 'MEDIUM', count: stats?.medium || 0, color: 'var(--yellow)' },
    { name: 'LOW', count: stats?.low || 0, color: 'var(--cyan)' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)', fontSize: 13 }}>
            <LiveDot active={liveEvents.length > 0} />
            {liveEvents.length > 0 ? `${liveEvents.length} live events received` : 'Polling every 15s'}
          </div>
        </div>
        <select
          value={days}
          onChange={e => setDays(+e.target.value)}
          style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
        >
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Events" value={stats?.totalEvents?.toLocaleString() || 0} icon="📋" color="var(--accent)" />
        <StatCard label="Denied Actions" value={stats?.deniedEvents?.toLocaleString() || 0} icon="🚫" color="var(--red)" />
        <StatCard label="Avg Risk Score" value={stats?.avgRisk || 0} icon="📊" color="var(--yellow)" sub={`Max: ${stats?.maxRisk || 0}`} />
        <StatCard label="Active Users" value={stats?.uniqueUsers || 0} icon="👤" color="var(--cyan)" />
        <StatCard label="Total Alerts" value={stats?.totalAlerts || 0} icon="🔔" color="var(--orange)" />
        <StatCard label="Critical" value={stats?.critical || 0} icon="🔴" color="var(--red)" />
        <StatCard label="High" value={stats?.high || 0} icon="🟠" color="var(--orange)" />
        <StatCard label="Medium" value={stats?.medium || 0} icon="🟡" color="var(--yellow)" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Risk Over Time */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Risk Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={riskTime}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" stroke="var(--text3)" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="var(--text3)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="avgRisk" stroke="var(--accent)" fill="url(#riskGrad)" strokeWidth={2} name="Avg Risk" />
              <Area type="monotone" dataKey="maxRisk" stroke="var(--red)" fill="none" strokeWidth={1} strokeDasharray="4 4" name="Max Risk" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Alert Breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Alert Severity</h3>
          {alertBreakdown.map(a => (
            <div key={a.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <Badge label={a.name} />
                <span style={{ color: a.color, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>{a.count}</span>
              </div>
              <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${stats?.totalAlerts ? (a.count / stats.totalAlerts) * 100 : 0}%`,
                  height: '100%', background: a.color, borderRadius: 3, transition: 'width 0.5s',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Breakdown Chart */}
      {stats?.actionBreakdown?.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Actions Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.actionBreakdown.slice(0, 12)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="_id" stroke="var(--text3)" fontSize={11} />
              <YAxis stroke="var(--text3)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="allowed" stackId="a" fill="var(--green)" radius={[0,0,0,0]} name="Allowed" />
              <Bar dataKey="denied" stackId="a" fill="var(--red)" radius={[4,4,0,0]} name="Denied" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Users + Live Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top Users */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Top Risk Users</h3>
          {(stats?.topUsers || []).map((u, i) => (
            <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono', width: 16 }}>#{i + 1}</span>
              <span style={{ fontWeight: 600, fontSize: 13, minWidth: 100 }}>{u._id}</span>
              <div style={{ flex: 1 }}><RiskBar score={Math.round(u.avgRisk)} /></div>
              <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 60, textAlign: 'right' }}>{u.total} events</span>
            </div>
          ))}
          {!stats?.topUsers?.length && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No user data</div>}
        </div>

        {/* Live Feed */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14 }}>Live Event Feed</h3>
            <LiveDot active={liveEvents.length > 0} />
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {liveEvents.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Waiting for events... (use Simulation page to generate)</div>
            ) : liveEvents.map((e, i) => (
              <div key={e._id || i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                borderBottom: '1px solid var(--border)', fontSize: 12,
                animation: i === 0 ? 'fadeIn 0.3s ease' : 'none',
              }}>
                <Badge label={e.status} type="status" />
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{e.username}</span>
                <span style={{ color: 'var(--text2)' }}>→</span>
                <span style={{ color: 'var(--text)' }}>{e.action}</span>
                <span style={{ color: 'var(--text3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.file}</span>
                <span style={{ color: e.finalRisk >= 75 ? 'var(--red)' : 'var(--text3)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{e.finalRisk}</span>
              </div>
            ))}
          </div>
          <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none} }`}</style>
        </div>
      </div>
    </div>
  )
}
