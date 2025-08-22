import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setAuthToken } from '../api.js'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [cellphone, setCellphone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login'
        ? { email, password }
        : { email, password, firstName, lastName, cellphone }
      const data = await api(path, { method: 'POST', body, auth: false })
      setAuthToken(data.token)
      navigate('/courts')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">{mode === 'login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        {mode === 'register' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">First name</label>
                <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label className="label">Last name</label>
                <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="label">Cellphone</label>
              <input className="input" value={cellphone} onChange={e => setCellphone(e.target.value)} inputMode="tel" placeholder="e.g. +1 555 555 5555" />
            </div>
          </>
        )}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input className="input pr-11" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword(s => !s)} className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-200">
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M1.5 12s3.75-7.5 10.5-7.5S22.5 12 22.5 12 18.75 19.5 12 19.5 1.5 12 1.5 12Zm10.5 3.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.53 2.47a.75.75 0 1 0-1.06 1.06l1.872 1.872A12.58 12.58 0 0 0 1.5 12s3.75 7.5 10.5 7.5a11.3 11.3 0 0 0 5.145-1.209l2.325 2.334a.75.75 0 1 0 1.06-1.061L3.53 2.47ZM12 6.75c.62 0 1.214.092 1.773.262l-1.26 1.26A3.75 3.75 0 0 0 8.272 12l-1.5 1.5A5.25 5.25 0 0 1 12 6.75Z"/></svg>
              )}
            </button>
          </div>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button className="btn btn-primary" disabled={loading} type="submit">{loading ? 'Please wait…' : (mode === 'login' ? 'Login' : 'Create account')}</button>
          <button type="button" className="btn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Need an account?' : 'Have an account?'}
          </button>
        </div>
      </form>
    </div>
  )
}


