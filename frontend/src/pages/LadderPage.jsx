import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'

export default function LadderPage() {
  const { ladderId } = useParams()
  const [standings, setStandings] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [targetUserId, setTargetUserId] = useState('')

  useEffect(() => {
    api(`/ladders/${ladderId}/standings`, { auth: false })
      .then(setStandings)
      .catch(err => setError(err.message))
  }, [ladderId])

  async function join() {
    setError('')
    setLoading(true)
    try {
      await api(`/ladders/${ladderId}/join`, { method: 'POST' })
      const rows = await api(`/ladders/${ladderId}/standings`, { auth: false })
      setStandings(rows)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const higherRanked = useMemo(() => {
    const my = null // without profile, just allow any selection client-side
    return standings
  }, [standings])

  async function challenge() {
    if (!targetUserId) return
    setError('')
    setLoading(true)
    try {
      await api(`/challenges`, { method: 'POST', body: { ladderId, challengedUserId: targetUserId } })
      alert('Challenge sent')
      setTargetUserId('')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  // Group by division for display (A..G, Unknown last)
  const grouped = useMemo(() => {
    const groups = new Map()
    for (const s of standings) {
      const key = s.division || 'Unplaced'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(s)
    }
    return Array.from(groups.entries()).sort((a,b) => {
      if (a[0] === 'Unplaced') return 1
      if (b[0] === 'Unplaced') return -1
      return a[0].localeCompare(b[0])
    })
  }, [standings])

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Divisions</h2>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      <div className="mt-3 space-y-4">
        {grouped.map(([code, members]) => (
          <div key={code} className="border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Division {code}</div>
              <div className="text-xs text-slate-400">{members.length} players</div>
            </div>
            <ol className="mt-2 space-y-2">
              {members.map(m => (
                <li key={m.user_id} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{m.display_name}</div>
                    <div className="text-xs text-slate-400">{m.position ? `Pos ${m.position}` : (m.rank ? `Rank ${m.rank}` : '')}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn btn-primary" disabled={loading} onClick={join}>Join ladder</button>
      </div>
      <div className="mt-4">
        <label className="label">Challenge a player</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select className="input" value={targetUserId} onChange={e => setTargetUserId(e.target.value)}>
            <option value="">Select player…</option>
            {higherRanked.map(p => (
              <option key={p.user_id} value={p.user_id}>{p.display_name}{p.rank ? ` (rank ${p.rank})` : ''}</option>
            ))}
          </select>
          <button className="btn" disabled={loading || !targetUserId} onClick={challenge}>Send challenge</button>
        </div>
      </div>
    </div>
  )
}


