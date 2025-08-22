import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'

export default function TeamsPage() {
  const { ladderId } = useParams()
  const [teams, setTeams] = useState([])
  const [partnerId, setPartnerId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { refresh() }, [ladderId])
  async function refresh() {
    try { setTeams(await api(`/teams/${ladderId}`)) } catch (e) { setError(e.message) }
  }

  async function createTeam() {
    setLoading(true); setError('')
    try { await api(`/teams/${ladderId}`, { method: 'POST', body: { partnerUserId: partnerId } }); setPartnerId(''); await refresh() } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">My teams</h2>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input className="input" placeholder="Partner user id" value={partnerId} onChange={e => setPartnerId(e.target.value)} />
        <button className="btn btn-primary" disabled={loading || !partnerId} onClick={createTeam}>Create team</button>
      </div>
      <ul className="mt-3 space-y-2">
        {teams.map(t => (
          <li key={t.id} className="flex items-center justify-between">
            <div className="text-sm">Team {t.id.slice(0,8)}…</div>
            <div className="text-xs text-slate-400">Division {t.division || '-'} {t.position ? `• Pos ${t.position}` : ''}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}


