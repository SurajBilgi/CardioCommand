import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { sendChat, fetchPatient } from '../services/api'

const PATIENT_ID = 'john-mercer'

const SEED_MESSAGES = [
  {
    id: '1',
    role: 'cora',
    message: "Good morning, John! 👋 I'm Cora, your cardiac rehab coach. You're in Week 2 of your 12-week program — and you've already built a 4-day streak. How are you feeling today?",
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: '2',
    role: 'patient',
    message: "Honestly, I'm really tired. I don't know if I have the energy for a walk today.",
    timestamp: new Date(Date.now() - 110000).toISOString(),
  },
  {
    id: '3',
    role: 'cora',
    message: "That's completely understandable — Week 2 is where it gets real, and fatigue is one of the most common barriers I hear. You're not alone in this.\n\nCan I ask — is it more of a physical tired, or does it feel more like \"I just don't feel up to it\" emotionally?",
    timestamp: new Date(Date.now() - 100000).toISOString(),
  },
  {
    id: '4',
    role: 'patient',
    message: "More emotional I think. I'm just worried if pushing myself is actually safe after the surgery.",
    timestamp: new Date(Date.now() - 90000).toISOString(),
  },
  {
    id: '5',
    role: 'cora',
    message: "That fear makes complete sense — and it shows how much you care about your recovery. That's actually a sign of wisdom, not weakness.\n\nHere's what your data tells me: your heart rate has been stable, your oxygen has been great, and Dr. Rao specifically designed this program for where you are right now. Even a 10-minute gentle walk is safe and counts.\n\nWhat if we tried just 10 minutes today? Not a full session — just 10 minutes. You can stop anytime. 💙",
    timestamp: new Date(Date.now() - 80000).toISOString(),
  },
]

function ChatBubble({ message }) {
  const isPatient = message.role === 'patient'
  const isCora = message.role === 'cora'

  return (
    <motion.div
      className={clsx('flex gap-2 max-w-[85%]', isPatient ? 'ml-auto flex-row-reverse' : 'mr-auto')}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {isCora && (
        <div className="w-7 h-7 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center shrink-0 mt-auto mb-1">
          <span className="text-sm">❤️</span>
        </div>
      )}

      <div className={clsx(
        'rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isPatient
          ? 'bg-accent-primary text-white rounded-br-sm'
          : 'bg-bg-surface border border-bg-border text-txt-primary rounded-bl-sm shadow-sm'
      )}>
        <p className="whitespace-pre-wrap">{message.message}</p>
        <p className={clsx('text-xs mt-1', isPatient ? 'text-white/60' : 'text-txt-muted')}>
          {new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 mr-auto">
      <div className="w-7 h-7 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center shrink-0">
        <span className="text-sm">❤️</span>
      </div>
      <div className="bg-bg-surface border border-bg-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-txt-muted"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Chat() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState(SEED_MESSAGES)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState('')
  const [escalated, setEscalated] = useState(false)
  const [patient, setPatient] = useState(null)
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  // Check if Web Speech API is available
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let interim = ''
        let final = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript
          } else {
            interim += event.results[i][0].transcript
          }
        }
        // Show interim results live in the input, commit final
        setInput(final || interim)
      }

      recognition.onend = () => {
        setListening(false)
      }

      recognition.onerror = () => {
        setListening(false)
      }

      recognitionRef.current = recognition
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      setInput('')
      recognitionRef.current.start()
      setListening(true)
    }
  }

  useEffect(() => {
    fetchPatient(PATIENT_ID).then(setPatient).catch(() => {})
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMsg])

  const sendMessage = async () => {
    if (!input.trim() || streaming) return

    const userMsg = {
      id: Date.now().toString(),
      role: 'patient',
      message: input.trim(),
      timestamp: new Date().toISOString(),
    }

    const history = messages.map(m => ({ role: m.role === 'cora' ? 'assistant' : 'user', message: m.message }))
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamingMsg('')

    try {
      const response = await sendChat(PATIENT_ID, userMsg.message, patient || {}, history)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let didEscalate = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const evt = JSON.parse(line.slice(6))
              if (evt.type === 'token') {
                fullText += evt.content
                setStreamingMsg(fullText)
              }
              if (evt.type === 'complete' && evt.escalate) {
                didEscalate = true
              }
            } catch {}
          }
        }
      }

      const coraMsg = {
        id: (Date.now() + 1).toString(),
        role: 'cora',
        message: fullText.replace('ESCALATE_TO_MD: true', '').trim(),
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, coraMsg])
      setStreamingMsg('')
      if (didEscalate) setEscalated(true)

    } catch (err) {
      const fallback = {
        id: (Date.now() + 1).toString(),
        role: 'cora',
        message: "I'm having trouble connecting right now. If you're experiencing chest pain, shortness of breath, or any emergency symptoms, please call 911 immediately.",
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, fallback])
      setStreamingMsg('')
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="app-container flex flex-col h-screen bg-bg-base">
      {/* Header */}
      <div className="bg-bg-surface border-b border-bg-border px-4 pt-safe pt-4 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/')} className="font-ui text-txt-secondary text-sm">← Back</button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center cora-avatar">
            <span>❤️</span>
          </div>
          <div>
            <p className="font-display text-sm text-txt-primary">Cora — Your Cardiac Rehab Coach</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-calm" />
              <p className="font-ui text-xs text-txt-secondary">Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* Escalation Banner */}
      <AnimatePresence>
        {escalated && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-2xl p-4"
          >
            <p className="font-ui font-semibold text-sm text-red-700 mb-1">🚨 Cora has alerted your care team</p>
            <p className="font-ui text-xs text-red-600">Dr. Rao's office will call you within the hour.</p>
            <p className="font-ui text-xs text-red-600 mt-2">If this is an emergency:</p>
            <button className="mt-2 w-full bg-red-600 text-white font-ui font-semibold py-2.5 rounded-xl text-sm">
              📞 Call 911
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {streaming && !streamingMsg && <TypingIndicator />}
        {streamingMsg && (
          <div className="flex gap-2 mr-auto max-w-[85%]">
            <div className="w-7 h-7 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center shrink-0 mt-auto mb-1">
              <span className="text-sm">❤️</span>
            </div>
            <div className="bg-bg-surface border border-bg-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <p className="text-sm text-txt-primary whitespace-pre-wrap leading-relaxed stream-cursor">{streamingMsg}</p>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="bg-bg-surface border-t border-bg-border px-4 py-3 shrink-0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {/* Listening indicator */}
        <AnimatePresence>
          {listening && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2"
            >
              <motion.div
                className="w-2.5 h-2.5 rounded-full bg-red-500"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <p className="font-ui text-xs text-red-600 font-medium">Listening… speak clearly and slowly</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 items-end">
          {/* Mic button — large, easy to tap for elderly users */}
          {speechSupported && (
            <motion.button
              onClick={toggleListening}
              whileTap={{ scale: 0.9 }}
              className={clsx(
                'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors',
                listening
                  ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                  : 'bg-bg-elevated border-2 border-bg-border text-txt-secondary hover:border-accent-calm hover:text-accent-calm'
              )}
              title={listening ? 'Tap to stop' : 'Tap to speak'}
            >
              {listening ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </motion.button>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder={listening ? 'Listening…' : 'Tap 🎤 to speak or type here'}
            rows={1}
            className={clsx(
              'flex-1 bg-bg-elevated border rounded-xl px-4 py-3 font-ui text-sm text-txt-primary placeholder-txt-muted outline-none resize-none transition-colors',
              listening ? 'border-red-300 bg-red-50' : 'border-bg-border focus:border-accent-primary/50'
            )}
            style={{ maxHeight: '120px' }}
          />
          <motion.button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 rounded-2xl bg-accent-primary text-white flex items-center justify-center disabled:opacity-40 shrink-0 shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </motion.button>
        </div>

        {/* Helper hint for first-time users */}
        {speechSupported && !listening && !input && (
          <p className="font-ui text-xs text-txt-muted text-center mt-2">
            Tap the mic 🎤 to speak — no typing needed
          </p>
        )}
      </div>
    </div>
  )
}
