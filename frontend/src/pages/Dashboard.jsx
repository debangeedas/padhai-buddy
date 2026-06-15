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

export default function Dashboard({ userId, profile, onNavigate, onLogout }) {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [activeSubject, setActiveSubject] = useState(null)
  const [messages, setMessages] = useState([])
  const [textInput, setTextInput] = useState('')
  const [status, setStatus] = useState('')
  const [btnState, setBtnState] = useState('ready')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Flashcard state
  const [mode, setMode] = useState('chat') // 'chat' | 'flashcards'
  const [fcStep, setFcStep] = useState('subject') // 'subject' | 'chapter' | 'session'
  const [fcSubject, setFcSubject] = useState(null)
  const [fcChapters, setFcChapters] = useState([])
  const [fcAvailableChapters, setFcAvailableChapters] = useState([])
  const [fcSelectedChapters, setFcSelectedChapters] = useState([])
  const [fcCards, setFcCards] = useState([])
  const [fcIndex, setFcIndex] = useState(0)
  const [fcFlipped, setFcFlipped] = useState(false)
  const [fcLoading, setFcLoading] = useState(false)
  const [fcShowHint, setFcShowHint] = useState(false)

  // Quiz state
  const [qzStep, setQzStep] = useState('subject')
  const [qzSubject, setQzSubject] = useState(null)
  const [qzAvailableChapters, setQzAvailableChapters] = useState([])
  const [qzSelectedChapters, setQzSelectedChapters] = useState([])
  const [qzQuestions, setQzQuestions] = useState([])
  const [qzIndex, setQzIndex] = useState(0)
  const [qzSelected, setQzSelected] = useState(null)
  const [qzRevealed, setQzRevealed] = useState(false)
  const [qzScore, setQzScore] = useState(0)
  const [qzAnswered, setQzAnswered] = useState(0)
  const [qzLoading, setQzLoading] = useState(false)
  const [qzAnswers, setQzAnswers] = useState([])

  const wsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const isRecordingRef = useRef(false)
  const recognitionRef = useRef(null)
  const finalTranscriptRef = useRef('')
  const messagesEndRef = useRef(null)
  const audioRef = useRef(null)
  const activeSessionIdRef = useRef(null)
  const qzChaptersRef = useRef([])

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
      .filter((s) => {
        if (s.type === 'flashcard' || s.type === 'quiz') return true
        return s.messages && s.messages.length > 0
      })
      .map((s) => {
        if (s.type === 'flashcard') {
          const cardCount = s.data?.cards?.length || 0
          const chs = s.data?.chapters || []
          const chLabel = chs.includes('all') ? 'All chapters' : `Ch ${chs.join(', ')}`
          return { ...s, preview: `${cardCount} cards · ${chLabel}`, msgCount: cardCount }
        }
        if (s.type === 'quiz') {
          const chs = s.data?.chapters || []
          const chLabel = chs.includes('all') ? 'All chapters' : `Ch ${chs.join(', ')}`
          return { ...s, preview: chLabel, msgCount: s.data?.total ?? 0 }
        }
        const sorted = [...(s.messages || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
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
      activeSessionIdRef.current = data.id
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
    activeSessionIdRef.current = session.id
    setActiveSubject(session.subject || null)

    if (session.type === 'flashcard') {
      const subj = session.subject ? getSubjectByKey(session.subject) : null
      setMode('flashcards')
      setFcStep('session')
      setFcSubject(subj)
      setFcCards(session.data?.cards || [])
      setFcIndex(0)
      setFcFlipped(false)
      setFcShowHint(false)
      setFcLoading(false)
      return
    }

    if (session.type === 'quiz') {
      const { data: fresh } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', session.id)
        .single()
      const qData = fresh?.data || session.data || {}
      const subj = session.subject ? getSubjectByKey(session.subject) : null
      setMode('quiz')
      setQzStep('results')
      setQzSubject(subj)
      setQzQuestions(qData.questions || [])
      setQzAnswers(qData.answers || [])
      setQzScore(qData.score ?? 0)
      setQzAnswered(qData.total ?? 0)
      setQzLoading(false)
      return
    }

    setMode('chat')
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
    setMode('chat')
    wsRef.current?.close()
    stopAudio()
    startNewSession()
    connectWebSocket()
  }

  async function handleSubjectClick(subject) {
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
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
    }
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${location.host}/ws/chat`)
    ws.onopen = () => {
      setStatus((prev) => prev === 'Soch raha hai...' ? prev : '')
      setBtnState((prev) => prev === 'processing' ? prev : 'ready')
    }
    ws.onclose = () => {
      if (wsRef.current === ws) {
        setTimeout(connectWebSocket, 2000)
      }
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
    const sessionId = activeSessionIdRef.current
    if (!sessionId) return
    await supabase.from('messages').insert({
      user_id: userId,
      session_id: sessionId,
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

  // --- Flashcard functions ---
  function enterFlashcardMode() {
    setMode('flashcards')
    setFcStep('subject')
    setFcSubject(null)
    setFcSelectedChapters([])
    setFcCards([])
    setFcIndex(0)
    setFcFlipped(false)
    setFcShowHint(false)
  }

  function exitFlashcardMode() {
    setMode('chat')
    setFcStep('subject')
    setFcCards([])
  }

  async function handleFcSubjectClick(subj) {
    setFcSubject(subj)
    setFcStep('chapter')
    setFcLoading(true)
    try {
      const cls = profile?.class_level || '10'
      const res = await fetch(`/api/chapters?subject=${encodeURIComponent(subj.key)}&class_level=${encodeURIComponent(cls)}`)
      const data = await res.json()
      setFcAvailableChapters(data.chapters || [])
    } catch {
      setFcAvailableChapters([])
    }
    setFcLoading(false)
    setFcSelectedChapters([])
  }

  function toggleChapter(ch) {
    setFcSelectedChapters((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  function toggleAllChapters() {
    if (fcSelectedChapters.length === fcAvailableChapters.length) {
      setFcSelectedChapters([])
    } else {
      setFcSelectedChapters([...fcAvailableChapters])
    }
  }

  async function startFlashcardSession() {
    if (fcSelectedChapters.length === 0) return
    setFcLoading(true)
    setFcStep('session')
    try {
      const cls = profile?.class_level || '10'
      const lang = profile?.language || 'english'
      const chaptersToSend = fcSelectedChapters.length === fcAvailableChapters.length
        ? ['all'] : fcSelectedChapters
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: fcSubject.key,
          class_level: cls,
          chapters: chaptersToSend,
          count: 10,
          language: lang,
        }),
      })
      const data = await res.json()
      const cards = data.flashcards || []
      setFcCards(cards)
      setFcIndex(0)
      setFcFlipped(false)
      setFcShowHint(false)
      if (cards.length > 0) {
        const { data: session } = await supabase
          .from('chat_sessions')
          .insert({
            user_id: userId,
            subject: fcSubject.key,
            type: 'flashcard',
            data: { cards, chapters: chaptersToSend },
          })
          .select()
          .single()
        if (session) {
          setActiveSessionId(session.id)
          activeSessionIdRef.current = session.id
        }
        loadSessions()
      }
    } catch {
      setFcCards([])
    }
    setFcLoading(false)
  }

  function fcNext() {
    if (fcIndex < fcCards.length - 1) {
      setFcIndex(fcIndex + 1)
      setFcFlipped(false)
      setFcShowHint(false)
    }
  }

  function fcPrev() {
    if (fcIndex > 0) {
      setFcIndex(fcIndex - 1)
      setFcFlipped(false)
      setFcShowHint(false)
    }
  }

  // --- Quiz functions ---
  function enterQuizMode() {
    setMode('quiz')
    setQzStep('subject')
    setQzSubject(null)
    setQzSelectedChapters([])
    setQzQuestions([])
    setQzIndex(0)
    setQzSelected(null)
    setQzRevealed(false)
    setQzScore(0)
    setQzAnswered(0)
  }

  function exitQuizMode() {
    setMode('chat')
    setQzStep('subject')
    setQzQuestions([])
  }

  async function handleQzSubjectClick(subj) {
    setQzSubject(subj)
    setQzStep('chapter')
    setQzLoading(true)
    try {
      const cls = profile?.class_level || '10'
      const res = await fetch(`/api/chapters?subject=${encodeURIComponent(subj.key)}&class_level=${encodeURIComponent(cls)}`)
      const data = await res.json()
      setQzAvailableChapters(data.chapters || [])
    } catch {
      setQzAvailableChapters([])
    }
    setQzLoading(false)
    setQzSelectedChapters([])
  }

  function toggleQzChapter(ch) {
    setQzSelectedChapters((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  function toggleAllQzChapters() {
    if (qzSelectedChapters.length === qzAvailableChapters.length) {
      setQzSelectedChapters([])
    } else {
      setQzSelectedChapters([...qzAvailableChapters])
    }
  }

  async function startQuizSession() {
    if (qzSelectedChapters.length === 0) return
    setQzLoading(true)
    setQzStep('session')
    setQzScore(0)
    setQzAnswered(0)
    setQzAnswers([])
    try {
      const cls = profile?.class_level || '10'
      const lang = profile?.language || 'english'
      const chaptersToSend = qzSelectedChapters.length === qzAvailableChapters.length
        ? ['all'] : qzSelectedChapters
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: qzSubject.key,
          class_level: cls,
          chapters: chaptersToSend,
          count: 10,
          language: lang,
        }),
      })
      const data = await res.json()
      const questions = data.questions || []
      setQzQuestions(questions)
      setQzIndex(0)
      setQzSelected(null)
      setQzRevealed(false)
      if (questions.length > 0) {
        qzChaptersRef.current = chaptersToSend
        const { data: session, error: insertErr } = await supabase
          .from('chat_sessions')
          .insert({
            user_id: userId,
            subject: qzSubject.key,
            type: 'quiz',
            data: { questions, answers: [], score: 0, total: questions.length, chapters: chaptersToSend },
          })
          .select()
          .single()
        if (insertErr) console.error('[Quiz] Insert failed:', insertErr.message)
        if (session) {
          console.log('[Quiz] Created session:', session.id)
          setActiveSessionId(session.id)
          activeSessionIdRef.current = session.id
        }
        loadSessions()
      }
    } catch {
      setQzQuestions([])
    }
    setQzLoading(false)
  }

  async function handleQzAnswer(optIdx) {
    if (qzRevealed) return
    setQzSelected(optIdx)
    setQzRevealed(true)
    const newAnswered = qzAnswered + 1
    const correct = optIdx === qzQuestions[qzIndex]?.correct
    const newScore = correct ? qzScore + 1 : qzScore
    const newAnswers = [...qzAnswers, { questionIndex: qzIndex, selected: optIdx, correct }]
    setQzAnswered(newAnswered)
    setQzScore(newScore)
    setQzAnswers(newAnswers)
    // Save progress to Supabase
    const sessionId = activeSessionIdRef.current
    console.log('[Quiz] Saving answer', { sessionId, qIdx: qzIndex, optIdx, correct, newScore, answersLen: newAnswers.length })
    if (!sessionId) {
      console.error('[Quiz] No active session ID!')
      return
    }
    const { data: updated, error } = await supabase
      .from('chat_sessions')
      .update({
        data: {
          questions: qzQuestions,
          answers: newAnswers,
          score: newScore,
          total: qzQuestions.length,
          chapters: qzChaptersRef.current,
        },
      })
      .eq('id', sessionId)
      .select()
    if (error) console.error('[Quiz] Update failed:', error.message, error)
    else console.log('[Quiz] Update OK, rows:', updated?.length)
    if (newAnswered === qzQuestions.length) loadSessions()
  }

  function qzNext() {
    if (qzIndex < qzQuestions.length - 1) {
      setQzIndex(qzIndex + 1)
      setQzSelected(null)
      setQzRevealed(false)
    }
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
        .session-list::-webkit-scrollbar { display: none; }
        .session-list { -ms-overflow-style: none; scrollbar-width: none; }
        .user-row:hover button { opacity: 1 !important; }
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

        <div className="session-list" style={s.sessionList}>
          {sessions.map((session) => {
            const subj = session.subject ? getSubjectByKey(session.subject) : null
            const color = subj?.color || null
            const isActive = activeSessionId === session.id
            const typeIcon = session.type === 'flashcard' ? '🗂️' : session.type === 'quiz' ? '📝' : null
            return (
              <div
                key={session.id}
                className="session-item"
                style={s.sessionItem(isActive, color)}
                onClick={() => loadSession(session)}
              >
                <div style={s.sessionTop}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {typeIcon && <span style={{ fontSize: 11 }}>{typeIcon}</span>}
                    {subj && <span style={s.subjectTag(color)}>{subj.label}</span>}
                    {!subj && typeIcon && <span style={s.subjectTag('var(--text-secondary)')}>{session.type === 'flashcard' ? 'Flashcards' : 'Quiz'}</span>}
                  </span>
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
            <div style={{ flex: 1 }}>
              <div style={s.userName}>{profile?.display_name || 'Student'}</div>
              <div style={s.userSub}>View profile</div>
            </div>
            <button
              style={s.logoutBtn}
              onClick={(e) => { e.stopPropagation(); onLogout && onLogout() }}
              title="Log out"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
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

        {mode === 'flashcards' ? (
          /* ===== FLASHCARD MODE ===== */
          <div style={s.messagesArea}>
            <div style={s.messagesInner}>

              {fcStep === 'subject' && (
                <div style={s.welcome}>
                  <div style={s.welcomeEmoji}>🗂️</div>
                  <div style={s.welcomeTitle}>Flashcards</div>
                  <div style={s.welcomeSub}>Pick a subject to generate flashcards from your textbook.</div>
                  <div style={s.subjectRow}>
                    {subjects.map((subj) => (
                      <button key={subj.key} className="subject-chip" style={s.subjectChip(subj.color)} onClick={() => handleFcSubjectClick(subj)}>
                        <span style={s.chipDot(subj.color)} />
                        {subj.label}
                      </button>
                    ))}
                  </div>
                  <button style={s.fcBackLink} onClick={exitFlashcardMode}>← Back to Chat</button>
                </div>
              )}

              {fcStep === 'chapter' && (
                <div style={s.welcome}>
                  <div style={{ ...s.welcomeTitle, fontSize: 22 }}>
                    <span style={{ color: fcSubject?.color }}>{fcSubject?.label}</span> — Select Chapters
                  </div>
                  <div style={s.welcomeSub}>Pick one or more chapters, or select all.</div>

                  {fcLoading ? (
                    <div style={s.fcLoadingText}>Loading chapters...</div>
                  ) : fcAvailableChapters.length === 0 ? (
                    <div style={s.fcLoadingText}>No chapters found for this subject. Make sure textbooks are ingested.</div>
                  ) : (
                    <>
                      <div style={s.fcChapterGrid}>
                        <button
                          className="subject-chip"
                          style={s.fcChapterBtn(fcSelectedChapters.length === fcAvailableChapters.length, fcSubject?.color)}
                          onClick={toggleAllChapters}
                        >
                          All Chapters
                        </button>
                        {fcAvailableChapters.map((ch) => (
                          <button
                            key={ch}
                            className="subject-chip"
                            style={s.fcChapterBtn(fcSelectedChapters.includes(ch), fcSubject?.color)}
                            onClick={() => toggleChapter(ch)}
                          >
                            Ch {ch}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
                        <button style={s.fcBackLink} onClick={() => setFcStep('subject')}>← Back</button>
                        <button
                          style={s.fcStartBtn(fcSelectedChapters.length > 0, fcSubject?.color)}
                          disabled={fcSelectedChapters.length === 0}
                          onClick={startFlashcardSession}
                        >
                          Generate {fcSelectedChapters.length === fcAvailableChapters.length ? 'All' : fcSelectedChapters.length} → Start
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {fcStep === 'session' && (
                <div style={s.fcSessionContainer}>
                  {fcLoading ? (
                    <div style={s.fcLoadingCard}>
                      <div style={{ fontSize: 36, marginBottom: 16 }}>🧠</div>
                      <div style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Generating flashcards...</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, opacity: 0.6 }}>This may take a few seconds</div>
                    </div>
                  ) : fcCards.length === 0 ? (
                    <div style={s.fcLoadingCard}>
                      <div style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Could not generate flashcards. Try different chapters.</div>
                      <button style={s.fcBackLink} onClick={() => setFcStep('chapter')}>← Try again</button>
                    </div>
                  ) : (
                    <>
                      <div style={s.fcProgress}>
                        <span style={{ color: fcSubject?.color, fontWeight: 600 }}>{fcSubject?.label}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{fcIndex + 1} / {fcCards.length}</span>
                      </div>

                      <div style={s.fcCard(fcSubject?.color)} onClick={() => setFcFlipped(!fcFlipped)}>
                        {!fcFlipped ? (
                          <div style={s.fcCardFront}>
                            <div style={s.fcCardLabel}>QUESTION</div>
                            <div style={s.fcCardText}>{fcCards[fcIndex]?.front}</div>
                            {!fcShowHint && fcCards[fcIndex]?.hint && (
                              <button style={s.fcHintBtn} onClick={(e) => { e.stopPropagation(); setFcShowHint(true) }}>Show hint</button>
                            )}
                            {fcShowHint && (
                              <div style={s.fcHintText}>💡 {fcCards[fcIndex]?.hint}</div>
                            )}
                            <div style={s.fcTapHint}>Tap to reveal answer</div>
                          </div>
                        ) : (
                          <div style={s.fcCardBack}>
                            <div style={s.fcCardLabel}>ANSWER</div>
                            <div style={s.fcCardText}>{fcCards[fcIndex]?.back}</div>
                            <div style={s.fcTapHint}>Tap to see question</div>
                          </div>
                        )}
                      </div>

                      <div style={s.fcNavRow}>
                        <button style={s.fcNavBtn} onClick={fcPrev} disabled={fcIndex === 0}>← Prev</button>
                        <button style={s.fcNavBtn} onClick={fcNext} disabled={fcIndex === fcCards.length - 1}>Next →</button>
                      </div>

                      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
                        <button style={s.fcBackLink} onClick={() => setFcStep('chapter')}>← Change chapters</button>
                        <button style={s.fcBackLink} onClick={exitFlashcardMode}>Exit flashcards</button>
                      </div>

                      <div style={s.fcProgressBar}>
                        {fcCards.map((_, i) => (
                          <div
                            key={i}
                            style={s.fcProgressDot(i === fcIndex, i < fcIndex, fcSubject?.color)}
                            onClick={() => { setFcIndex(i); setFcFlipped(false); setFcShowHint(false) }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        ) : mode === 'quiz' ? (
          /* ===== QUIZ MODE ===== */
          <div style={s.messagesArea}>
            <div style={s.messagesInner}>

              {qzStep === 'subject' && (
                <div style={s.welcome}>
                  <div style={s.welcomeEmoji}>📝</div>
                  <div style={s.welcomeTitle}>Revision Quiz</div>
                  <div style={s.welcomeSub}>Pick a subject to test yourself with MCQs from your textbook.</div>
                  <div style={s.subjectRow}>
                    {subjects.map((subj) => (
                      <button key={subj.key} className="subject-chip" style={s.subjectChip(subj.color)} onClick={() => handleQzSubjectClick(subj)}>
                        <span style={s.chipDot(subj.color)} />
                        {subj.label}
                      </button>
                    ))}
                  </div>
                  <button style={s.fcBackLink} onClick={exitQuizMode}>← Back to Chat</button>
                </div>
              )}

              {qzStep === 'chapter' && (
                <div style={s.welcome}>
                  <div style={{ ...s.welcomeTitle, fontSize: 22 }}>
                    <span style={{ color: qzSubject?.color }}>{qzSubject?.label}</span> — Select Chapters
                  </div>
                  <div style={s.welcomeSub}>Pick chapters to include in your quiz.</div>

                  {qzLoading ? (
                    <div style={s.fcLoadingText}>Loading chapters...</div>
                  ) : qzAvailableChapters.length === 0 ? (
                    <div style={s.fcLoadingText}>No chapters found for this subject.</div>
                  ) : (
                    <>
                      <div style={s.fcChapterGrid}>
                        <button
                          className="subject-chip"
                          style={s.fcChapterBtn(qzSelectedChapters.length === qzAvailableChapters.length, qzSubject?.color)}
                          onClick={toggleAllQzChapters}
                        >
                          All Chapters
                        </button>
                        {qzAvailableChapters.map((ch) => (
                          <button
                            key={ch}
                            className="subject-chip"
                            style={s.fcChapterBtn(qzSelectedChapters.includes(ch), qzSubject?.color)}
                            onClick={() => toggleQzChapter(ch)}
                          >
                            Ch {ch}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
                        <button style={s.fcBackLink} onClick={() => setQzStep('subject')}>← Back</button>
                        <button
                          style={s.fcStartBtn(qzSelectedChapters.length > 0, qzSubject?.color)}
                          disabled={qzSelectedChapters.length === 0}
                          onClick={startQuizSession}
                        >
                          Start Quiz →
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {qzStep === 'session' && (
                <div style={s.fcSessionContainer}>
                  {qzLoading ? (
                    <div style={s.fcLoadingCard}>
                      <div style={{ fontSize: 36, marginBottom: 16 }}>📝</div>
                      <div style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Preparing your quiz...</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, opacity: 0.6 }}>Generating questions from your textbook</div>
                    </div>
                  ) : qzQuestions.length === 0 ? (
                    <div style={s.fcLoadingCard}>
                      <div style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Could not generate quiz. Try different chapters.</div>
                      <button style={s.fcBackLink} onClick={() => setQzStep('chapter')}>← Try again</button>
                    </div>
                  ) : qzIndex >= qzQuestions.length ? null : (
                    <>
                      <div style={s.fcProgress}>
                        <span style={{ color: qzSubject?.color, fontWeight: 600 }}>{qzSubject?.label} Quiz</span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {qzIndex + 1} / {qzQuestions.length} · Score: {qzScore}/{qzAnswered}
                        </span>
                      </div>

                      {/* Score card at end */}
                      {qzAnswered === qzQuestions.length && qzRevealed ? (
                        <div style={s.qzScoreCard(qzSubject?.color)}>
                          <div style={{ fontSize: 44, marginBottom: 12 }}>
                            {qzScore === qzQuestions.length ? '🏆' : qzScore >= qzQuestions.length * 0.7 ? '🎉' : qzScore >= qzQuestions.length * 0.4 ? '💪' : '📖'}
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {qzScore} / {qzQuestions.length}
                          </div>
                          <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8 }}>
                            {qzScore === qzQuestions.length ? 'Perfect score! You nailed it!' :
                             qzScore >= qzQuestions.length * 0.7 ? 'Great job! Keep it up!' :
                             qzScore >= qzQuestions.length * 0.4 ? 'Good effort! Review the chapters again.' :
                             'Keep studying — you\'ll get there!'}
                          </div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button style={{ ...s.fcNavBtn, background: qzSubject?.color, color: '#fff', border: 'none' }} onClick={() => setQzStep('results')}>View Detailed Results</button>
                            <button style={s.fcNavBtn} onClick={startQuizSession}>Retry</button>
                            <button style={s.fcNavBtn} onClick={exitQuizMode}>Exit</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={s.qzQuestionCard}>
                            <div style={s.fcCardLabel}>QUESTION {qzIndex + 1}</div>
                            <div style={s.qzQuestionText}>{qzQuestions[qzIndex]?.question}</div>
                          </div>

                          <div style={s.qzOptionsGrid}>
                            {qzQuestions[qzIndex]?.options?.map((opt, i) => {
                              const isCorrect = i === qzQuestions[qzIndex]?.correct
                              const isSelected = i === qzSelected
                              let optStyle = s.qzOption
                              if (qzRevealed) {
                                if (isCorrect) optStyle = s.qzOptionCorrect
                                else if (isSelected) optStyle = s.qzOptionWrong
                              } else if (isSelected) {
                                optStyle = s.qzOptionSelected
                              }
                              return (
                                <button key={i} style={optStyle} onClick={() => handleQzAnswer(i)}>
                                  <span style={s.qzOptionLabel}>{String.fromCharCode(65 + i)}</span>
                                  {opt}
                                </button>
                              )
                            })}
                          </div>

                          {qzRevealed && (
                            <div style={s.qzExplanation(qzSelected === qzQuestions[qzIndex]?.correct)}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                {qzSelected === qzQuestions[qzIndex]?.correct ? '✓ Correct!' : '✗ Incorrect'}
                              </div>
                              {qzQuestions[qzIndex]?.explanation}
                            </div>
                          )}

                          <div style={s.fcNavRow}>
                            {qzRevealed && qzIndex < qzQuestions.length - 1 && (
                              <button style={{ ...s.fcNavBtn, background: qzSubject?.color, color: '#fff', border: 'none' }} onClick={qzNext}>Next Question →</button>
                            )}
                          </div>
                        </>
                      )}

                      <div style={s.fcProgressBar}>
                        {qzQuestions.map((_, i) => (
                          <div key={i} style={s.fcProgressDot(i === qzIndex, i < qzIndex, qzSubject?.color)} />
                        ))}
                      </div>

                      <button style={s.fcBackLink} onClick={exitQuizMode}>Exit quiz</button>
                    </>
                  )}
                </div>
              )}

              {qzStep === 'results' && (
                <div style={s.fcSessionContainer}>
                  <div style={s.qzResultsHeader}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>
                      {qzScore === qzQuestions.length ? '🏆' : qzScore >= qzQuestions.length * 0.7 ? '🎉' : '📝'}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                      <span style={{ color: qzSubject?.color }}>{qzSubject?.label}</span> Quiz Results
                    </div>
                    <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Score: <strong style={{ color: qzScore >= qzQuestions.length * 0.7 ? '#22c55e' : qzScore >= qzQuestions.length * 0.4 ? '#f59e0b' : 'var(--danger)' }}>{qzScore}</strong> / {qzQuestions.length}
                    </div>
                  </div>

                  {qzQuestions.map((q, i) => {
                    const answer = qzAnswers.find((a) => a.questionIndex === i)
                    const selected = answer?.selected
                    const wasCorrect = answer?.correct
                    return (
                      <div key={i} style={s.qzResultItem}>
                        <div style={s.qzResultQ}>
                          <span style={s.qzResultNum(wasCorrect)}>{i + 1}</span>
                          <span>{q.question}</span>
                        </div>
                        <div style={s.qzResultOptions}>
                          {q.options?.map((opt, j) => {
                            const isCorrectOpt = j === q.correct
                            const isSelectedOpt = j === selected
                            return (
                              <div key={j} style={s.qzResultOpt(isCorrectOpt, isSelectedOpt && !isCorrectOpt)}>
                                <span style={s.qzOptionLabel}>{String.fromCharCode(65 + j)}</span>
                                {opt}
                                {isCorrectOpt && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#22c55e' }}>✓</span>}
                                {isSelectedOpt && !isCorrectOpt && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--danger)' }}>✗</span>}
                              </div>
                            )
                          })}
                        </div>
                        {q.explanation && (
                          <div style={s.qzResultExplanation}>{q.explanation}</div>
                        )}
                      </div>
                    )
                  })}

                  <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <button style={{ ...s.fcNavBtn, background: qzSubject?.color, color: '#fff', border: 'none' }} onClick={() => { setQzStep('chapter'); handleQzSubjectClick(qzSubject) }}>Retake Quiz</button>
                    <button style={s.fcNavBtn} onClick={exitQuizMode}>Back to Chat</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          /* ===== CHAT MODE ===== */
          <>
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
                    <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="subject-chip" style={s.fcModeBtn} onClick={enterFlashcardMode}>
                        🗂️ Flashcards
                      </button>
                      <button className="subject-chip" style={s.fcModeBtn} onClick={enterQuizMode}>
                        📝 Revision Quiz
                      </button>
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
          </>
        )}
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
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: 6,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    opacity: 0.6,
    transition: 'opacity 0.15s',
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

  // Flashcard mode button
  fcModeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    borderRadius: 50,
    border: '1.5px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'filter 0.15s, transform 0.15s',
  },
  fcBackLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    marginTop: 20,
    padding: '6px 12px',
  },
  fcLoadingText: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    padding: '32px 0',
  },
  fcChapterGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 480,
    margin: '0 auto',
  },
  fcChapterBtn: (selected, color) => ({
    padding: '8px 16px',
    borderRadius: 50,
    border: `1.5px solid ${selected ? color : 'var(--border)'}`,
    background: selected ? `${color}20` : 'var(--bg-card)',
    color: selected ? color : 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  fcStartBtn: (enabled, color) => ({
    padding: '10px 24px',
    borderRadius: 50,
    border: 'none',
    background: enabled ? color : 'var(--bg-card)',
    color: enabled ? '#fff' : 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.5,
    marginTop: 0,
  }),

  // Flashcard session
  fcSessionContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 20px',
    gap: 16,
  },
  fcLoadingCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center',
  },
  fcProgress: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 480,
    fontSize: 13,
    padding: '0 4px',
  },
  fcCard: (color) => ({
    width: '100%',
    maxWidth: 480,
    minHeight: 280,
    borderRadius: 20,
    border: `2px solid ${color || 'var(--border)'}`,
    background: 'var(--bg-card)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 28px',
    transition: 'transform 0.15s',
    userSelect: 'none',
  }),
  fcCardFront: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 16,
    width: '100%',
  },
  fcCardBack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 16,
    width: '100%',
  },
  fcCardLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  fcCardText: {
    fontSize: 17,
    lineHeight: 1.7,
    color: 'var(--text-primary)',
  },
  fcHintBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 20,
    color: 'var(--text-secondary)',
    fontSize: 12,
    padding: '4px 14px',
    cursor: 'pointer',
  },
  fcHintText: {
    fontSize: 13,
    color: '#f59e0b',
    fontStyle: 'italic',
  },
  fcTapHint: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    opacity: 0.5,
    marginTop: 8,
  },
  fcNavRow: {
    display: 'flex',
    gap: 16,
    marginTop: 8,
  },
  fcNavBtn: {
    padding: '10px 24px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  fcProgressBar: {
    display: 'flex',
    gap: 6,
    marginTop: 12,
  },
  fcProgressDot: (active, done, color) => ({
    width: active ? 20 : 10,
    height: 10,
    borderRadius: 5,
    background: active ? (color || 'var(--accent)') : done ? `${color || 'var(--accent)'}60` : 'var(--border)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }),

  // Quiz styles
  qzQuestionCard: {
    width: '100%',
    maxWidth: 520,
    padding: '28px 24px',
    borderRadius: 16,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    textAlign: 'left',
  },
  qzQuestionText: {
    fontSize: 17,
    lineHeight: 1.7,
    color: 'var(--text-primary)',
    marginTop: 12,
  },
  qzOptionsGrid: {
    width: '100%',
    maxWidth: 520,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  qzOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    borderRadius: 12,
    border: '1.5px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  qzOptionSelected: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    borderRadius: 12,
    border: '1.5px solid var(--accent)',
    background: 'var(--accent-dim)',
    color: 'var(--text-primary)',
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer',
  },
  qzOptionCorrect: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    borderRadius: 12,
    border: '1.5px solid #22c55e',
    background: '#22c55e18',
    color: 'var(--text-primary)',
    fontSize: 14,
    textAlign: 'left',
    cursor: 'default',
  },
  qzOptionWrong: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    borderRadius: 12,
    border: '1.5px solid var(--danger)',
    background: '#ff444418',
    color: 'var(--text-primary)',
    fontSize: 14,
    textAlign: 'left',
    cursor: 'default',
  },
  qzOptionLabel: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '1.5px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    color: 'var(--text-secondary)',
  },
  qzExplanation: (correct) => ({
    width: '100%',
    maxWidth: 520,
    padding: '14px 18px',
    borderRadius: 12,
    background: correct ? '#22c55e12' : '#ff444412',
    border: `1px solid ${correct ? '#22c55e40' : '#ff444440'}`,
    color: 'var(--text-primary)',
    fontSize: 14,
    lineHeight: 1.6,
    textAlign: 'left',
  }),
  qzScoreCard: (color) => ({
    width: '100%',
    maxWidth: 480,
    padding: '48px 32px',
    borderRadius: 20,
    background: 'var(--bg-card)',
    border: `2px solid ${color || 'var(--accent)'}`,
    textAlign: 'center',
  }),

  // Quiz results view
  qzResultsHeader: {
    textAlign: 'center',
    marginBottom: 16,
  },
  qzResultItem: {
    width: '100%',
    maxWidth: 560,
    padding: '20px',
    borderRadius: 14,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  qzResultQ: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.5,
  },
  qzResultNum: (correct) => ({
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: correct === true ? '#22c55e20' : correct === false ? '#ff444420' : 'var(--bg-primary)',
    color: correct === true ? '#22c55e' : correct === false ? 'var(--danger)' : 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  }),
  qzResultOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginLeft: 36,
  },
  qzResultOpt: (isCorrect, isWrong) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 13,
    color: 'var(--text-primary)',
    background: isCorrect ? '#22c55e10' : isWrong ? '#ff444410' : 'transparent',
    border: isCorrect ? '1px solid #22c55e40' : isWrong ? '1px solid #ff444440' : '1px solid transparent',
  }),
  qzResultExplanation: {
    marginLeft: 36,
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    fontStyle: 'italic',
    borderLeft: '2px solid var(--border)',
    paddingLeft: 12,
  },
}
