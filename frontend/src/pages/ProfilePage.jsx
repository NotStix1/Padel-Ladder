import React, { useEffect, useState } from 'react'
import { api, apiBaseUrl } from '../api.js'

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')

  // Inline default avatar (circle with user silhouette) to avoid external DNS issues
  const defaultAvatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1f2937"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="40" fill="url(#g)"/>
      <circle cx="40" cy="32" r="12" fill="#94a3b8"/>
      <rect x="20" y="50" width="40" height="18" rx="9" fill="#94a3b8"/>
    </svg>`
  )

  useEffect(() => {
    api('/profile/me').then(setProfile).catch(e => setError(e.message))
  }, [])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api('/profile/me', { method: 'PUT', body: { displayName: profile.display_name, cellphone: profile.cellphone, bio: profile.bio } })
      if (file) {
        const form = new FormData()
        form.append('avatar', file)
        const res = await fetch(`${apiBaseUrl}/profile/me/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }, body: form })
        if (!res.ok) throw new Error('Failed to upload avatar')
        const data = await res.json()
        setProfile(p => ({ ...p, avatar_url: data.url }))
      }
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  if (!profile) return <div className="card">{error ? <p className="text-red-400">{error}</p> : 'Loading…'}</div>

  const avatarSrc = profile.avatar_url ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : `${apiBaseUrl}${profile.avatar_url}`) : defaultAvatar

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">My profile</h2>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      <form onSubmit={save} className="mt-3 space-y-3">
        <div className="flex items-center gap-3">
          <img src={avatarSrc} alt="avatar" className="w-16 h-16 rounded-full object-cover border border-slate-700" />
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
        <div>
          <label className="label">Display name</label>
          <input className="input" value={profile.display_name || ''} onChange={e => setProfile({ ...profile, display_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Cellphone</label>
          <input className="input" value={profile.cellphone || ''} onChange={e => setProfile({ ...profile, cellphone: e.target.value })} />
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea className="input" rows={3} value={profile.bio || ''} onChange={e => setProfile({ ...profile, bio: e.target.value })} />
        </div>
        <button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  )
}


