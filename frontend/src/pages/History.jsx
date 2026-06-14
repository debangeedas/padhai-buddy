import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const styles = {
  container: {
    maxWidth: 700,
    margin: '0 auto',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 20,
  },
  sessionCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    cursor: 'pointer',
  },
  sessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  msgCount: {
    fontSize: 12,
    color: 'var(--accent)',
    background: 'var(--accent-dim)',
    padding: '2px 8px',
    borderRadius: 10,
  },
  preview: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  expanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  msg: (role) => ({
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
    background: role === 'user' ? 'var(--user-bg)' : 'var(--bg-primary)',
    border: `1px solid ${role === 'user' ? 'var(--user-border)' : 'var(--border)'}`,
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    maxWidth: '85%',
  }),
  msgLabel: {
    fontSize: 10,
    color: 'var(--accent)',
    fontWeight: 600,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  empty: {
    textAlign: 'center',
    padding: 40,
    color: 'var(--text-secondary)',
  },
}

export default function History({ userId }) {
  const [sessions, setSessions] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [messages, setMessages] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [userId])

  async function loadSessions() {
    const { data } = await supabase
      .from('chat_sessions')
      .select('*, messages(count)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data) {
      const nonEmpty = data.filter((s) => (s.messages?.[0]?.count || 0) > 0)
      setSessions(nonEmpty)
    }
    setLoading(false)
  }

  async function toggleSession(sessionId) {
    if (expandedId === sessionId) {
      setExpandedId(null)
      return
    }

    if (!messages[sessionId]) {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (data) {
        setMessages((prev) => ({ ...prev, [sessionId]: data }))
      }
    }

    setExpandedId(sessionId)
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return null

  return (
    <div style={styles.container}>
      <div style={styles.title}>Chat History</div>

      {sessions.length === 0 && (
        <div style={styles.empty}>No chat sessions yet. Start a conversation!</div>
      )}

      {sessions.map((session) => {
        const msgCount = session.messages?.[0]?.count || 0
        const sessionMsgs = messages[session.id] || []
        const firstUserMsg = sessionMsgs.find((m) => m.role === 'user')

        return (
          <div
            key={session.id}
            style={styles.sessionCard}
            onClick={() => toggleSession(session.id)}
          >
            <div style={styles.sessionHeader}>
              <span style={styles.date}>{formatDate(session.created_at)}</span>
              <span style={styles.msgCount}>{msgCount} messages</span>
            </div>
            {firstUserMsg && <div style={styles.preview}>{firstUserMsg.content}</div>}

            {expandedId === session.id && sessionMsgs.length > 0 && (
              <div style={styles.expanded} onClick={(e) => e.stopPropagation()}>
                {sessionMsgs.map((msg) => (
                  <div key={msg.id} style={styles.msg(msg.role)}>
                    <div style={styles.msgLabel}>
                      {msg.role === 'user' ? 'Tum' : 'Padhai Buddy'}
                    </div>
                    {msg.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
