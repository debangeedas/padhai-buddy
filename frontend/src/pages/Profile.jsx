import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import AvatarPicker, { AVATARS } from '../components/AvatarPicker'
import ActivityGrid from '../components/ActivityGrid'

const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'hindi', label: 'Hindi' },
]

const styles = {
  container: {
    maxWidth: 700,
    margin: '0 auto',
    padding: 24,
  },
  section: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 16,
    color: 'var(--accent)',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  bigAvatar: {
    fontSize: 56,
    width: 80,
    height: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
    borderRadius: '50%',
    border: '2px solid var(--accent)',
  },
  nameInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    marginBottom: 12,
  },
  langGrid: {
    display: 'flex',
    gap: 10,
  },
  langOption: (selected) => ({
    flex: 1,
    padding: '12px 16px',
    borderRadius: 8,
    border: selected ? '2px solid var(--accent)' : '2px solid var(--border)',
    background: selected ? 'var(--accent-dim)' : 'var(--bg-primary)',
    color: selected ? 'var(--accent)' : 'var(--text-secondary)',
    textAlign: 'center',
    cursor: 'pointer',
    fontWeight: selected ? 600 : 400,
    fontSize: 14,
  }),
  saveBtn: {
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    fontWeight: 600,
    fontSize: 14,
    marginTop: 8,
  },
  saved: {
    color: 'var(--accent)',
    fontSize: 13,
    marginLeft: 12,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    background: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  progressBarFill: (pct, color) => ({
    height: '100%',
    width: `${pct}%`,
    borderRadius: 4,
    background: color,
    transition: 'width 0.4s ease',
  }),
  quizHistoryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
  },
  quizDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  quizScoreBadge: (pct) => ({
    fontSize: 13,
    fontWeight: 700,
    color: pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ff4444',
    whiteSpace: 'nowrap',
  }),
  miniBar: {
    height: 6,
    borderRadius: 3,
    background: 'var(--bg-card)',
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s',
  },
}

export default function Profile({ userId }) {
  const [profile, setProfile] = useState({
    display_name: '',
    avatar_id: 'owl',
    language: 'english',
  })
  const [activity, setActivity] = useState({})
  const [quizHistory, setQuizHistory] = useState([])
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
    loadActivity()
    loadQuizHistory()
  }, [userId])

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (data) {
      setProfile({
        display_name: data.display_name || '',
        avatar_id: data.avatar_id || 'owl',
        language: data.language || 'english',
      })
    }
    setLoading(false)
  }

  async function loadActivity() {
    const { data } = await supabase
      .from('messages')
      .select('created_at')
      .eq('user_id', userId)
      .eq('role', 'user')

    if (data) {
      const counts = {}
      data.forEach((msg) => {
        const day = msg.created_at.split('T')[0]
        counts[day] = (counts[day] || 0) + 1
      })
      setActivity(counts)
    }
  }

  async function loadQuizHistory() {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, subject, data, created_at')
      .eq('user_id', userId)
      .eq('type', 'quiz')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) console.error('[Profile] Quiz history error:', error.message)
    if (data) {
      setQuizHistory(data.filter((q) => q.data?.answers?.length > 0))
    }
  }

  async function saveProfile() {
    await supabase.from('profiles').upsert({
      user_id: userId,
      display_name: profile.display_name,
      avatar_id: profile.avatar_id,
      language: profile.language,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const currentAvatar = AVATARS.find((a) => a.id === profile.avatar_id)

  if (loading) return null

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <div style={styles.profileHeader}>
          <div style={styles.bigAvatar}>
            {currentAvatar?.emoji || '🦉'}
          </div>
          <div style={{ flex: 1 }}>
            <input
              style={styles.nameInput}
              type="text"
              placeholder="Your name"
              value={profile.display_name}
              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
            />
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Pick your avatar below
            </div>
          </div>
        </div>

        <div style={styles.sectionTitle}>Choose Avatar</div>
        <AvatarPicker
          selected={profile.avatar_id}
          onSelect={(id) => setProfile({ ...profile, avatar_id: id })}
        />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Language</div>
        <div style={styles.langGrid}>
          {LANGUAGES.map((lang) => (
            <div
              key={lang.value}
              style={styles.langOption(profile.language === lang.value)}
              onClick={() => setProfile({ ...profile, language: lang.value })}
            >
              {lang.label}
            </div>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Your Activity</div>
        <ActivityGrid activity={activity} />
      </div>

      {quizHistory.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Quiz Results</div>

          {/* Score summary by subject */}
          {(() => {
            const bySubject = {}
            quizHistory.forEach((q) => {
              const subj = q.subject || 'other'
              if (!bySubject[subj]) bySubject[subj] = { total: 0, correct: 0, count: 0 }
              bySubject[subj].total += q.data?.total || 0
              bySubject[subj].correct += q.data?.score || 0
              bySubject[subj].count += 1
            })
            return (
              <div style={{ marginBottom: 20 }}>
                {Object.entries(bySubject).map(([subj, stats]) => {
                  const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
                  const color = SUBJECT_COLORS[subj] || '#888'
                  return (
                    <div key={subj} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color, textTransform: 'capitalize' }}>{subj}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {stats.correct}/{stats.total} ({pct}%) · {stats.count} quiz{stats.count > 1 ? 'zes' : ''}
                        </span>
                      </div>
                      <div style={styles.progressBarBg}>
                        <div style={styles.progressBarFill(pct, color)} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Individual quiz history */}
          <div style={styles.sectionTitle}>Recent Quizzes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quizHistory.map((q) => {
              const score = q.data?.score ?? 0
              const total = q.data?.total ?? 0
              const pct = total > 0 ? Math.round((score / total) * 100) : 0
              const color = SUBJECT_COLORS[q.subject] || '#888'
              const chs = q.data?.chapters || []
              const chLabel = chs.includes('all') ? 'All chapters' : `Ch ${chs.join(', ')}`
              const date = new Date(q.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              return (
                <div key={q.id} style={styles.quizHistoryRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <span style={{ ...styles.quizDot, background: color }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{q.subject || 'Quiz'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{chLabel} · {date}</div>
                    </div>
                  </div>
                  <div style={styles.quizScoreBadge(pct)}>
                    {score}/{total}
                  </div>
                  <div style={{ width: 60 }}>
                    <div style={styles.miniBar}>
                      <div style={{ ...styles.miniBarFill, width: `${pct}%`, background: pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : 'var(--danger)' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button style={styles.saveBtn} onClick={saveProfile}>Save Profile</button>
        {saved && <span style={styles.saved}>Saved!</span>}
      </div>
    </div>
  )
}

const SUBJECT_COLORS = {
  physics: '#60a5fa',
  chemistry: '#f472b6',
  biology: '#34d399',
  maths: '#facc15',
  english: '#c084fc',
  history: '#fb923c',
  science: '#34d399',
  sst: '#fb923c',
  hindi: '#f472b6',
}
