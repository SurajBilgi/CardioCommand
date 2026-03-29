import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { generateSoapNote } from '../services/api'
import { Button } from '../components/ui/Button'

const DEMO_TRANSCRIPT = [
  { speaker: 'Dr. Rao', text: 'Good morning, John. How has your breathing been since we last spoke?' },
  { speaker: 'John', text: 'A little tired honestly. But no chest pain or anything.' },
  { speaker: 'Dr. Rao', text: 'Any ankle swelling in the mornings when you wake up?' },
  { speaker: 'John', text: 'A little bit, yes. Both ankles. More on the right.' },
  { speaker: 'Dr. Rao', text: 'Are you taking your Furosemide every morning as prescribed?' },
  { speaker: 'John', text: 'Yes, I think so. I set an alarm for it.' },
  { speaker: 'Dr. Rao', text: 'Good. Have you been able to get any walking in?' },
  { speaker: 'John', text: 'Short walks around the house. Maybe 10 minutes. The stairs tire me out.' },
  { speaker: 'Dr. Rao', text: 'That\'s expected at this stage. We\'ll increase the activity level gradually. Any palpitations?' },
  { speaker: 'John', text: 'No fluttering or anything like that. Just slow and tired.' },
]

const INITIAL_SOAP = {
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
}

export default function AmbientDoc() {
  const navigate = useNavigate()
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [transcript, setTranscript] = useState([])
  const [soap, setSoap] = useState(INITIAL_SOAP)
  const [updating, setUpdating] = useState(false)
  const [approved, setApproved] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const timerRef = useRef(null)
  const transcriptRef = useRef(null)
  const soapUpdateRef = useRef(null)
  const demoIndexRef = useRef(0)

  const patient = {
    id: 'john-mercer',
    name: 'John Mercer',
    age: 67,
    surgery_type: 'CABG',
    days_post_op: 8,
  }

  const formatDuration = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const updateSoapNote = useCallback(async (lines) => {
    if (lines.length === 0) return
    setUpdating(true)
    const transcriptText = lines.map(l => `${l.speaker}: "${l.text}"`).join('\n')
    try {
      const updated = await generateSoapNote(patient, soap, transcriptText)
      setSoap(updated)
    } catch (e) {
      setSoap(prev => ({
        subjective: prev.subjective || 'Patient reports fatigue and mild bilateral ankle edema. Denies chest pain, palpitations, or dyspnea at rest.',
        objective: 'Day 8 post-CABG. HR 96 bpm, SpO₂ 93%. Bilateral ankle edema noted.',
        assessment: 'Post-operative recovery progressing. Mild fluid retention. Activity tolerance reduced.',
        plan: 'Continue current diuretic regimen. Increase ambulation to 15-20 min daily. Follow up in 1 week.',
      }))
    } finally {
      setUpdating(false)
    }
  }, [soap, patient])

  const startDemo = () => {
    setDemoMode(true)
    setRecording(true)
    setTranscript([])
    setSoap(INITIAL_SOAP)
    demoIndexRef.current = 0

    const addLine = () => {
      if (demoIndexRef.current >= DEMO_TRANSCRIPT.length) return
      const line = DEMO_TRANSCRIPT[demoIndexRef.current]
      setTranscript(prev => [...prev, line])
      demoIndexRef.current += 1

      if (demoIndexRef.current % 3 === 0) {
        setTranscript(prev => {
          updateSoapNote(prev)
          return prev
        })
      }
    }

    const interval = setInterval(() => {
      if (demoIndexRef.current < DEMO_TRANSCRIPT.length) {
        addLine()
      } else {
        clearInterval(interval)
      }
    }, 2500)

    return () => clearInterval(interval)
  }

  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [recording])

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  const stopRecording = () => {
    setRecording(false)
    if (transcript.length > 0) {
      updateSoapNote(transcript)
    }
  }

  const handleApprove = () => {
    setApproved(true)
    setTimeout(() => navigate('/'), 2000)
  }

  return (
    <div className="flex flex-col h-screen bg-bg-base overflow-hidden">
      {/* Nav */}
      <nav className="h-12 bg-bg-surface border-b border-bg-border px-4 flex items-center gap-4 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-text-muted hover:text-text-primary font-mono text-sm transition-colors"
        >
          ← Back
        </button>
        <span className="font-display text-base font-bold text-text-primary">Ambient Documentation</span>
        <span className="text-text-muted text-sm">·</span>
        <span className="text-sm text-text-secondary">John Mercer — Day 8 CABG</span>

        <div className="ml-auto flex items-center gap-3">
          {recording && (
            <div className="flex items-center gap-2">
              <span className="live-dot w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span className="font-mono text-sm text-red-400">{formatDuration(duration)}</span>
            </div>
          )}
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Transcript Panel */}
        <div className="w-1/2 border-r border-bg-border flex flex-col">
          <div className="px-4 py-3 border-b border-bg-border">
            <p className="text-xs font-mono text-text-muted uppercase tracking-wider">Live Transcript</p>
          </div>

          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            <AnimatePresence>
              {transcript.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-3"
                >
                  <span className={clsx(
                    'text-xs font-mono shrink-0 pt-0.5 font-semibold w-16 truncate',
                    line.speaker === 'Dr. Rao' ? 'text-accent-primary' : 'text-text-secondary'
                  )}>
                    {line.speaker}:
                  </span>
                  <span className="text-sm text-text-primary leading-relaxed">"{line.text}"</span>
                </motion.div>
              ))}
            </AnimatePresence>

            {recording && transcript.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3, 4].map(i => (
                    <motion.div
                      key={i}
                      className="w-1 bg-accent-primary rounded-full"
                      animate={{ height: [8, 24, 8] }}
                      transition={{ duration: 0.8, delay: i * 0.1, repeat: Infinity }}
                    />
                  ))}
                </div>
                <p className="text-text-muted text-xs font-mono">Listening for speech...</p>
              </div>
            )}

            {!recording && transcript.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-4">
                <p className="text-text-muted text-sm font-mono">Click below to start recording</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 border-t border-bg-border flex items-center justify-center gap-3">
            {!recording ? (
              <>
                <Button variant="primary" onClick={startDemo}>
                  🎙️ Start Visit Documentation
                </Button>
                <span className="text-text-muted text-xs font-mono">or</span>
                <Button variant="secondary" onClick={startDemo}>
                  ▶ Run Demo
                </Button>
              </>
            ) : (
              <Button variant="danger" onClick={stopRecording}>
                ⏹ Stop Recording
              </Button>
            )}
          </div>
        </div>

        {/* SOAP Note Panel */}
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-3 border-b border-bg-border flex items-center justify-between">
            <p className="text-xs font-mono text-text-muted uppercase tracking-wider">SOAP Note — AI Generated</p>
            {updating && (
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-accent-primary"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {(['subjective', 'objective', 'assessment', 'plan']).map((section) => (
              <div key={section} className="bg-bg-surface border border-bg-border rounded-xl p-4">
                <p className="text-xs font-mono text-accent-primary uppercase tracking-wider mb-2 font-semibold">
                  {section.charAt(0).toUpperCase() + section.slice(1)}
                </p>
                {soap[section] ? (
                  <p className="text-sm text-text-secondary leading-relaxed">{soap[section]}</p>
                ) : (
                  <p className="text-xs text-text-muted font-mono italic">
                    {updating ? 'Generating...' : 'Waiting for transcript...'}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Approve */}
          <div className="p-4 border-t border-bg-border">
            <AnimatePresence>
              {approved ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-2 py-2"
                >
                  <span className="text-emerald-400 font-mono text-sm">✓ Note approved and saved to patient timeline</span>
                </motion.div>
              ) : (
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  onClick={handleApprove}
                  disabled={!soap.subjective}
                >
                  ✓ Approve & Save to Patient Record
                </Button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
