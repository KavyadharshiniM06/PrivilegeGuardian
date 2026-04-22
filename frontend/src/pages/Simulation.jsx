import { useState } from 'react'
import { api } from '../utils/api'
import { Btn, Badge, RiskBar } from '../components/UI'

const PRESETS = [
  { label: '🔴 Shadow File Attack', username:'mallory', action:'delete', file:'/etc/shadow', status:'denied' },
  { label: '🟠 Root Privilege Escalation', username:'root', action:'sudo', file:'/bin/bash', status:'allowed' },
  { label: '🟡 SSH Brute Force', username:'attacker', action:'ssh_login', file:'ssh_from_192.168.1.100', status:'denied' },
  { label: '🔴 Add Backdoor User', username:'root', action:'add_user', file:'/etc/passwd', status:'allowed' },
  { label: '🟠 Crontab Modification', username:'bob', action:'write', file:'/etc/crontab', status:'allowed' },
  { label: '🟡 Suspicious Execution', username:'www-data', action:'execute', file:'/tmp/payload.sh', status:'denied' },
  { label: '🔵 Normal Read', username:'alice', action:'read', file:'/var/log/app.log', status:'allowed' },
  { label: '🔴 SELinux Denial', username:'root', action:'selinux_denial', file:'/proc/sys/kernel', status:'denied' },
]

const ACTIONS = ['read','write','delete','execute','login','logout','sudo','ssh_login','chmod','chown','mount','network','add_user','del_user','file_modified','selinux_denial','promisc_mode','seccomp_kill']

export default function Simulation({ addToast }) {
  const [form, setForm] = useState({ username:'root', action:'delete', file:'/etc/shadow', status:'denied' })
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  const loadPreset = (p) => setForm({ username:p.username, action:p.action, file:p.file, status:p.status })

  const calcRisk = () => {
    // Frontend risk estimate matching backend engine
    const BASE = { read:10, open:10, write:40, delete:70, unlink:70, execute:45, sudo:55, su:55, add_user:75, del_user:75, selinux_denial:70, promisc_mode:80, seccomp_kill:80, file_modified:65, ssh_login:20, network:30, chmod:50, chown:55, mount:60, login:15, logout:5 }
    const PRIVILEGED = ['root','admin_user','admin','0']
    const SENSITIVE = ['secure','critical','etc','shadow','passwd','sudoers','authorized_keys','id_rsa','.ssh','crontab','credentials','private','secret','token','key','cert']
    const CRITICAL_ACTIONS = ['selinux_denial','promisc_mode','seccomp_kill','file_modified','add_user','del_user']

    const base = BASE[form.action] ?? 20
    const priv = PRIVILEGED.includes(form.username) ? 20 : 0
    const denied = form.status === 'denied' ? 30 : 0
    const critical = CRITICAL_ACTIONS.includes(form.action) ? 15 : 0
    const fp = form.file.toLowerCase()
    const sensitive = SENSITIVE.some(kw => fp.includes(kw)) ? 30 : 0
    const score = Math.min(base + priv + denied + sensitive + critical, 100)
    const severity = score >= 85 ? 'CRITICAL' : score >= 75 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW'
    setPreview({ score, severity, breakdown: { base, priv, denied, sensitive, critical } })
  }

  const send = async () => {
    setLoading(true)
    try {
      await api.ingestEvent({ ...form, time: new Date().toISOString() })
      addToast(`Event ingested: ${form.action} by ${form.username}`)
      setHistory(h => [{ ...form, time: new Date().toISOString() }, ...h].slice(0, 20))
    } catch (e) { addToast(e.message || 'Failed', 'error') }
    finally { setLoading(false) }
  }

  const sendBurst = async () => {
    setLoading(true)
    try {
      for (let i = 0; i < 10; i++) {
        await api.ingestEvent({ ...form, time: new Date().toISOString() })
        await new Promise(r => setTimeout(r, 100))
      }
      addToast('10 events sent (burst)')
    } catch (e) { addToast(e.message || 'Failed', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>Attack Simulation</h1>
        <p style={{ color:'var(--text2)', fontSize:13 }}>Inject test events into the SIEM to verify detection and alerting</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Form */}
        <div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:16 }}>
            <h3 style={{ fontWeight:700, marginBottom:16, fontSize:14 }}>Quick Presets</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {PRESETS.map((p,i) => (
                <button key={i} onClick={() => loadPreset(p)} style={{
                  padding:'9px 14px', background:'var(--surface2)', border:'1px solid var(--border)',
                  borderRadius:8, color:'var(--text)', fontSize:13, cursor:'pointer', textAlign:'left',
                  transition:'border-color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
                >{p.label}</button>
              ))}
            </div>
          </div>

          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
            <h3 style={{ fontWeight:700, marginBottom:16, fontSize:14 }}>Custom Event</h3>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:4 }}>USERNAME</label>
              <input value={form.username} onChange={e => setForm(f=>({...f,username:e.target.value}))}
                style={{ width:'100%', padding:'9px 12px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13, fontFamily:'inherit' }} />
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:4 }}>ACTION</label>
              <select value={form.action} onChange={e => setForm(f=>({...f,action:e.target.value}))}
                style={{ width:'100%', padding:'9px 12px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13 }}>
                {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:4 }}>RESOURCE PATH</label>
              <input value={form.file} onChange={e => setForm(f=>({...f,file:e.target.value}))}
                style={{ width:'100%', padding:'9px 12px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13, fontFamily:'JetBrains Mono' }} />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:4 }}>STATUS</label>
              <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}
                style={{ width:'100%', padding:'9px 12px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', fontSize:13 }}>
                <option value="allowed">Allowed</option>
                <option value="denied">Denied</option>
              </select>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <Btn onClick={calcRisk} variant="ghost" style={{ flex:1 }}>Preview Risk</Btn>
              <Btn onClick={send} loading={loading} style={{ flex:1 }}>Send Event</Btn>
            </div>
            <Btn onClick={sendBurst} loading={loading} variant="ghost" style={{ width:'100%', marginTop:8 }}>⚡ Send 10x Burst</Btn>
          </div>
        </div>

        {/* Preview + History */}
        <div>
          {preview && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:16 }}>
              <h3 style={{ fontWeight:700, marginBottom:16, fontSize:14 }}>Risk Preview</h3>
              <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:48, fontWeight:800, color: preview.score>=85?'var(--red)':preview.score>=75?'var(--orange)':preview.score>=60?'var(--yellow)':'var(--cyan)' }}>{preview.score}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>RISK SCORE</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ marginBottom:8 }}><Badge label={preview.severity} /></div>
                  <RiskBar score={preview.score} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {Object.entries(preview.breakdown).map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'var(--surface2)', borderRadius:6 }}>
                    <span style={{ fontSize:12, color:'var(--text2)', textTransform:'capitalize' }}>{k}</span>
                    <span style={{ fontFamily:'JetBrains Mono', fontSize:12, fontWeight:700, color: v>0?'var(--orange)':'var(--text3)' }}>+{v}</span>
                  </div>
                ))}
              </div>
              {preview.score >= 50 && (
                <div style={{ marginTop:12, padding:10, background:'var(--red)18', border:'1px solid var(--red)44', borderRadius:8, fontSize:12, color:'var(--red)' }}>
                  ⚠ This event will trigger an alert (risk ≥ 50)
                </div>
              )}
            </div>
          )}

          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
            <h3 style={{ fontWeight:700, marginBottom:16, fontSize:14 }}>Sent Events</h3>
            {history.length === 0 ? (
              <div style={{ color:'var(--text3)', fontSize:13 }}>No events sent yet</div>
            ) : history.map((e, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                <Badge label={e.status} type="status" />
                <span style={{ fontWeight:700, color:'var(--accent)' }}>{e.username}</span>
                <span style={{ color:'var(--text2)' }}>{e.action}</span>
                <span style={{ color:'var(--text3)', flex:1, overflow:'hidden', textOverflow:'ellipsis' }}>{e.file}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
