import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

export default function LaddersPage() {
  const { courtId } = useParams()
  const [ladders, setLadders] = useState([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api(`/ladders?courtId=${encodeURIComponent(courtId)}`, { auth: false })
      .then(setLadders)
      .catch(err => setError(err.message))
  }, [courtId])

  async function createLadder(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const ladder = await api('/ladders', { method: 'POST', body: { courtId, name, description } })
      setLadders([ladder, ...ladders])
      setName('')
      setDescription('')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Ladders</h2>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      <form onSubmit={createLadder} className="mt-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" disabled={loading} type="submit">{loading ? 'Please wait…' : 'Create ladder'}</button>
      </form>
      <ul className="mt-4 space-y-3">
        {ladders.map(l => (
          <li key={l.id} className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{l.name}</div>
              <div className="text-xs text-slate-400">{l.description || 'No description'}</div>
            </div>
            <Link className="btn" to={`/ladders/${l.id}`}>Open</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}


