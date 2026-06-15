import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#76b900' }}>Loading...</div>
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login initialMode="signup" />} />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    )
  }

  if (!profile?.onboarded) {
    return (
      <Onboarding
        userId={session.user.id}
        userName={session.user.user_metadata?.display_name || ''}
        onComplete={() => loadProfile(session.user.id)}
      />
    )
  }

  return (
    <AuthenticatedApp
      userId={session.user.id}
      profile={profile}
      onProfileUpdate={() => loadProfile(session.user.id)}
    />
  )
}

function AuthenticatedApp({ userId, profile, onProfileUpdate }) {
  const [view, setView] = useState('dashboard')

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (view === 'profile') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={topNav}>
          <button style={backBtn} onClick={() => setView('dashboard')}>← Back to chats</button>
          <button style={logoutNavBtn} onClick={handleLogout}>Log out</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Profile userId={userId} />
        </div>
      </div>
    )
  }

  return (
    <Dashboard
      userId={userId}
      profile={profile}
      onNavigate={(v) => setView(v)}
      onLogout={handleLogout}
    />
  )
}

const topNav = {
  padding: '12px 20px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const backBtn = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}

const logoutNavBtn = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 500,
  padding: '6px 14px',
  cursor: 'pointer',
}
