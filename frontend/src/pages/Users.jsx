import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { Table, Spinner, Btn, Modal, Input, Select } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'

export default function Users({ addToast }) {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'auditor' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch { addToast('Failed to load users', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.username || !form.password) { addToast('Fill all fields', 'warn'); return }
    setSaving(true)
    try {
      await api.createUser(form)
      addToast(`User ${form.username} created`)
      setModal(false)
      setForm({ username: '', password: '', role: 'auditor' })
      load()
    } catch (e) { addToast(e.message || 'Failed', 'error') }
    finally { setSaving(false) }
  }

  const remove = async (id, username) => {
    if (username === me?.username) { addToast("Can't delete yourself", 'error'); return }
    if (!confirm(`Delete user ${username}?`)) return
    try {
      await api.deleteUser(id)
      addToast(`User ${username} deleted`)
      load()
    } catch { addToast('Failed', 'error') }
  }

  const columns = [
    { key: 'username', label: 'Username', render: v => <span style={{ fontWeight:700, color:'var(--accent)' }}>{v}</span> },
    { key: 'role', label: 'Role', render: v => (
      <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background: v==='admin'?'var(--purple)22':'var(--cyan)22', color: v==='admin'?'var(--purple)':'var(--cyan)', border:`1px solid ${v==='admin'?'var(--purple)':'var(--cyan)'}44` }}>{v.toUpperCase()}</span>
    )},
    { key: 'createdAt', label: 'Created', render: v => <span style={{ fontFamily:'JetBrains Mono', fontSize:11, color:'var(--text2)' }}>{v ? format(new Date(v), 'MM/dd/yyyy') : '—'}</span> },
    { key: '_id', label: 'Actions', render: (id, row) => (
      <Btn onClick={() => remove(id, row.username)} variant="danger" style={{ padding:'4px 12px', fontSize:11 }}>Delete</Btn>
    )},
  ]

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>User Management</h1>
          <div style={{ color:'var(--text2)', fontSize:13 }}>{users.length} SIEM users</div>
        </div>
        <Btn onClick={() => setModal(true)}>+ New User</Btn>
      </div>

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        {loading ? <Spinner /> : <Table columns={columns} data={users} emptyMsg="No users found" />}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Create New User">
        <Input label="Username" value={form.username} onChange={e => setForm(f=>({...f,username:e.target.value}))} placeholder="john_doe" />
        <Input label="Password" type="password" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder="••••••••" />
        <Select label="Role" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
          <option value="auditor">Auditor</option>
          <option value="admin">Admin</option>
        </Select>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
          <Btn onClick={create} loading={saving}>Create User</Btn>
        </div>
      </Modal>
    </div>
  )
}
