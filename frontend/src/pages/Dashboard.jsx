import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { AVATARS } from '../components/AvatarPicker'

const ALL_SUBJECTS = [
  { key: 'physics', label: 'Physics', color: '#60a5fa', prompt: 'I have a doubt in Physics.' },
  { key: 'chemistry', label: 'Chemistry', color: '#f472b6', prompt: 'I have a doubt in Chemistry.' },
  { key: 'biology', label: 'Biology', color: '#34d399', prompt: 'I have a doubt in Biology.' },
  { key: 'maths', label: 'Maths', color: '#facc15', prompt: 'I have a doubt in Maths.' },
  { key: 'english', label: 'English', color: '#c084fc', prompt: 'I have a doubt in English.' },
  { key: 'history', label: 'History', color: '#fb923c', prompt: 'I have a doubt in History.' },
  { key: 'science', label: 'Science', color: '#34d399', prompt: 'I have a doubt in Science.' },
  { key: 'sst', label: 'SST', color: '#fb923c', prompt: 'I have a doubt in Social Science.' },
  { key: 'hindi', label: 'Hindi', color: '#f472b6', prompt: 'I have a doubt in Hindi.' },
]

const SENIOR_KEYS = ['physics', 'chemistry', 'biology', 'maths', 'english', 'history']
const JUNIOR_KEYS = ['science', 'maths', 'english', 'sst', 'hindi']

function getSubjects(classLevel) {
  const cls = parseInt(classLevel)
  const keys = cls >= 11 ? SENIOR_KEYS : JUNIOR_KEYS
  return keys.map((k) => ALL_SUBJECTS.find((s) => s.key === k))
}

function getSubjectByKey(key) {
  return ALL_SUBJECTS.find((s) => s.key === key)
}

export default function Dashboard({ userId, profile, onNavigate }) {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [activeSubject, setActiveSubject] = useState(null)
  const [messages, setMessages] = useState([])
  const [textInput, setTextInput] = useState('')
  const [status, setStatus] = useState('')
  const [btnState, setBtnState] = useState('ready')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const wsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const isRecordingRef = useRef(false)
  const recognitionRef = useRef(null)
  const finalTranscriptRef = useRef('')
  const messagesEndRef = useRef(null)
  const audioRef = useRef(null)

  const avatar = AVATARS.find((a) => a.id === profile?.avatar_id) || AVATARS[0]
  const subjects = getSubjects(profile?.class_level)

  useEffect(() => {
    loadSessions()
    startNewSession()
    connectWebSocket()
    return () => {
      wsRef.current?.close()
      stopAudio()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadSessions() {
    const { data } = await supabase
      .from('chat_sessions')
      .select('*, messages(content, role, created_at)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (!data) return
    const enriched = data
      .filter((s) => s.messages && s.messages.length > 0)
      .map((s) => {
        const sorted = [...s.messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        const firstUser = sorted.find((m) => m.role === 'user')
        let preview = firstUser?.content || sorted[0]?.content || ''
        if (preview.startsWith('I have a doubt in')) {
          const second = sorted.find((m, i) => m.role === 'user' && i > 0)
          if (second) preview = second.content
        }
        return { ...s, preview, msgCount: s.messages.length }
      })
    setSessions(enriched)
  }

  async function startNewSession(subject) {
    const insert = { user_id: userId }
    if (subject) insert.subject = subject
    const { data } = await supabase
      .from('chat_sessions')
      .insert(insert)
      .select()
      .single()
    if (data) {
      setActiveSessionId(data.id)
      setActiveSubject(subject || null)
      setMessages([])
      setBtnState('ready')
      setStatus('')
      setLiveTranscript('')
    }
    return data
  }

  async function loadSession(session) {
    setActiveSessionId(session.id)
    setActiveSubject(session.subject || null)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    if (data) {
      setMessages(data.map((m) => ({ role: m.role, content: m.content })))
    }
    setBtnState('ready')
    setStatus('')
    wsRef.current?.close()
    connectWebSocket()
  }

  function handleNewChat() {
    wsRef.current?.close()
    stopAudio()
    startNewSession()
    connectWebSocket()
  }

  async function handleSubjectClick(subject) {
    wsRef.current?.close()
    stopAudio()
    connectWebSocket()
    const session = await startNewSession(subject.key)
    if (!session || !wsRef.current) return
    const userMsg = { role: 'user', content: subject.prompt }
    setMessages([userMsg])
    setBtnState('processing')
    setStatus('Soch raha hai...')
    await supabase.from('messages').insert({
      user_id: userId,
      session_id: session.id,
      role: 'user',
      content: subject.prompt,
    })
    const trySend = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const lang = profile?.language || 'english'
        wsRef.current.send(JSON.stringify({ type: 'text', text: subject.prompt, language: lang }))
      } else {
        setTimeout(trySend, 200)
      }
    }
    trySend()
  }

  function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${location.host}/ws/chat`)
    ws.onopen = () => {
      setStatus((prev) => prev === 'Soch raha hai...' ? prev : '')
      setBtnState((prev) => prev === 'processing' ? prev : 'ready')
    }
    ws.onclose = () => {
      setTimeout(connectWebSocket, 2000)
    }
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const assistantMsg = { role: 'assistant', content: data.text }
      setMessages((prev) => [...prev, assistantMsg])
      saveMessage(assistantMsg)
      loadSessions()
      if (data.audio) {
        playAudio(data.audio)
      } else {
        setBtnState('ready')
        setStatus('')
      }
    }
    wsRef.current = ws
  }

  async function saveMessage(msg) {
    if (!activeSessionId) return
    await supabase.from('messages').insert({
      user_id: userId,
      session_id: activeSessionId,
      role: msg.role,
      content: msg.content,
    })
  }

  function playAudio(base64Audio) {
    if (!base64Audio) return
    stopAudio()
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`)
    audioRef.current = audio
    setBtnState('playing')
    setStatus('Bol raha hai...')
    audio.onended = () => { audioRef.current = null; setBtnState('ready'); setStatus('') }
    audio.play().catch(() => { audioRef.current = null; setBtnState('ready'); setStatus('') })
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
      setBtnState('ready')
      setStatus('')
    }
  }

  function startSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = profile?.language === 'hindi' ? 'hi-IN' : 'en-IN'
    finalTranscriptRef.current = ''
    recognition.onresult = (event) => {
      let interim = '', final = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' '
        else interim += event.results[i][0].transcript
      }
      finalTranscriptRef.current = final.trim()
      setLiveTranscript(final + interim)
    }
    recognition.onerror = () => {}
    recognition.start()
    recognitionRef.current = recognition
  }

  function stopSpeechRecognition() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }

  function handleMainButton() {
    if (btnState === 'playing') { stopAudio(); return }
    if (isRecordingRef.current) stopRecording()
    else startRecording()
  }

  async function startRecording() {
    try {
      stopAudio()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        stopSpeechRecognition()
        const transcript = finalTranscriptRef.current || liveTranscript || '(Voice message)'
        setLiveTranscript('')
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1]
          const userMsg = { role: 'user', content: transcript }
          setMessages((prev) => [...prev, userMsg])
          saveMessage(userMsg)
          setStatus('Soch raha hai...')
          setBtnState('processing')
          const lang = profile?.language || 'english'
          wsRef.current.send(JSON.stringify({ type: 'audio', audio: base64, transcript, language: lang }))
        }
        reader.readAsDataURL(audioBlob)
      }
      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      isRecordingRef.current = true
      setBtnState('recording')
      setStatus('Sun raha hai... bol!')
      startSpeechRecognition()
    } catch { setStatus('Mic access denied.') }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      isRecordingRef.current = false
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    isRecordingRef.current = false
    stopSpeechRecognition()
    setLiveTranscript('')
    setBtnState('ready')
    setStatus('')
  }

  function sendText() {
    const text = textInput.trim()
    if (!text || !wsRef.current) return
    stopAudio()
    const userMsg = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    saveMessage(userMsg)
    setStatus('Soch raha hai...')
    setBtnState('processing')
    const lang = profile?.language || 'english'
    wsRef.current.send(JSON.stringify({ type: 'text', text, language: lang }))
    setTextInput('')
  }

  function getButtonLabel() {
    if (btnState === 'recording') return 'RUKO'
    if (btnState === 'processing') return '...'
    if (btnState === 'playing') return '||'
    return 'BOLO'
  }

  function formatDate(iso) {
    const d = new Date(iso)
    const now = new Date()
    const diff = now - d
    if (diff < 86400000) return 'Today'
    if (diff < 172800000) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  function truncate(text, len) {
    if (!text) return ''
    if (text.length <= len) return text
    return text.slice(0, len).trimEnd() + '...'
  }

  return (
    <div style={s.layout}>
      <style>{`
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        .session-item:hover { background: var(--bg-card) !important; }
        .subject-chip:hover { filter: brightness(1.2); transform: translateY(-1px); }
        .new-chat-btn:hover { background: var(--bg-primary) !important; border-color: var(--accent) !important; }
        .user-row:hover { background: var(--bg-card); }
      `}</style>

      {/* Sidebar */}
      <div style={s.sidebar(sidebarOpen)}>
        <div style={s.sidebarHeader}>
          <span style={s.sidebarLogo}>Padhai Buddy</span>
          <button style={s.collapseBtn} onClick={() => setSidebarOpen(false)} title="Collapse">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <button className="new-chat-btn" style={s.newChatBtn} onClick={handleNewChat}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 8 }}><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          New chat
        </button>

        <div style={s.sessionList}>
          {sessions.map((session) => {
            const subj = session.subject ? getSubjectByKey(session.subject) : null
            const color = subj?.color || null
            const isActive = activeSessionId === session.id
            return (
              <div
                key={session.id}
                className="session-item"
                style={s.sessionItem(isActive, color)}
                onClick={() => loadSession(session)}
              >
                <div style={s.sessionTop}>
                  {subj && <span style={s.subjectTag(color)}>{subj.label}</span>}
                  <span style={s.sessionDate}>{formatDate(session.created_at)}</span>
                </div>
                <div style={s.sessionPreview(color)}>
                  {truncate(session.preview, 50)}
                </div>
              </div>
            )
          })}
          {sessions.length === 0 && (
            <div style={s.emptyHistory}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>💬</div>
              No past chats yet
            </div>
          )}
        </div>

        <div style={s.sidebarFooter}>
          <div className="user-row" style={s.userRow} onClick={() => onNavigate('profile')}>
            <span style={s.userAvatar}>{avatar.emoji}</span>
            <div>
              <div style={s.userName}>{profile?.display_name || 'Student'}</div>
              <div style={s.userSub}>View profile</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div style={s.main}>
        {!sidebarOpen && (
          <div style={s.topBar}>
            <button style={s.menuBtn} onClick={() => setSidebarOpen(true)} title="Open sidebar">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <span style={s.topLogo}>Padhai Buddy</span>
            <div style={{ width: 32 }} />
          </div>
        )}

        {/* Messages */}
        <div style={s.messagesArea}>
          <div style={s.messagesInner}>
            {messages.length === 0 && (
              <div style={s.welcome}>
                <div style={s.welcomeEmoji}>{avatar.emoji}</div>
                <div style={s.welcomeTitle}>
                  {profile?.display_name ? `Hey ${profile.display_name}!` : 'Namaste!'}
                </div>
                <div style={s.welcomeSub}>
                  Pick a subject to get started, or ask anything below.
                </div>
                <div style={s.subjectRow}>
                  {subjects.map((subj) => (
                    <button
                      key={subj.key}
                      className="subject-chip"
                      style={s.subjectChip(subj.color)}
                      onClick={() => handleSubjectClick(subj)}
                    >
                      <span style={s.chipDot(subj.color)} />
                      {subj.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={s.msgRow(msg.role)}>
                <div style={s.msgBubble(msg.role, activeSubject ? getSubjectByKey(activeSubject)?.color : null)}>
                  <div style={s.msgLabel(msg.role)}>
                    {msg.role === 'user' ? 'You' : 'Padhai Buddy'}
                  </div>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div style={s.inputArea}>
          <div style={s.inputInner}>
            {activeSubject && messages.length > 0 && (
              <div style={s.activeSubjectBadge(getSubjectByKey(activeSubject)?.color || '#888')}>
                {getSubjectByKey(activeSubject)?.label || activeSubject}
              </div>
            )}
            <div style={s.btnRow}>
              {btnState === 'recording' && (
                <button style={s.cancelBtn} onClick={cancelRecording} title="Cancel">✕</button>
              )}
              <button style={s.talkBtn(btnState)} onClick={handleMainButton}>
                {getButtonLabel()}
              </button>
            </div>
            {liveTranscript && <div style={s.liveTranscript}>"{liveTranscript}"</div>}
            {status && <div style={s.status}>{status}</div>}
            <div style={s.textRow}>
              <input
                style={s.textInput}
                type="text"
                placeholder="Type your doubt here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendText()}
                disabled={btnState === 'processing'}
              />
              <button style={s.sendBtn} onClick={sendText} disabled={btnState === 'processing'}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2l-4 12-3-5-5-3 12-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  layout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },

  // Sidebar
  sidebar: (open) => ({
    width: open ? 272 : 0,
    minWidth: open ? 272 : 0,
    borderRight: open ? '1px solid var(--border)' : 'none',
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.2s, min-width 0.2s',
  }),
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 16px 14px',
    borderBottom: '1px solid var(--border)',
  },
  sidebarLogo: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '-0.01em',
  },
  collapseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: 6,
  },
  newChatBtn: {
    margin: '12px 12px 4px',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    transition: 'border-color 0.15s, background 0.15s',
  },
  sessionList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 8px',
  },
  sessionItem: (active, color) => ({
    padding: '10px 12px',
    borderRadius: 10,
    cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    borderLeft: color ? `3px solid ${color}` : '3px solid transparent',
    marginBottom: 4,
    transition: 'background 0.1s',
  }),
  sessionTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  subjectTag: (color) => ({
    fontSize: 10,
    fontWeight: 700,
    color: color,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }),
  sessionDate: {
    fontSize: 10,
    color: 'var(--text-secondary)',
  },
  sessionPreview: (color) => ({
    fontSize: 13,
    color: color ? `${color}cc` : 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.4,
  }),
  emptyHistory: {
    padding: '32px 12px',
    fontSize: 13,
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  sidebarFooter: {
    padding: '10px 10px',
    borderTop: '1px solid var(--border)',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  userAvatar: {
    fontSize: 24,
  },
  userName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  userSub: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    marginTop: 1,
  },

  // Top bar
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: 6,
  },
  topLogo: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--accent)',
  },

  // Main
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
  },
  messagesInner: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  // Welcome + Subject chips
  welcome: {
    textAlign: 'center',
    padding: '56px 20px 20px',
  },
  welcomeEmoji: {
    fontSize: 52,
    marginBottom: 14,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 8,
    letterSpacing: '-0.02em',
  },
  welcomeSub: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: 32,
  },
  subjectRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 480,
    margin: '0 auto',
  },
  subjectChip: (color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 50,
    border: `1.5px solid ${color}40`,
    background: `${color}12`,
    color: color,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'filter 0.15s, transform 0.15s',
    whiteSpace: 'nowrap',
  }),
  chipDot: (color) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),

  // Active subject badge
  activeSubjectBadge: (color) => ({
    fontSize: 11,
    fontWeight: 600,
    color: color,
    background: `${color}15`,
    border: `1px solid ${color}30`,
    padding: '4px 14px',
    borderRadius: 20,
    letterSpacing: '0.03em',
  }),

  // Messages
  msgRow: (role) => ({
    display: 'flex',
    justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
  }),
  msgBubble: (role, subjectColor) => ({
    maxWidth: '75%',
    padding: role === 'user' ? '10px 16px' : '14px 18px',
    borderRadius: role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
    fontSize: 14,
    lineHeight: 1.7,
    background: role === 'user' ? 'var(--user-bg)' : 'var(--bg-card)',
    border: `1px solid ${role === 'user' ? 'var(--user-border)' : 'var(--border)'}`,
    borderLeft: role === 'assistant' && subjectColor ? `3px solid ${subjectColor}` : undefined,
  }),
  msgLabel: (role) => ({
    fontSize: 11,
    color: role === 'user' ? 'var(--user-border)' : 'var(--accent)',
    marginBottom: 4,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }),

  // Input area
  inputArea: {
    padding: '14px 16px 18px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  inputInner: {
    maxWidth: 720,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  btnRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  talkBtn: (state) => ({
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: `2px solid ${state === 'recording' ? 'var(--danger)' : state === 'playing' ? '#f59e0b' : 'var(--accent)'}`,
    background: state === 'recording' ? 'var(--danger)' : state === 'processing' ? '#222' : 'transparent',
    color: state === 'recording' ? 'white' : state === 'processing' ? '#666' : state === 'playing' ? '#f59e0b' : 'var(--accent)',
    fontSize: 11,
    fontWeight: 600,
    cursor: state === 'processing' ? 'default' : 'pointer',
    pointerEvents: state === 'processing' ? 'none' : 'auto',
    animation: state === 'recording' ? 'pulse 1s infinite' : 'none',
    letterSpacing: '0.05em',
  }),
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1.5px solid var(--danger)',
    background: 'transparent',
    color: 'var(--danger)',
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTranscript: {
    fontSize: 12,
    color: 'var(--accent)',
    fontStyle: 'italic',
    opacity: 0.85,
  },
  status: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  textRow: {
    display: 'flex',
    gap: 8,
    width: '100%',
  },
  textInput: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
  },
  sendBtn: {
    padding: '12px 16px',
    borderRadius: 12,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    fontWeight: 600,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
