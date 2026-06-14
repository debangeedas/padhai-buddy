import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  logo: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--accent)',
  },
  links: {
    display: 'flex',
    gap: 24,
    alignItems: 'center',
  },
  link: (active) => ({
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: active ? 600 : 400,
  }),
  logoutBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 13,
  },
}

export default function Navbar({ user }) {
  const location = useLocation()

  return (
    <nav style={styles.nav}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <span style={styles.logo}>Padhai Buddy</span>
      </Link>
      <div style={styles.links}>
        <Link to="/" style={styles.link(location.pathname === '/')}>Chat</Link>
        <Link to="/history" style={styles.link(location.pathname === '/history')}>History</Link>
        <Link to="/profile" style={styles.link(location.pathname === '/profile')}>Profile</Link>
        <button style={styles.logoutBtn} onClick={() => supabase.auth.signOut()}>
          Logout
        </button>
      </div>
    </nav>
  )
}
