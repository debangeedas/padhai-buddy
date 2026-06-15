import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { AVATARS } from '../components/AvatarPicker'

const BOARDS = [
  { value: 'cbse', label: 'CBSE' },
  { value: 'icse', label: 'ICSE' },
  { value: 'state', label: 'State Board' },
  { value: 'other', label: 'Other' },
]

const CLASSES = [
  { value: '6', label: 'Class 6' },
  { value: '7', label: 'Class 7' },
  { value: '8', label: 'Class 8' },
  { value: '9', label: 'Class 9' },
  { value: '10', label: 'Class 10' },
  { value: '11', label: 'Class 11' },
  { value: '12', label: 'Class 12' },
]

const LANGUAGES = [
  { value: 'english', label: 'English', desc: 'Replies fully in English' },
  { value: 'hinglish', label: 'Hinglish', desc: 'Hindi words in English script, mixed with English' },
  { value: 'hindi', label: 'Hindi', desc: 'Full Hindi in Devanagari script' },
]

const TOTAL_STEPS = 4

export default function Onboarding({ userId, userName, onComplete }) {
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState({
    display_name: userName || '',
    board: '',
    class_level: '',
    language: '',
    avatar_id: '',
  })
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setProfile((p) => ({ ...p, [key]: val }))
  }

  function canAdvance() {
    if (step === 0) return profile.display_name.trim() && profile.board
    if (step === 1) return profile.class_level
    if (step === 2) return profile.language
    if (step === 3) return profile.avatar_id
    return false
  }

  async function finish() {
    setSaving(true)
    await supabase.from('profiles').upsert({
      user_id: userId,
      display_name: profile.display_name.trim(),
      board: profile.board,
      class_level: profile.class_level,
      language: profile.language,
      avatar_id: profile.avatar_id,
      onboarded: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSaving(false)
    onComplete()
  }

  function next() {
    if (step < TOTAL_STEPS - 1) setStep(step + 1)
    else finish()
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Progress */}
        <div style={s.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={s.dot(i <= step)} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h2 style={s.title}>Welcome to Padhai Buddy</h2>
            <p style={s.sub}>Let's set up your account. This takes 30 seconds.</p>

            <label style={s.label}>Your name</label>
            <input
              style={s.input}
              type="text"
              placeholder="e.g. Aarav"
              value={profile.display_name}
              onChange={(e) => set('display_name', e.target.value)}
              autoFocus
            />

            <label style={{ ...s.label, marginTop: 20 }}>Which board are you in?</label>
            <div style={s.optionGrid}>
              {BOARDS.map((b) => (
                <div
                  key={b.value}
                  style={s.option(profile.board === b.value)}
                  onClick={() => set('board', b.value)}
                >
                  {b.label}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={s.title}>What class are you in?</h2>
            <p style={s.sub}>We'll tailor explanations to your syllabus level.</p>

            <div style={s.classGrid}>
              {CLASSES.map((c) => (
                <div
                  key={c.value}
                  style={s.option(profile.class_level === c.value)}
                  onClick={() => set('class_level', c.value)}
                >
                  {c.label}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={s.title}>Pick your language</h2>
            <p style={s.sub}>You can change this anytime from your profile.</p>

            <div style={s.langList}>
              {LANGUAGES.map((l) => (
                <div
                  key={l.value}
                  style={s.langCard(profile.language === l.value)}
                  onClick={() => set('language', l.value)}
                >
                  <div style={s.langLabel}>{l.label}</div>
                  <div style={s.langDesc}>{l.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={s.title}>Choose your avatar</h2>
            <p style={s.sub}>Pick one that feels like you.</p>

            <div style={s.avatarGrid}>
              {AVATARS.map((a) => (
                <div
                  key={a.id}
                  style={s.avatarItem(profile.avatar_id === a.id)}
                  onClick={() => set('avatar_id', a.id)}
                >
                  <span style={{ fontSize: 30 }}>{a.emoji}</span>
                  <span style={s.avatarLabel}>{a.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Navigation */}
        <div style={s.navRow}>
          {step > 0 && (
            <button style={s.backBtn} onClick={() => setStep(step - 1)}>Back</button>
          )}
          <div style={{ flex: 1 }} />
          <button
            style={s.nextBtn(canAdvance())}
            onClick={next}
            disabled={!canAdvance() || saving}
          >
            {saving ? '...' : step === TOTAL_STEPS - 1 ? "Let's go" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 24,
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '36px 40px 32px',
    width: '100%',
    maxWidth: 460,
  },
  progressRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 28,
  },
  dot: (active) => ({
    flex: 1,
    height: 3,
    borderRadius: 2,
    background: active ? 'var(--accent)' : 'var(--border)',
    transition: 'background 0.2s',
  }),
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 6,
    letterSpacing: '-0.02em',
    color: 'var(--text-primary)',
  },
  sub: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 24,
    lineHeight: 1.5,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  classGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
  },
  option: (selected) => ({
    padding: '12px 16px',
    borderRadius: 10,
    border: selected ? '2px solid var(--accent)' : '2px solid var(--border)',
    background: selected ? 'var(--accent-dim)' : 'var(--bg-primary)',
    color: selected ? 'var(--accent)' : 'var(--text-primary)',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: selected ? 600 : 400,
    transition: 'border-color 0.15s, background 0.15s',
  }),
  langList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  langCard: (selected) => ({
    padding: '14px 18px',
    borderRadius: 10,
    border: selected ? '2px solid var(--accent)' : '2px solid var(--border)',
    background: selected ? 'var(--accent-dim)' : 'var(--bg-primary)',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  }),
  langLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 2,
  },
  langDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  avatarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
  },
  avatarItem: (selected) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: 10,
    borderRadius: 10,
    border: selected ? '2px solid var(--accent)' : '2px solid var(--border)',
    background: selected ? 'var(--accent-dim)' : 'var(--bg-primary)',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  }),
  avatarLabel: {
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
  navRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 28,
    gap: 12,
  },
  backBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 500,
  },
  nextBtn: (enabled) => ({
    padding: '10px 28px',
    borderRadius: 8,
    border: 'none',
    background: enabled ? 'var(--accent)' : 'var(--border)',
    color: enabled ? 'var(--bg-primary)' : 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: enabled ? 'pointer' : 'default',
    transition: 'background 0.15s',
  }),
}
