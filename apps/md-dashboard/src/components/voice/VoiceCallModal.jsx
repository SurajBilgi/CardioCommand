/**
 * VoiceCallModal — Vapi-powered voice call UI
 * =============================================
 * Modes:
 *   "vapi-browser" — Vapi Web SDK in-browser call (recommended, best quality)
 *   "vapi-phone"   — Vapi outbound phone call to patient's real number
 *   "basic"        — Web Speech API fallback (no Vapi key needed)
 *
 * Required env var (frontend): VITE_VAPI_PUBLIC_KEY
 * Required env var (backend):  VAPI_API_KEY, VAPI_PHONE_NUMBER_ID (phone calls only)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import Vapi from '@vapi-ai/web'
import { VoiceAgent, CALL_STATES, getStateLabel } from '../../services/voiceAgent'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || ''

// ── Severity / adherence helpers ──────────────────────────────────────────────

const SEV = {
  low:      { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'LOW RISK' },
  medium:   { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   label: 'MEDIUM RISK' },
  high:     { text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  label: 'HIGH RISK' },
  critical: { text: 'text-red-400',     bg: 'bg-red-500/15',     border: 'border-red-500/50',     label: 'CRITICAL' },
}

const ADH = {
  full:    { label: '✓ Full adherence',    color: 'text-emerald-400' },
  partial: { label: '⚠ Partial adherence', color: 'text-amber-400' },
  none:    { label: '✕ Non-adherent',      color: 'text-red-400' },
  unknown: { label: '— Unknown',           color: 'text-text-muted' },
}

// ── Waveform visualiser ───────────────────────────────────────────────────────

function Waveform({ active, volume = 0, color = '#00D4FF' }) {
  const bars = 20
  return (
    <div className="flex items-center gap-0.5" style={{ height: 32 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i / bars) * Math.PI * 2
        const baseH = 4
        const maxH = 28
        const h = active
          ? baseH + (maxH - baseH) * Math.abs(Math.sin(phase)) * (0.4 + volume * 0.6)
          : baseH
        return (
          <motion.div
            key={i}
            style={{ width: 2, borderRadius: 2, background: color }}
            animate={{ height: active ? [baseH, h, baseH] : baseH }}
            transition={
              active
                ? { duration: 0.5 + Math.random() * 0.3, delay: i * 0.03, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.2 }
            }
          />
        )
      })}
    </div>
  )
}

// ── Call timer ────────────────────────────────────────────────────────────────

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
  return <span className="font-mono text-sm tabular-nums text-text-muted">{mm}:{ss}</span>
}

// ── Transcript bubble ─────────────────────────────────────────────────────────

function Bubble({ entry }) {
  const isAgent = entry.speaker === 'agent'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: entry.interim ? 0.55 : 1, y: 0, scale: 1 }}
      className={clsx('flex gap-2 max-w-[85%]', isAgent ? 'self-start' : 'self-end flex-row-reverse')}
    >
      <div className={clsx(
        'w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-mono font-bold border mt-0.5',
        isAgent
          ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary'
          : 'bg-bg-elevated border-bg-border text-text-muted'
      )}>
        {isAgent ? 'C' : 'P'}
      </div>
      <div className={clsx(
        'rounded-2xl px-3 py-2 text-xs leading-relaxed',
        isAgent
          ? 'bg-bg-elevated border border-bg-border text-text-secondary rounded-tl-sm'
          : 'bg-accent-primary/12 border border-accent-primary/20 text-text-primary rounded-tr-sm',
        entry.interim && 'italic'
      )}>
        {entry.text}
        {entry.interim && <span className="ml-1 animate-pulse">…</span>}
      </div>
    </motion.div>
  )
}

// ── Post-call analysis ────────────────────────────────────────────────────────

function CallAnalysis({ analysis }) {
  if (!analysis) return null
  const sev = SEV[analysis.severity] || SEV.low
  const adh = ADH[analysis.medication_adherence] || ADH.unknown

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-text-muted uppercase tracking-wider">Post-Call Analysis</p>
        <span className="text-xs font-mono text-text-muted opacity-60">
          {analysis.generated_by === 'gpt4o' ? '⚡ GPT-4o' : '🔢 Rule-based'}
        </span>
      </div>

      <div className={clsx('rounded-xl p-4 border', sev.bg, sev.border)}>
        <div className="flex items-center justify-between mb-2">
          <span className={clsx('text-xs font-mono font-bold uppercase', sev.text)}>{sev.label}</span>
          {analysis.wellbeing_score != null && (
            <span className="text-xs font-mono">
              <span className="text-text-muted">Wellbeing </span>
              <span className="font-bold text-text-primary">{analysis.wellbeing_score}/10</span>
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">{analysis.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-bg-elevated rounded-xl p-3 border border-bg-border">
          <p className="text-xs font-mono text-text-muted mb-1">Medications</p>
          <p className={clsx('text-xs font-medium', adh.color)}>{adh.label}</p>
        </div>
        {analysis.mood_assessment && (
          <div className="bg-bg-elevated rounded-xl p-3 border border-bg-border">
            <p className="text-xs font-mono text-text-muted mb-1">Mood</p>
            <p className="text-xs text-text-secondary">{analysis.mood_assessment}</p>
          </div>
        )}
      </div>

      {analysis.flags?.length > 0 && (
        <div className="space-y-1.5">
          {analysis.flags.map((f, i) => (
            <div key={i} className="flex gap-2 bg-amber-500/8 border border-amber-500/25 rounded-lg px-3 py-2">
              <span className="text-amber-400 text-xs shrink-0 mt-0.5">⚠</span>
              <p className="text-xs text-amber-200 leading-relaxed">{f}</p>
            </div>
          ))}
        </div>
      )}

      {analysis.recommended_actions?.length > 0 && (
        <div className="bg-accent-primary/6 border border-accent-primary/20 rounded-xl p-3">
          <p className="text-xs font-mono text-accent-primary mb-2 uppercase">Recommended Actions</p>
          <ul className="space-y-1.5">
            {analysis.recommended_actions.map((a, i) => (
              <li key={i} className="flex gap-2 text-xs text-text-secondary">
                <span className="text-accent-primary shrink-0">›</span>{a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
}

// ── Mode selector button ──────────────────────────────────────────────────────

function ModeBtn({ id, active, icon, label, sub, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={clsx(
        'flex-1 rounded-xl p-3 text-left border transition-all',
        active
          ? 'bg-accent-primary/12 border-accent-primary/40'
          : 'bg-bg-base border-bg-border hover:border-bg-elevated'
      )}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span>{icon}</span>
        <span className={clsx('text-xs font-mono font-medium', active ? 'text-accent-primary' : 'text-text-secondary')}>
          {label}
        </span>
        {id === 'vapi-browser' && (
          <span className="text-xs bg-accent-primary/15 text-accent-primary border border-accent-primary/30 rounded px-1 font-mono">
            BEST
          </span>
        )}
      </div>
      <p className="text-xs text-text-muted leading-snug">{sub}</p>
    </button>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function VoiceCallModal({ patient, currentVitals, onClose }) {
  const [mode, setMode] = useState(VAPI_PUBLIC_KEY ? 'vapi-browser' : 'basic')
  const [callActive, setCallActive] = useState(false)
  const [callStatus, setCallStatus] = useState('idle')
  // idle | ringing | connected | agent-speaking | user-speaking | analyzing | complete | error
  const [transcript, setTranscript] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const [volume, setVolume] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState(null)
  const [script, setScript] = useState(null)
  const [twilioPhone, setTwilioPhone] = useState(patient?.phone || '')
  const [phoneCallId, setPhoneCallId] = useState(null)

  const vapiRef = useRef(null)
  const basicAgentRef = useRef(null)
  const transcriptRef = useRef([])
  const transcriptEndRef = useRef(null)
  const pollRef = useRef(null)
  const callDbIdRef = useRef(null)
  const callStartTimeRef = useRef(null)

  const isVapi = mode.startsWith('vapi')
  const isAgentSpeaking = callStatus === 'agent-speaking'
  const isUserSpeaking  = callStatus === 'user-speaking'
  const isSpeaking = isAgentSpeaking || isUserSpeaking

  // Auto-scroll transcript
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [transcript])

  // Fetch script from backend
  useEffect(() => {
    fetch(`${BASE_URL}/voice/script`).then(r => r.ok ? r.json() : null).catch(() => null).then(s => setScript(s))
  }, [])

  // Sync transcriptRef
  useEffect(() => { transcriptRef.current = transcript }, [transcript])

  const addTranscript = useCallback((entry) => {
    setTranscript(prev => {
      const last = prev[prev.length - 1]
      // Replace interim entry from same speaker
      if (entry.interim && last && last.speaker === entry.speaker && last.interim) {
        return [...prev.slice(0, -1), entry]
      }
      return [...prev, { ...entry, timestamp: new Date().toISOString() }]
    })
  }, [])

  // ── Register call start in DB ────────────────────────────────────────────────
  const registerCallStart = useCallback(async (callType) => {
    try {
      const r = await fetch(`${BASE_URL}/calls/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id:   patient?.id,
          patient_name: patient?.name,
          surgery_type: patient?.surgery_type,
          days_post_op: patient?.days_post_op,
          call_type:    callType,    // 'outbound' for doctor-initiated
          initiated_by: 'doctor',
        }),
      })
      const data = r.ok ? await r.json() : null
      if (data?.call_id) callDbIdRef.current = data.call_id
    } catch {}
  }, [patient])

  // ── Post-call analysis + DB save ─────────────────────────────────────────────
  const runAnalysis = useCallback(async (finalTranscript) => {
    setAnalysing(true)
    setCallStatus('analyzing')
    let analysisResult = null
    try {
      const r = await fetch(`${BASE_URL}/voice/analyze-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient, transcript: finalTranscript, current_vitals: currentVitals }),
      })
      analysisResult = r.ok ? await r.json() : null
    } catch {
      analysisResult = {
        summary: `Call completed with ${patient?.name}. ${finalTranscript.filter(t => t.speaker === 'patient').length} responses captured.`,
        severity: 'low', flags: [], recommended_actions: ['Review transcript with care team'],
        generated_by: 'fallback',
      }
    }
    setAnalysis(analysisResult)

    // Persist to DB
    if (callDbIdRef.current) {
      const duration = callStartTimeRef.current
        ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
        : null
      try {
        await fetch(`${BASE_URL}/calls/${callDbIdRef.current}/end`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: finalTranscript,
            analysis: analysisResult,
            status: 'completed',
            duration_seconds: duration,
          }),
        })
      } catch {}
    }

    setAnalysing(false)
    setCallStatus('complete')
    setCallActive(false)
  }, [patient, currentVitals])

  // ── Vapi: attach event listeners ────────────────────────────────────────────
  const attachVapiListeners = useCallback((vapi) => {
    vapi.on('call-start',  () => { setCallStatus('connected'); setCallActive(true); callStartTimeRef.current = Date.now() })

    vapi.on('call-end', () => {
      setCallActive(false)
      clearInterval(pollRef.current)
      runAnalysis(transcriptRef.current)
    })

    vapi.on('speech-start', () => setCallStatus('agent-speaking'))
    vapi.on('speech-end',   () => setCallStatus('connected'))

    vapi.on('volume-level', (v) => setVolume(v))

    vapi.on('message', (msg) => {
      if (msg.type === 'transcript') {
        addTranscript({
          speaker: msg.role === 'assistant' ? 'agent' : 'patient',
          text: msg.transcript,
          interim: msg.transcriptType === 'partial',
        })
        if (msg.role === 'user' && msg.transcriptType === 'partial') {
          setCallStatus('user-speaking')
        } else if (msg.role === 'assistant') {
          setCallStatus('agent-speaking')
        } else {
          setCallStatus('connected')
        }
      }
    })

    vapi.on('error', (err) => {
      setError(typeof err === 'string' ? err : err?.message || 'Vapi error')
      setCallStatus('error')
      setCallActive(false)
    })
  }, [addTranscript, runAnalysis])

  // ── START: Vapi browser call ─────────────────────────────────────────────────
  const startVapiBrowserCall = useCallback(async () => {
    if (!VAPI_PUBLIC_KEY) {
      setError('VITE_VAPI_PUBLIC_KEY not set in apps/md-dashboard/.env')
      return
    }
    setError(null)
    setTranscript([])
    setAnalysis(null)
    setCallStatus('ringing')
    await registerCallStart('outbound')

    try {
      // Fetch assistant config from backend (includes patient-specific system prompt)
      const r = await fetch(`${BASE_URL}/voice/vapi/assistant-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient }),
      })
      const { config } = r.ok ? await r.json() : { config: null }

      const vapi = new Vapi(VAPI_PUBLIC_KEY)
      vapiRef.current = vapi
      attachVapiListeners(vapi)

      if (config) {
        await vapi.start(config)
      } else {
        // Minimal inline config if backend is offline
        await vapi.start({
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            messages: [{
              role: 'system',
              content: `You are Cora, a warm AI health assistant calling ${patient?.name} for a post-surgery wellness check-in after their ${patient?.surgery_type}. Ask how they are feeling, about any symptoms, medications, activity, sleep, and any concerns. Be conversational and empathetic. Keep the call under 3 minutes.`,
            }],
          },
          voice: { provider: '11labs', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
          firstMessage: `Hi ${patient?.name}, this is Cora from your care team. I'm calling to check in on how you're doing. Do you have a couple of minutes?`,
        })
      }
    } catch (e) {
      setError(e.message || 'Failed to start Vapi call')
      setCallStatus('error')
    }
  }, [patient, attachVapiListeners, registerCallStart])

  // ── START: Vapi phone call ───────────────────────────────────────────────────
  const startVapiPhoneCall = useCallback(async () => {
    setError(null)
    setCallStatus('ringing')
    try {
      const r = await fetch(`${BASE_URL}/voice/vapi/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient, patient_phone: twilioPhone }),
      })
      const data = await r.json()
      if (!data.success) { setError(data.error); setCallStatus('error'); return }

      setPhoneCallId(data.call_id)
      setCallActive(true)
      setCallStatus('connected')

      // Poll for call completion every 5s
      pollRef.current = setInterval(async () => {
        const res = await fetch(`${BASE_URL}/voice/vapi/call/${data.call_id}`)
        const info = res.ok ? await res.json() : null
        if (info?.transcript?.length) setTranscript(info.transcript)
        if (info?.status === 'ended') {
          clearInterval(pollRef.current)
          runAnalysis(info.transcript || [])
        }
      }, 5000)
    } catch (e) {
      setError(e.message)
      setCallStatus('error')
    }
  }, [patient, twilioPhone, runAnalysis])

  // ── START: Basic Web Speech API fallback ─────────────────────────────────────
  const startBasicCall = useCallback(async () => {
    if (!script) return
    setError(null); setTranscript([]); setAnalysis(null)
    setCallActive(true); setCallStatus('ringing')
    callStartTimeRef.current = Date.now()
    await registerCallStart('outbound')

    const agent = new VoiceAgent({
      script, patient,
      onState:      (s) => setCallStatus(s === CALL_STATES.LISTENING ? 'user-speaking' : s === CALL_STATES.ASKING ? 'agent-speaking' : s),
      onTranscript: addTranscript,
      onComplete:   (t) => { setTranscript(t); runAnalysis(t) },
      onError:      (msg) => { setError(msg); setCallStatus('error'); setCallActive(false) },
    })
    basicAgentRef.current = agent
    agent.start()
  }, [script, patient, addTranscript, runAnalysis, registerCallStart])

  // ── END CALL ──────────────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    if (vapiRef.current) { vapiRef.current.stop(); vapiRef.current = null }
    if (basicAgentRef.current) basicAgentRef.current.endCall()
    clearInterval(pollRef.current)
    if (transcript.length > 0) runAnalysis(transcript)
    else { setCallActive(false); setCallStatus('complete') }
  }, [transcript, runAnalysis])

  // ── MUTE ──────────────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (vapiRef.current) { vapiRef.current.setMuted(!isMuted); setIsMuted(m => !m) }
  }, [isMuted])

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (vapiRef.current) vapiRef.current.stop()
    clearInterval(pollRef.current)
  }, [])

  const handleStart = () => {
    if (mode === 'vapi-browser') startVapiBrowserCall()
    else if (mode === 'vapi-phone') startVapiPhoneCall()
    else startBasicCall()
  }

  const handleReset = () => {
    setCallStatus('idle'); setTranscript([]); setAnalysis(null)
    setError(null); setCallActive(false); setPhoneCallId(null)
  }

  // ── Status display helpers ────────────────────────────────────────────────────
  const statusLabel = {
    idle:           null,
    ringing:        { text: 'Connecting…', color: 'text-text-muted' },
    connected:      { text: 'Connected',   color: 'text-emerald-400' },
    'agent-speaking': { text: 'Cora is speaking', color: 'text-accent-primary' },
    'user-speaking':  { text: 'Listening…',        color: 'text-red-400' },
    analyzing:      { text: 'Analysing call…', color: 'text-text-muted' },
    complete:       { text: 'Call complete',   color: 'text-emerald-400' },
    error:          { text: 'Error',           color: 'text-red-400' },
  }[callStatus]

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(7,13,26,0.94)', backdropFilter: 'blur(10px)' }}
      onClick={e => e.target === e.currentTarget && !callActive && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="bg-bg-surface border border-bg-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 80px rgba(0,212,255,0.07), 0 25px 50px rgba(0,0,0,0.5)' }}
      >

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-bg-border shrink-0">
          <div className="relative">
            <div className={clsx(
              'w-12 h-12 rounded-full border-2 flex items-center justify-center font-mono font-bold text-sm transition-colors',
              callActive ? 'border-accent-primary/60 text-accent-primary bg-accent-primary/10' : 'border-bg-border text-text-secondary bg-bg-elevated'
            )}>
              {patient?.photo_initials || '??'}
            </div>
            {callActive && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-bg-surface animate-pulse" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary truncate">{patient?.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {statusLabel && (
                <>
                  <span className={clsx('w-1.5 h-1.5 rounded-full', callActive ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted')} />
                  <span className={clsx('text-xs font-mono', statusLabel.color)}>{statusLabel.text}</span>
                </>
              )}
              {!statusLabel && (
                <span className="text-xs text-text-muted font-mono">
                  Day {patient?.days_post_op} post-op · {patient?.surgery_type?.split(' ').slice(-2).join(' ')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {callActive && <CallTimer running={callActive} />}
            {!callActive && callStatus !== 'complete' && (
              <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">✕</button>
            )}
          </div>
        </div>

        {/* ── Waveform visualiser (active call only) ─────────────────────────── */}
        <AnimatePresence>
          {callActive && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 56, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="flex items-center justify-center gap-8 px-5 border-b border-bg-border bg-bg-base shrink-0"
            >
              <div className="flex flex-col items-center gap-1">
                <Waveform active={isAgentSpeaking} volume={volume} color="#00D4FF" />
                <span className="text-xs font-mono text-accent-primary/60">CORA</span>
              </div>
              <div className={clsx(
                'w-2 h-2 rounded-full transition-colors',
                isUserSpeaking ? 'bg-red-400 animate-pulse' : 'bg-bg-border'
              )} />
              <div className="flex flex-col items-center gap-1">
                <Waveform active={isUserSpeaking} volume={volume * 0.7} color="#FF6B9D" />
                <span className="text-xs font-mono text-pink-400/60">PATIENT</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Mode selector (idle only) ──────────────────────────────────────── */}
        {callStatus === 'idle' && (
          <div className="px-5 pt-4 space-y-3 shrink-0">
            <div className="flex gap-2">
              <ModeBtn id="vapi-browser" active={mode === 'vapi-browser'} icon="🌐"
                label="Browser (Vapi)" sub="ElevenLabs voice · Deepgram STT · sub-1s latency"
                onClick={setMode} />
              <ModeBtn id="vapi-phone" active={mode === 'vapi-phone'} icon="📞"
                label="Phone Call" sub="Calls patient's real phone via Vapi"
                onClick={setMode} />
              <ModeBtn id="basic" active={mode === 'basic'} icon="🖥"
                label="Basic Demo" sub="Web Speech API · no Vapi key needed"
                onClick={setMode} />
            </div>

            {mode === 'vapi-browser' && !VAPI_PUBLIC_KEY && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-300 font-mono">
                  VITE_VAPI_PUBLIC_KEY not set in apps/md-dashboard/.env
                </p>
                <p className="text-xs text-amber-300/70 mt-1">
                  Get your public key from dashboard.vapi.ai → Account → API Keys
                </p>
              </div>
            )}

            {mode === 'vapi-phone' && (
              <div className="space-y-2">
                <label className="text-xs font-mono text-text-muted">Patient Phone Number</label>
                <input
                  type="tel" value={twilioPhone}
                  onChange={e => setTwilioPhone(e.target.value)}
                  placeholder="+1-555-0142"
                  className="w-full bg-bg-base border border-bg-border rounded-xl px-4 py-2.5 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-primary/40"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Transcript / Analysis area ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {callStatus === 'idle' ? (
            /* Script preview */
            <div className="space-y-2">
              <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-3">Questions Cora will ask</p>
              {(script?.questions || []).map((q, i) => (
                <div key={q.id} className="flex gap-3 group">
                  <span className="text-xs font-mono text-text-muted w-5 shrink-0 mt-0.5 group-hover:text-accent-primary transition-colors">{i + 1}</span>
                  <div>
                    <p className="text-xs font-mono text-accent-primary/70 mb-0.5">{q.category}</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{q.ask}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : callStatus === 'complete' || callStatus === 'analyzing' ? (
            analysing ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-text-muted font-mono">Analysing call with GPT-4o…</p>
              </div>
            ) : (
              <CallAnalysis analysis={analysis} />
            )
          ) : (
            /* Live transcript */
            <div className="flex flex-col gap-2">
              {transcript.length === 0 && (
                <p className="text-center text-xs text-text-muted font-mono py-6">
                  {callStatus === 'ringing' ? 'Connecting to Vapi…' : 'Waiting for conversation to start…'}
                </p>
              )}
              {transcript.map((entry, i) => <Bubble key={i} entry={entry} />)}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

        {/* ── Error banner ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="overflow-hidden shrink-0"
            >
              <div className="mx-5 mb-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
                <p className="text-xs text-red-400 leading-relaxed">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Controls ──────────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-bg-border shrink-0">
          {callStatus === 'idle' ? (
            <div className="flex gap-3">
              <button
                onClick={handleStart}
                className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/22 border border-emerald-500/40 text-emerald-400 rounded-xl py-3 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <span className="text-lg">📞</span>
                {mode === 'vapi-browser' ? 'Start Voice Call (Browser)' : mode === 'vapi-phone' ? 'Call Patient\'s Phone' : 'Start Basic Demo'}
              </button>
              <button onClick={onClose} className="px-4 text-text-muted hover:text-text-primary text-sm transition-colors">
                Cancel
              </button>
            </div>
          ) : callStatus === 'complete' ? (
            <div className="flex gap-3">
              <button onClick={handleReset}
                className="flex-1 bg-bg-elevated border border-bg-border text-text-secondary hover:text-text-primary rounded-xl py-3 text-sm transition-all">
                New Call
              </button>
              <button onClick={onClose}
                className="flex-1 bg-accent-primary/10 hover:bg-accent-primary/18 border border-accent-primary/30 text-accent-primary rounded-xl py-3 text-sm font-medium transition-all">
                Done
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {/* Mute button (Vapi only) */}
              {isVapi && (
                <button
                  onClick={toggleMute}
                  className={clsx(
                    'w-10 h-10 rounded-xl border flex items-center justify-center transition-all text-base',
                    isMuted
                      ? 'bg-red-500/15 border-red-500/40 text-red-400'
                      : 'bg-bg-elevated border-bg-border text-text-muted hover:text-text-secondary'
                  )}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? '🔇' : '🎙️'}
                </button>
              )}

              <div className="flex-1 flex items-center justify-center gap-2">
                <span className={clsx(
                  'w-2 h-2 rounded-full',
                  isUserSpeaking  ? 'bg-red-400 animate-pulse' :
                  isAgentSpeaking ? 'bg-accent-primary animate-pulse' :
                  callActive      ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'
                )} />
                <span className="text-xs font-mono text-text-muted">
                  {isUserSpeaking  ? 'Listening to patient…' :
                   isAgentSpeaking ? 'Cora is speaking…' :
                   callStatus === 'ringing' ? 'Connecting…' : 'Connected'}
                </span>
              </div>

              <button
                onClick={endCall}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500/12 hover:bg-red-500/22 border border-red-500/35 text-red-400 rounded-xl text-sm font-medium transition-all"
              >
                <span>📵</span> End
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
