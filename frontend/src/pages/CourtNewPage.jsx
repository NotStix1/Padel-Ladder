import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export default function CourtNewPage() {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const court = await api('/courts', { method: 'POST', body: { name, location } })
      navigate(`/courts/${court.id}/ladders`)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Register court</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div>
          <button className="btn btn-primary" disabled={loading} type="submit">{loading ? 'Please wait…' : 'Create court'}</button>
        </div>
      </form>
    </div>
  )
}


