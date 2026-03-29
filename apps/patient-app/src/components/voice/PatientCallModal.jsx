/**
 * PatientCallModal — Patient-facing Vapi voice call UI
 * ======================================================
 * Warm, simple, reassuring — designed for non-technical patients.
 * Patient talks to Cora about symptoms, pain, questions, or concerns.
 * Call is stored in the database and analysis sent to the care team.
 *
 * Required: VITE_VAPI_PUBLIC_KEY in apps/patient-app/.env
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import Vapi from '@vapi-ai/web'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || ''

// ── Pulse ring animation around avatar ───────────────────────────────────────

function PulseRing({ active, color = '#E8715A' }) {
  if (!active) return null
  return (
    <>
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: color }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1 + i * 0.25, opacity: 0 }}
          transition={{ duration: 1.8, delay: i * 0.4, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

// ── Waveform bars (speaking indicator) ────────────────────────────────────────

function WaveBars({ active, volume = 0, color = '#E8715A' }) {
  const bars = 12
  return (
    <div className="flex items-center justify-center gap-1" style={{ height: 28 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i / bars) * Math.PI
        const maxH = 22
        const minH = 3
        return (
          <motion.div
            key={i}
            style={{ width: 3, borderRadius: 3, background: color }}
            animate={active
              ? { height: [minH, minH + (maxH - minH) * (0.3 + Math.abs(Math.sin(phase)) * 0.7 * (0.5 + volume * 0.5)), minH] }
              : { height: minH }
            }
            transition={active
              ? { duration: 0.6 + i * 0.04, delay: i * 0.05, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.3 }
            }
          />
        )
      })}
    </div>
  )
}

// ── Call timer ─────────────────────────────────────────────────────────────────

function CallTimer({ running }) {
  const [secs, setSecs] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (running) { setSecs(0); ref.current = setInterval(() => setSecs(s => s + 1), 1000) }
    else clearInterval(ref.current)
    return () => clearInterval(ref.current)
  }, [running])
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  return <span className="font-mono text-2xl font-light text-txt-secondary tabular-nums">{mm}:{ss}</span>
}

// ── Post-call summary (simplified for patients) ────────────────────────────────

function CallSummary({ analysis, onClose }) {
  if (!analysis) return (
    <div className="text-center py-8">
      <p className="text-txt-secondary font-ui text-sm">Your care team has been notified.</p>
    </div>
  )

  const sev = analysis.severity || 'low'
  const isUrgent = sev === 'critical' || sev === 'high'

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Big reassuring icon */}
      <div className="text-center">
        <span className="text-5xl">{isUrgent ? '⚠️' : '✅'}</span>
        <p className="font-display text-lg text-txt-primary mt-2">
          {isUrgent ? "We're on it" : 'All noted!'}
        </p>
        <p className="font-ui text-sm text-txt-secondary mt-1">
          {isUrgent
            ? 'Your care team has been alerted and will contact you shortly.'
            : 'Your information has been sent to your care team.'}
        </p>
      </div>

      {/* Summary */}
      {analysis.summary && (
        <div className="bg-bg-elevated rounded-2xl p-4 border border-bg-border">
          <p className="font-ui text-xs text-txt-muted uppercase tracking-wider mb-2">What Cora Captured</p>
          <p className="font-ui text-sm text-txt-secondary leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Wellbeing */}
      {analysis.wellbeing_score != null && (
        <div className="flex items-center justify-between bg-bg-elevated rounded-2xl p-4 border border-bg-border">
          <span className="font-ui text-sm text-txt-secondary">How you said you feel</span>
          <span className="font-display text-2xl font-bold text-accent-primary">{analysis.wellbeing_score}<span className="text-sm font-normal text-txt-muted">/10</span></span>
        </div>
      )}

      {/* Flags in patient-friendly language */}
      {analysis.flags?.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-2">
          <p className="font-ui text-xs text-amber-700 uppercase tracking-wider">Things we're flagging for your doctor</p>
          {analysis.flags.map((f, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-amber-500 shrink-0">•</span>
              <p className="font-ui text-sm text-amber-800">{f.replace(/⚠️\s?/g, '')}</p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-4 bg-accent-primary text-white rounded-2xl font-ui font-medium text-base hover:bg-[#d4614a] transition-colors"
      >
        Done
      </button>
    </motion.div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function PatientCallModal({ patient, onClose }) {
  const [phase, setPhase] = useState('idle')
  // idle | connecting | active | ending | analyzing | done | error
  const [isMuted, setIsMuted] = useState(false)
  const [agentSpeaking, setAgentSpeaking] = useState(false)
  const [userSpeaking, setUserSpeaking] = useState(false)
  const [volume, setVolume] = useState(0)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)
  const [callDbId, setCallDbId] = useState(null)

  const vapiRef = useRef(null)
  const transcriptRef = useRef([])
  const startTimeRef = useRef(null)

  const patientName = patient?.name?.split(' ')[0] || 'there'

  // ── Register call start in DB ──────────────────────────────────────────────
  const registerCallStart = useCallback(async () => {
    try {
      const r = await fetch(`${BASE_URL}/calls/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id:   patient?.id || 'unknown',
          patient_name: patient?.name,
          surgery_type: patient?.surgery_type,
          days_post_op: patient?.days_post_op,
          call_type:    'inbound',
          initiated_by: 'patient',
        }),
      })
      const data = r.ok ? await r.json() : null
      if (data?.call_id) setCallDbId(data.call_id)
      return data?.call_id
    } catch { return null }
  }, [patient])

  // ── Run post-call analysis and save to DB ──────────────────────────────────
  const finishCall = useCallback(async (transcript) => {
    setPhase('analyzing')

    let analysisResult = null
    try {
      const r = await fetch(`${BASE_URL}/voice/analyze-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient, transcript }),
      })
      analysisResult = r.ok ? await r.json() : null
    } catch {}

    // Save to DB
    if (callDbId) {
      const duration = startTimeRef.current
        ? Math.round((Date.now() - startTimeRef.current) / 1000)
        : null
      try {
        await fetch(`${BASE_URL}/calls/${callDbId}/end`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            analysis: analysisResult,
            status: 'completed',
            duration_seconds: duration,
          }),
        })
      } catch {}
    }

    setAnalysis(analysisResult)
    setPhase('done')
  }, [patient, callDbId])

  // ── Start Vapi call ────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (!VAPI_PUBLIC_KEY) {
      setError('Voice calls require VITE_VAPI_PUBLIC_KEY to be set.\nContact your care team for support.')
      return
    }

    setPhase('connecting')
    const dbId = await registerCallStart()

    let config = null
    try {
      const r = await fetch(`${BASE_URL}/voice/vapi/assistant-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient, mode: 'inbound' }),
      })
      const data = r.ok ? await r.json() : null
      config = data?.config
    } catch {}

    const vapi = new Vapi(VAPI_PUBLIC_KEY)
    vapiRef.current = vapi

    vapi.on('call-start', () => {
      setPhase('active')
      startTimeRef.current = Date.now()
    })

    vapi.on('call-end', () => {
      finishCall(transcriptRef.current)
    })

    vapi.on('speech-start', () => setAgentSpeaking(true))
    vapi.on('speech-end',   () => setAgentSpeaking(false))
    vapi.on('volume-level', v => { setVolume(v); if (v > 0.05) setUserSpeaking(true); else setUserSpeaking(false) })

    vapi.on('message', msg => {
      if (msg.type === 'transcript') {
        const entry = {
          speaker:   msg.role === 'assistant' ? 'agent' : 'patient',
          text:      msg.transcript,
          interim:   msg.transcriptType === 'partial',
          timestamp: new Date().toISOString(),
        }
        if (msg.transcriptType === 'final') {
          transcriptRef.current = [...transcriptRef.current, entry]
        }
      }
    })

    vapi.on('error', e => {
      setError(typeof e === 'string' ? e : e?.message || 'Something went wrong. Please try again.')
      setPhase('error')
    })

    try {
      await vapi.start(config || {
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          messages: [{
            role: 'system',
            content: `You are Cora, a warm AI health assistant. ${patient?.name} is calling you after their ${patient?.surgery_type}. Listen carefully, be empathetic, and note any symptoms or concerns to share with their care team.`,
          }],
        },
        voice: { provider: '11labs', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
        firstMessage: `Hi ${patientName}, I'm so glad you called. How are you doing today — what's on your mind?`,
      })
    } catch (e) {
      setError(e.message || 'Could not connect. Please try again.')
      setPhase('error')
    }
  }, [patient, patientName, registerCallStart, finishCall])

  const endCall = useCallback(() => {
    if (vapiRef.current) { vapiRef.current.stop(); vapiRef.current = null }
    setPhase('ending')
    setTimeout(() => finishCall(transcriptRef.current), 500)
  }, [finishCall])

  const toggleMute = useCallback(() => {
    if (vapiRef.current) { vapiRef.current.setMuted(!isMuted); setIsMuted(m => !m) }
  }, [isMuted])

  useEffect(() => () => { if (vapiRef.current) vapiRef.current.stop() }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  const isActive = phase === 'active'
  const isConnecting = phase === 'connecting'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#FAF7F2' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-8 pb-4">
        {(phase === 'idle' || phase === 'error') && (
          <button onClick={onClose} className="text-txt-muted text-sm font-ui">← Back</button>
        )}
        {(phase === 'done') && <div />}
        {(phase === 'active' || phase === 'connecting') && <div />}
        {isActive && <CallTimer running={isActive} />}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 w-full">
            <div className="w-24 h-24 rounded-full bg-accent-primary/10 border-2 border-accent-primary/30 flex items-center justify-center mx-auto">
              <span className="text-4xl">🎙️</span>
            </div>
            <div>
              <h2 className="font-display text-2xl text-txt-primary">Talk to Cora</h2>
              <p className="font-ui text-sm text-txt-secondary mt-2 leading-relaxed">
                Feeling unwell, in pain, or have questions about your recovery?<br/>
                Cora is here to listen — your care team will see everything you share.
              </p>
            </div>
            <div className="space-y-2 text-left bg-bg-surface rounded-2xl p-4 border border-bg-border">
              {[
                ['💬', 'Tell Cora how you\'re feeling'],
                ['🩺', 'Describe any pain or symptoms'],
                ['💊', 'Ask about your medications'],
                ['😟', 'Share any worries or questions'],
              ].map(([icon, text]) => (
                <div key={text} className="flex gap-3 items-center">
                  <span>{icon}</span>
                  <p className="font-ui text-sm text-txt-secondary">{text}</p>
                </div>
              ))}
            </div>
            {!VAPI_PUBLIC_KEY && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="font-ui text-xs text-amber-700">Voice calls require VITE_VAPI_PUBLIC_KEY to be configured.</p>
              </div>
            )}
            <button
              onClick={startCall}
              disabled={!VAPI_PUBLIC_KEY}
              className="w-full py-4 bg-accent-primary text-white rounded-2xl font-ui font-semibold text-lg shadow-lg shadow-accent-primary/25 hover:bg-[#d4614a] transition-all disabled:opacity-40"
            >
              Start Call with Cora
            </button>
          </motion.div>
        )}

        {/* ── CONNECTING ── */}
        {isConnecting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="w-28 h-28 rounded-full bg-accent-primary/10 border-2 border-accent-primary/20 flex items-center justify-center mx-auto">
              <span className="text-5xl">🤍</span>
            </div>
            <div>
              <p className="font-display text-xl text-txt-primary">Connecting…</p>
              <p className="font-ui text-sm text-txt-muted mt-1">Getting Cora ready for you</p>
            </div>
            <div className="flex gap-1.5 justify-center">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-accent-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, delay: i * 0.25, repeat: Infinity }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── ACTIVE CALL ── */}
        {isActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 w-full">
            {/* Avatar with pulse rings */}
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              <PulseRing active={agentSpeaking} color="#E8715A" />
              <div className="relative z-10 w-32 h-32 rounded-full bg-accent-primary/10 border-3 border-accent-primary/40 flex items-center justify-center"
                style={{ borderWidth: 3 }}>
                <span className="text-5xl">🤍</span>
              </div>
            </div>

            <div>
              <p className="font-display text-2xl text-txt-primary">
                {agentSpeaking ? 'Cora is speaking…' : userSpeaking ? 'Listening…' : 'Connected'}
              </p>
              <p className="font-ui text-sm text-txt-muted mt-1">
                {agentSpeaking ? 'Tap the mic to interrupt' : 'Speak when you\'re ready'}
              </p>
            </div>

            <div className="flex justify-center">
              <WaveBars
                active={agentSpeaking || (userSpeaking && volume > 0.05)}
                volume={volume}
                color={agentSpeaking ? '#E8715A' : '#5A9E6F'}
              />
            </div>

            {/* Reassuring note */}
            <div className="bg-bg-surface rounded-2xl p-4 border border-bg-border">
              <p className="font-ui text-sm text-txt-secondary leading-relaxed">
                🔒 This conversation is private and goes directly to your care team.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── ANALYZING ── */}
        {(phase === 'analyzing' || phase === 'ending') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="w-24 h-24 rounded-full bg-accent-primary/10 border-2 border-accent-primary/20 flex items-center justify-center mx-auto">
              <motion.span className="text-4xl"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}>
                📋
              </motion.span>
            </div>
            <div>
              <p className="font-display text-xl text-txt-primary">Sending to your care team…</p>
              <p className="font-ui text-sm text-txt-muted mt-1">This just takes a moment</p>
            </div>
          </motion.div>
        )}

        {/* ── DONE ── */}
        {phase === 'done' && (
          <div className="w-full">
            <CallSummary analysis={analysis} onClose={onClose} />
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 w-full">
            <span className="text-5xl">😕</span>
            <div>
              <p className="font-display text-xl text-txt-primary">Couldn't connect</p>
              <p className="font-ui text-sm text-txt-secondary mt-2 leading-relaxed">{error}</p>
            </div>
            <button onClick={() => setPhase('idle')}
              className="w-full py-3 border-2 border-accent-primary text-accent-primary rounded-2xl font-ui font-medium">
              Try again
            </button>
            <button onClick={onClose} className="w-full py-3 text-txt-muted font-ui text-sm">
              Go back
            </button>
          </motion.div>
        )}
      </div>

      {/* ── Bottom controls (active call only) ─────────────────────────────── */}
      {isActive && (
        <div className="px-8 pb-safe pb-10">
          <div className="flex items-center justify-center gap-8">
            {/* Mute */}
            <button onClick={toggleMute}
              className={clsx(
                'w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all border-2',
                isMuted
                  ? 'bg-red-50 border-red-300 text-red-500'
                  : 'bg-bg-surface border-bg-border text-txt-secondary'
              )}
            >
              {isMuted ? '🔇' : '🎙️'}
            </button>

            {/* End Call — big red button */}
            <button
              onClick={endCall}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center text-white text-3xl shadow-xl shadow-red-500/30 hover:bg-red-600 transition-all active:scale-95"
            >
              📵
            </button>

            {/* Spacer for symmetry */}
            <div className="w-14 h-14" />
          </div>
          <p className="text-center font-ui text-xs text-txt-muted mt-4">Tap the red button to end the call</p>
        </div>
      )}
    </motion.div>
  )
}
