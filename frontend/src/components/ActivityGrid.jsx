const WEEKS = 20
const DAYS = 7
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

function getColor(count) {
  if (count === 0) return '#161625'
  if (count <= 2) return '#1a3a1a'
  if (count <= 5) return '#2d6a2d'
  if (count <= 10) return '#4a9a2d'
  return '#76b900'
}

function buildGrid(activity) {
  const today = new Date()
  const grid = []

  for (let w = WEEKS - 1; w >= 0; w--) {
    const week = []
    for (let d = 0; d < DAYS; d++) {
      const date = new Date(today)
      date.setDate(date.getDate() - (w * 7 + (6 - d)))
      const key = date.toISOString().split('T')[0]
      week.push({
        date: key,
        count: activity[key] || 0,
      })
    }
    grid.push(week)
  }
  return grid
}

const styles = {
  container: {
    overflowX: 'auto',
  },
  wrapper: {
    display: 'flex',
    gap: 2,
  },
  dayLabels: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginRight: 4,
  },
  dayLabel: {
    height: 14,
    width: 24,
    fontSize: 10,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  cell: (color) => ({
    width: 14,
    height: 14,
    borderRadius: 3,
    background: color,
  }),
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  legendLabel: {
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
}

export default function ActivityGrid({ activity = {} }) {
  const grid = buildGrid(activity)

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <div style={styles.dayLabels}>
          {DAY_LABELS.map((label, i) => (
            <div key={i} style={styles.dayLabel}>{label}</div>
          ))}
        </div>
        {grid.map((week, wi) => (
          <div key={wi} style={styles.column}>
            {week.map((day) => (
              <div
                key={day.date}
                style={styles.cell(getColor(day.count))}
                title={`${day.date}: ${day.count} question${day.count !== 1 ? 's' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={styles.legend}>
        <span style={styles.legendLabel}>Less</span>
        {[0, 2, 5, 10, 15].map((n) => (
          <div key={n} style={styles.cell(getColor(n))} />
        ))}
        <span style={styles.legendLabel}>More</span>
      </div>
    </div>
  )
}
