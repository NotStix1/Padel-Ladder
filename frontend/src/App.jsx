import React from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage.jsx'
import CourtsPage from './pages/CourtsPage.jsx'
import CourtNewPage from './pages/CourtNewPage.jsx'
import LaddersPage from './pages/LaddersPage.jsx'
import LadderPage from './pages/LadderPage.jsx'
import { getAuthToken, setAuthToken, apiBaseUrl } from './api.js'
import ProfilePage from './pages/ProfilePage.jsx'
import CourtChallengesPage from './pages/CourtChallengesPage.jsx'
import LadderAdminPage from './pages/LadderAdminPage.jsx'
import TeamsPage from './pages/TeamsPage.jsx'

function Nav() {
  const navigate = useNavigate()
  const token = getAuthToken()
  return (
    <nav className="sticky top-0 z-10 backdrop-blur bg-slate-950/60 border-b border-slate-800">
      <div className="app-container flex items-center justify-between py-3">
        <Link to="/" className="text-white font-extrabold tracking-tight">Padel Ladder</Link>
        <div className="flex gap-2">
          <Link className="btn" to="/courts">Courts</Link>
          {token ? (
            <>
              <Link className="btn" to="/me">Profile</Link>
              <button className="btn" onClick={() => { setAuthToken(null); navigate('/'); }}>Logout</button>
            </>
          ) : (
            <Link className="btn" to="/auth">Login</Link>
          )}
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <div>
      <Nav />
      <div className="app-container pt-4">
        <Routes>
          <Route path="/" element={<Intro />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/courts" element={<CourtsPage />} />
          <Route path="/courts/new" element={<CourtNewPage />} />
          <Route path="/courts/:courtId/ladders" element={<LaddersPage />} />
          <Route path="/courts/:courtId/challenges" element={<CourtChallengesPage />} />
          <Route path="/ladders/:ladderId" element={<LadderPage />} />
          <Route path="/ladders/:ladderId/admin" element={<LadderAdminPage />} />
          <Route path="/ladders/:ladderId/teams" element={<TeamsPage />} />
          <Route path="/me" element={<ProfilePage />} />
        </Routes>
        <footer className="mt-6 text-xs text-slate-400">API: {apiBaseUrl}</footer>
      </div>
    </div>
  )
}

function Intro() {
  return (
    <div className="card">
      <h1 className="text-xl font-bold">Welcome</h1>
      <p className="mt-2 text-slate-300">Register or login to create courts and manage ladders. Join a ladder to challenge others and climb the rankings.</p>
      <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-300">
        <li>Authenticate to access protected actions</li>
        <li>Create a court to become its owner/admin</li>
        <li>Create ladders, join, issue challenges, and track standings</li>
      </ul>
    </div>
  )
}


