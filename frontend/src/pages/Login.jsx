import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 24,
  },
  backLink: {
    position: 'absolute',
    top: 24,
    left: 32,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 40,
    width: '100%',
    maxWidth: 400,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: 8,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    marginBottom: 32,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 14,
    marginBottom: 12,
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    fontSize: 14,
    fontWeight: 600,
    marginTop: 8,
  },
  toggle: {
    marginTop: 16,
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  error: {
    color: 'var(--danger)',
    fontSize: 13,
    marginTop: 8,
  },
}

export default function Login({ initialMode }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <Link to="/" style={styles.backLink}>← Back</Link>

      <form style={styles.card} onSubmit={handleSubmit}>
        <div style={styles.title}>Padhai Buddy</div>
        <div style={styles.subtitle}>
          {isSignUp ? 'Create your account' : 'Welcome back!'}
        </div>

        {isSignUp && (
          <input
            style={styles.input}
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <input
          style={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? '...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.toggle}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link to={isSignUp ? '/login' : '/signup'}>
            {isSignUp ? 'Sign in' : 'Sign up'}
          </Link>
        </div>
      </form>
    </div>
  )
}
