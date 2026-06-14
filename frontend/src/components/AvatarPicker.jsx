const AVATARS = [
  { id: 'owl', emoji: '🦉', label: 'Ullu Guru' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'brain', emoji: '🧠', label: 'Brainy' },
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'robot', emoji: '🤖', label: 'Robot' },
  { id: 'ninja', emoji: '🥷', label: 'Ninja' },
  { id: 'wizard', emoji: '🧙', label: 'Wizard' },
  { id: 'astronaut', emoji: '🧑‍🚀', label: 'Astronaut' },
  { id: 'lion', emoji: '🦁', label: 'Sher' },
  { id: 'peacock', emoji: '🦚', label: 'Mor' },
  { id: 'elephant', emoji: '🐘', label: 'Hathi' },
]

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
  },
  avatar: (selected) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: 12,
    borderRadius: 12,
    border: selected ? '2px solid var(--accent)' : '2px solid var(--border)',
    background: selected ? 'var(--accent-dim)' : 'var(--bg-primary)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  emoji: {
    fontSize: 32,
  },
  label: {
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
}

export default function AvatarPicker({ selected, onSelect }) {
  return (
    <div style={styles.grid}>
      {AVATARS.map((a) => (
        <div
          key={a.id}
          style={styles.avatar(selected === a.id)}
          onClick={() => onSelect(a.id)}
        >
          <span style={styles.emoji}>{a.emoji}</span>
          <span style={styles.label}>{a.label}</span>
        </div>
      ))}
    </div>
  )
}

export { AVATARS }
