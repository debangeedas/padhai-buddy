import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 53px)',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  welcome: {
    textAlign: 'center',
    padding: '60px 20px',
    color: 'var(--text-secondary)',
  },
  welcomeTitle: {
    color: 'var(--accent)',
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
  },
  message: (role) => ({
    maxWidth: '75%',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    padding: '12px 16px',
    borderRadius: 14,
    fontSize: 14,
    lineHeight: 1.6,
    background: role === 'user' ? 'var(--user-bg)' : 'var(--bg-card)',
    border: `1px solid ${role === 'user' ? 'var(--user-border)' : 'var(--border)'}`,
  }),
  label: {
    fontSize: 11,
    color: 'var(--accent)',
    marginBottom: 4,
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  controls: {
    padding: 16,
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  talkBtn: (state) => ({
    width: 72,
    height: 72,
    borderRadius: '50%',
    border: `3px solid ${state === 'recording' ? 'var(--danger)' : state === 'playing' ? '#f59e0b' : 'var(--accent)'}`,
    background: state === 'recording' ? 'var(--danger)' : state === 'processing' ? '#333' : state === 'playing' ? 'transparent' : 'transparent',
    color: state === 'recording' ? 'white' : state === 'processing' ? '#888' : state === 'playing' ? '#f59e0b' : 'var(--accent)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    pointerEvents: state === 'processing' ? 'none' : 'auto',
    animation: state === 'recording' ? 'pulse 1s infinite' : 'none',
  }),
  stopBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '2px solid var(--danger)',
    background: 'transparent',
    color: 'var(--danger)',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    width: '100%',
    maxWidth: 500,
  },
  textInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
  },
  sendBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    fontWeight: 600,
    fontSize: 14,
  },
  status: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    minHeight: 18,
  },
  liveTranscript: {
    fontSize: 12,
    color: 'var(--accent)',
    fontStyle: 'italic',
    minHeight: 18,
  },
  btnRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  newChatBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  messagesWrapper: {
    position: 'relative',
    flex: 1,
    overflowY: 'auto',
  },
}

export default function Chat({ userId }) {
  const [messages, setMessages] = useState([])
  const [textInput, setTextInput] = useState('')
  const [status, setStatus] = useState('')
  const [btnState, setBtnState] = useState('ready')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [sessionId, setSessionId] = useState(null)

  const wsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const isRecordingRef = useRef(false)
  const recognitionRef = useRef(null)
  const finalTranscriptRef = useRef('')
  const messagesEndRef = useRef(null)
  const profileRef = useRef({ language: 'english' })
  const audioRef = useRef(null)

  useEffect(() => {
    loadProfile()
    createSession()
    connectWebSocket()
    return () => {
      wsRef.current?.close()
      stopAudio()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('language')
      .eq('user_id', userId)
      .single()
    if (data) profileRef.current = data
  }

  async function createSession() {
    const { data } = await supabase
      .from('chat_sessions')
      .insert({ user_id: userId })
      .select()
      .single()
    if (data) setSessionId(data.id)
  }

  function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${location.host}/ws/chat`)

    ws.onopen = () => {
      setStatus('Connected')
      setBtnState('ready')
    }
    ws.onclose = () => {
      setStatus('Disconnected. Reconnecting...')
      setTimeout(connectWebSocket, 2000)
    }
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const assistantMsg = { role: 'assistant', content: data.text }
      setMessages((prev) => [...prev, assistantMsg])
      saveMessage(assistantMsg)
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
    audio.onended = () => {
      audioRef.current = null
      setBtnState('ready')
      setStatus('')
    }
    audio.play().catch(() => {
      audioRef.current = null
      setBtnState('ready')
      setStatus('')
    })
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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true

    const lang = profileRef.current.language
    recognition.lang = lang === 'hindi' ? 'hi-IN' : 'en-IN'

    finalTranscriptRef.current = ''

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' '
        } else {
          interim += event.results[i][0].transcript
        }
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
    if (btnState === 'playing') {
      stopAudio()
      return
    }
    if (isRecordingRef.current) {
      stopRecording()
    } else {
      startRecording()
    }
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

          const lang = profileRef.current.language || 'english'
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64,
            transcript: transcript,
            language: lang,
          }))
        }
        reader.readAsDataURL(audioBlob)
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      isRecordingRef.current = true
      setBtnState('recording')
      setStatus('Sun raha hai... bol!')
      startSpeechRecognition()
    } catch {
      setStatus('Mic access denied. Please allow microphone.')
    }
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

  function startNewChat() {
    stopAudio()
    setMessages([])
    setStatus('')
    setBtnState('ready')
    setLiveTranscript('')
    wsRef.current?.close()
    createSession()
    connectWebSocket()
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

    const lang = profileRef.current.language || 'english'
    wsRef.current.send(JSON.stringify({ type: 'text', text, language: lang }))
    setTextInput('')
  }

  function getButtonLabel() {
    if (btnState === 'recording') return 'RUKO'
    if (btnState === 'processing') return '...'
    if (btnState === 'playing') return '||'
    return 'BOLO'
  }

  return (
    <div style={styles.container}>
      <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }`}</style>

      <div style={styles.messagesWrapper}>
        {messages.length > 0 && (
          <button style={styles.newChatBtn} onClick={startNewChat}>+ New Chat</button>
        )}
        <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.welcome}>
            <div style={styles.welcomeTitle}>Namaste!</div>
            <div>Mic button dabao aur apna doubt pooch lo, ya neeche type karo.</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={styles.message(msg.role)}>
            <div style={styles.label}>{msg.role === 'user' ? 'Tum' : 'Padhai Buddy'}</div>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
        </div>
      </div>

      <div style={styles.controls}>
        <div style={styles.btnRow}>
          {btnState === 'recording' && (
            <button style={styles.stopBtn} onClick={cancelRecording} title="Cancel recording">
              x
            </button>
          )}
          <button style={styles.talkBtn(btnState)} onClick={handleMainButton}>
            {getButtonLabel()}
          </button>
        </div>
        {liveTranscript && <div style={styles.liveTranscript}>"{liveTranscript}"</div>}
        <div style={styles.status}>{status}</div>
        <div style={styles.inputRow}>
          <input
            style={styles.textInput}
            type="text"
            placeholder="Ya yahan type karo..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText()}
            disabled={btnState === 'processing'}
          />
          <button style={styles.sendBtn} onClick={sendText} disabled={btnState === 'processing'}>Bhejo</button>
        </div>
      </div>
    </div>
  )
}
