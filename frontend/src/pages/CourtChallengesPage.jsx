import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'

export default function CourtChallengesPage() {
  const { courtId } = useParams()
  const [items, setItems] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/courts/${courtId}/challenges`, { auth: false }).then(setItems).catch(e => setError(e.message))
  }, [courtId])

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Challenges</h2>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      <ul className="mt-3 space-y-3">
        {items.map(c => (
          <li key={c.id} className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{c.challenger_name} vs {c.challenged_name}</div>
              <div className="text-xs text-slate-400">{c.status} {c.scheduled_at ? `• ${new Date(c.scheduled_at).toLocaleString()}` : ''}</div>
              {c.status === 'COMPLETED' && c.scores_json && (
                <div className="text-xs text-slate-400">Scores: {JSON.parse(c.scores_json).map(s => s.join('-')).join(', ')}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}


