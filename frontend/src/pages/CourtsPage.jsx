import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function CourtsPage() {
  const [courts, setCourts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api('/courts', { auth: false })
      .then(setCourts)
      .catch(err => setError(err.message))
  }, [])

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Courts</h2>
        <Link className="btn btn-primary" to="/courts/new">Register court</Link>
      </div>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      <ul className="mt-3 space-y-3">
        {courts.map(c => (
          <li key={c.id} className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-slate-400">{c.location || 'Unknown'} — owner: {c.owner_name}</div>
            </div>
            <Link className="btn" to={`/courts/${c.id}/ladders`}>View ladders</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}


