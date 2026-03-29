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
    message: "Good morning! I'm Cora, your recovery companion. How are you feeling on Day 8 of your recovery from bypass surgery?",
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: '2',
    role: 'patient',
    message: "I'm feeling pretty tired today. More than usual. And my chest feels a bit tight.",
    timestamp: new Date(Date.now() - 110000).toISOString(),
  },
  {
    id: '3',
    role: 'cora',
    message: "Thank you for telling me that — it takes courage to speak up about how you're really feeling. Some fatigue at Day 8 is normal after bypass surgery.\n\nWhen you say your chest feels tight, can you describe it? Is it like pressure, soreness near your incision, or something different?",
    timestamp: new Date(Date.now() - 100000).toISOString(),
  },
  {
    id: '4',
    role: 'patient',
    message: "More like a soreness. Not crushing or anything scary. Around where they did the surgery.",
    timestamp: new Date(Date.now() - 90000).toISOString(),
  },
  {
    id: '5',
    role: 'cora',
    message: "That makes sense — incision soreness at Day 8 is very common and expected as your body heals.\n\nI do want to flag that your heart rate has been a little faster than usual, and your oxygen levels dipped slightly overnight. Your care team has been notified. 💙\n\nFor today: rest well, stay hydrated, and take your Metoprolol on time.\n\nIf the soreness gets worse or spreads to your arm or jaw, call us immediately, okay?",
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
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

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
            <p className="font-display text-sm text-txt-primary">Cora — Your Recovery Guide</p>
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
      <div className="bg-bg-surface border-t border-bg-border px-4 py-3 shrink-0 pb-safe" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 items-end">
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
            placeholder="Message Cora..."
            rows={1}
            className="flex-1 bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 font-ui text-sm text-txt-primary placeholder-txt-muted outline-none focus:border-accent-primary/50 resize-none"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            className="w-10 h-10 rounded-xl bg-accent-primary text-white flex items-center justify-center disabled:opacity-50 shrink-0"
          >
            <span className="text-sm">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
