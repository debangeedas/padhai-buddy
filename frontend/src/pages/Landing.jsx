import { Link } from 'react-router-dom'

const features = [
  {
    icon: '🎙️',
    title: 'Voice-first learning',
    desc: 'Tap the mic and ask your doubt in Hindi, Hinglish, or English. No typing needed.',
  },
  {
    icon: '📚',
    title: 'Backed by your textbooks',
    desc: 'Answers are grounded in actual school textbooks — CBSE, ICSE, or state board. No guesswork, no hallucinations.',
  },
  {
    icon: '💬',
    title: 'Conversational teaching',
    desc: 'Not a chatbot that dumps paragraphs. A tutor that asks follow-ups and builds understanding.',
  },
  {
    icon: '🛡️',
    title: 'Safe for students',
    desc: 'Padhai Buddy only talks academics. Off-topic questions are gently redirected — no unfiltered AI conversations.',
  },
]

const steps = [
  { num: '1', text: 'Create a free account and pick your language' },
  { num: '2', text: 'Tap the mic or type your doubt' },
  { num: '3', text: 'Get a clear, textbook-backed explanation — and keep the conversation going' },
]

export default function Landing() {
  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <span style={s.logo}>Padhai Buddy</span>
        <div style={s.navLinks}>
          <Link to="/login" style={s.navLink}>Log in</Link>
          <Link to="/signup" style={s.navCta}>Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={s.hero}>
        <div style={s.heroInner}>
          <p style={s.eyebrow}>For students across India</p>
          <h1 style={s.heroTitle}>
            Your AI tutor that speaks<br />your language
          </h1>
          <p style={s.heroSub}>
            Millions of students struggle with English-only study tools.
            Padhai Buddy lets you ask doubts in Hindi, Hinglish, or English
            — by voice — and get patient, textbook-grounded explanations
            like a good senior would give.
          </p>
          <div style={s.heroBtns}>
            <Link to="/signup" style={s.primaryBtn}>Start learning — free</Link>
            <a href="#how" style={s.secondaryBtn}>See how it works</a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Built for how you actually study</h2>
        <div style={s.featureGrid}>
          {features.map((f, i) => (
            <div key={i} style={s.featureCard}>
              <div style={s.featureIcon}>{f.icon}</div>
              <h3 style={s.featureTitle}>{f.title}</h3>
              <p style={s.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ ...s.section, background: 'var(--bg-secondary)' }}>
        <h2 style={s.sectionTitle}>How it works</h2>
        <div style={s.steps}>
          {steps.map((step, i) => (
            <div key={i} style={s.step}>
              <div style={s.stepNum}>{step.num}</div>
              <p style={s.stepText}>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Languages */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Speak the way you think</h2>
        <p style={{ ...s.heroSub, maxWidth: 520, margin: '0 auto 32px' }}>
          Switch between three modes in your profile. The AI adapts its
          responses to match — vocabulary, script, and tone.
        </p>
        <div style={s.langRow}>
          {['English', 'Hinglish', 'हिंदी'].map((l, i) => (
            <div key={i} style={s.langChip}>{l}</div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ ...s.section, background: 'var(--bg-secondary)', textAlign: 'center' }}>
        <h2 style={{ ...s.sectionTitle, marginBottom: 12 }}>
          Every student deserves a patient teacher
        </h2>
        <p style={{ ...s.heroSub, maxWidth: 440, margin: '0 auto 28px' }}>
          Padhai Buddy is free. No credit card, no ads. Just sign up and start asking.
        </p>
        <Link to="/signup" style={s.primaryBtn}>Create your account</Link>
      </section>

      {/* Footer */}
      <footer style={s.footer}>
        <span style={s.footerLogo}>Padhai Buddy</span>
        <span style={s.footerText}>Built for students, by students.</span>
      </footer>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },

  // Nav
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-primary)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  logo: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '-0.02em',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  navLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
  },
  navCta: {
    padding: '8px 20px',
    borderRadius: 8,
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
  },

  // Hero
  hero: {
    padding: '80px 32px 72px',
    textAlign: 'center',
    background: 'var(--bg-primary)',
  },
  heroInner: {
    maxWidth: 640,
    margin: '0 auto',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--accent)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
    color: 'var(--text-primary)',
    marginBottom: 20,
  },
  heroSub: {
    fontSize: 16,
    lineHeight: 1.65,
    color: 'var(--text-secondary)',
    maxWidth: 520,
    margin: '0 auto',
  },
  heroBtns: {
    marginTop: 32,
    display: 'flex',
    justifyContent: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    padding: '12px 28px',
    borderRadius: 10,
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    textDecoration: 'none',
    fontSize: 15,
    fontWeight: 600,
  },
  secondaryBtn: {
    padding: '12px 28px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 15,
    fontWeight: 500,
  },

  // Sections
  section: {
    padding: '64px 32px',
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: '-0.02em',
    color: 'var(--text-primary)',
  },

  // Features
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 20,
    maxWidth: 820,
    margin: '0 auto',
  },
  featureCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '28px 24px',
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: 14,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8,
    color: 'var(--text-primary)',
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
  },

  // Steps
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    maxWidth: 480,
    margin: '0 auto',
  },
  step: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
  },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '2px solid var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--accent)',
    flexShrink: 0,
  },
  stepText: {
    fontSize: 15,
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    paddingTop: 4,
  },

  // Languages
  langRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  langChip: {
    padding: '10px 24px',
    borderRadius: 10,
    border: '1px solid var(--accent)',
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    fontSize: 15,
    fontWeight: 600,
  },

  // Footer
  footer: {
    padding: '24px 32px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLogo: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--accent)',
  },
  footerText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
}
