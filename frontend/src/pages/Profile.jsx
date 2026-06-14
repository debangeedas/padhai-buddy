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
}

export default function Profile({ userId }) {
  const [profile, setProfile] = useState({
    display_name: '',
    avatar_id: 'owl',
    language: 'english',
  })
  const [activity, setActivity] = useState({})
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
    loadActivity()
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

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button style={styles.saveBtn} onClick={saveProfile}>Save Profile</button>
        {saved && <span style={styles.saved}>Saved!</span>}
      </div>
    </div>
  )
}
