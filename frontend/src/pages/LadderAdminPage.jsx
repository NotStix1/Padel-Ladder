import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'

export default function LadderAdminPage() {
  const { ladderId } = useParams()
  const [ladder, setLadder] = useState(null)
  const [divisions, setDivisions] = useState([])
  const [format, setFormat] = useState('singles')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/ladders/${ladderId}`, { auth: false }).then(l => {
      setLadder(l)
      setDivisions(l.rules?.divisions || [])
      setFormat(l.rules?.format || 'singles')
    }).catch(e => setError(e.message))
  }, [ladderId])

  function addDivision() {
    setDivisions([...divisions, { code: nextCode(divisions), capacity: 8 }])
  }
  function nextCode(divs) {
    const used = new Set(divs.map(d => d.code))
    const codes = ['A','B','C','D','E','F','G']
    for (const c of codes) if (!used.has(c)) return c
    return String.fromCharCode(65 + divs.length)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await api(`/ladders/${ladderId}/rules`, { method: 'PUT', body: { format } })
      await api(`/ladders/${ladderId}/divisions`, { method: 'PUT', body: { divisions } })
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  if (!ladder) return <div className="card">{error ? <p className="text-red-400">{error}</p> : 'Loading…'}</div>

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Ladder settings</h2>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      <div className="mt-3 space-y-3">
        <div>
          <label className="label">Format</label>
          <select className="input" value={format} onChange={e => setFormat(e.target.value)}>
            <option value="singles">Singles</option>
            <option value="doubles">Doubles (teams)</option>
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label">Divisions</label>
            <button className="btn" onClick={addDivision}>Add division</button>
          </div>
          <div className="mt-2 space-y-2">
            {divisions.map((d, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Code</label>
                  <input className="input" value={d.code} onChange={e => updateDivision(i, { ...d, code: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="label">Capacity</label>
                  <input className="input" type="number" min="1" value={d.capacity} onChange={e => updateDivision(i, { ...d, capacity: Number(e.target.value) })} />
                </div>
                <div className="flex items-end">
                  <button className="btn" onClick={() => removeDivision(i)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save settings'}</button>
        </div>
      </div>
    </div>
  )

  function updateDivision(index, next) {
    const arr = divisions.slice()
    arr[index] = next
    setDivisions(arr)
  }
  function removeDivision(index) {
    const arr = divisions.slice()
    arr.splice(index, 1)
    setDivisions(arr)
  }
}


