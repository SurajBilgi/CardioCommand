import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { useVitalsWS } from '../hooks/useVitalsWS'
import { fetchPatient } from '../services/api'
import { DemoPanel } from '../components/demo/DemoPanel'
import { PatientCallModal } from '../components/voice/PatientCallModal'
import WeeklyRecap from '../components/WeeklyRecap'

const PATIENT_ID = 'john-mercer'

// Demo: streak and rehab week
const REHAB_STREAK = 4
const REHAB_WEEK = 2
const SESSIONS_THIS_WEEK = 2
const SESSIONS_GOAL = 3

function VitalRow({ icon, label, value, unit, note, status = 'ok' }) {
  const noteColor = status === 'warning' ? 'text-amber-600' : status === 'ok' ? 'text-accent-calm' : 'text-txt-muted'
  return (
    <div className="flex items-start gap-3 py-3 border-b border-bg-border last:border-b-0">
      <span className="text-xl w-7 shrink-0">{icon}</span>
      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <span className="font-ui text-sm text-txt-secondary">{label}</span>
          <span className="font-ui font-semibold text-txt-primary tabular-nums">
            {value} <span className="text-txt-muted text-xs font-normal">{unit}</span>
          </span>
        </div>
        {note && <p className={clsx('text-xs font-ui mt-0.5', noteColor)}>{note}</p>}
      </div>
    </div>
  )
}

function MedRow({ name, dose, time, taken, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 py-2.5 border-b border-bg-border last:border-b-0 text-left active:bg-bg-elevated rounded-lg transition-colors"
    >
      <span className={clsx(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-all',
        taken ? 'bg-accent-calm text-white' : 'border-2 border-bg-border'
      )}>
        {taken ? '✓' : ''}
      </span>
      <div className="flex-1">
        <span className={clsx('font-ui text-sm', taken ? 'text-txt-secondary line-through' : 'text-txt-primary')}>{name} {dose}</span>
        {taken && <p className="font-ui text-xs text-txt-muted">Tap to undo</p>}
      </div>
      <span className="font-ui text-xs text-txt-muted">{time}</span>
    </button>
  )
}

function CelebrationOverlay({ onClose, onTalkToCora }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-bg-surface rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl"
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 18 }}
      >
        <div className="text-6xl mb-3">🎉</div>
        <h2 className="font-display text-2xl text-txt-primary mb-1">Amazing work!</h2>
        <p className="font-ui text-txt-secondary text-sm mb-2">
          You completed today's rehab session.
        </p>
        <div className="bg-accent-calm/10 rounded-2xl px-4 py-3 mb-4">
          <p className="font-ui text-accent-calm font-semibold text-lg">🔥 {REHAB_STREAK + 1}-day streak!</p>
          <p className="font-ui text-xs text-txt-secondary mt-0.5">That's your best streak yet, John!</p>
        </div>
        <p className="font-ui text-xs text-txt-muted mb-4">
          Cora noticed your heart rate stayed steady throughout — a great sign of progress.
        </p>
        <button
          onClick={onTalkToCora}
          className="w-full py-3 bg-accent-calm text-white rounded-xl font-ui font-semibold text-sm mb-2"
        >
          Talk to Cora about it 🎙️
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 font-ui text-sm text-txt-muted"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  )
}

// Fallback demo insurance for when patient data hasn't loaded yet
const DEMO_INSURANCE = {
  provider: 'Medicare',
  plan_name: 'Medicare Advantage — Blue Shield',
  member_id: '1EG4-TE5-MK72',
  group_number: 'GRP-00341',
  coverage_type: 'Primary',
  copay_office: '$20',
  copay_specialist: '$50',
  rehab_sessions_covered: 36,
  rehab_sessions_used: 4,
  deductible_met: true,
  customer_service: '1-800-633-4227',
  rx_bin: '610014',
  rx_pcn: 'PRVDR',
}

function InsuranceCard({ insurance }) {
  const [expanded, setExpanded] = useState(false)
  const ins = insurance || DEMO_INSURANCE
  const sessionsLeft = ins.rehab_sessions_covered - ins.rehab_sessions_used
  const sessionsProgress = Math.min(100, (ins.rehab_sessions_used / ins.rehab_sessions_covered) * 100)

  return (
    <motion.div
      className="rounded-2xl overflow-hidden border border-bg-border shadow-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.27 }}
    >
      {/* Card face — styled like a physical insurance card */}
      <div
        className="p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #2a5298 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/5" />
        <div className="absolute -right-2 -bottom-8 w-32 h-32 rounded-full bg-white/5" />

        <div className="flex items-start justify-between mb-3 relative">
          <div>
            <p className="font-ui text-xs text-white/60 uppercase tracking-wider">Insurance</p>
            <p className="font-display text-lg text-white font-bold leading-tight mt-0.5">{ins.provider}</p>
            <p className="font-ui text-xs text-white/70 mt-0.5">{ins.plan_name}</p>
          </div>
          <div className="bg-white/15 rounded-xl px-2.5 py-1.5 text-right">
            <p className="font-ui text-xs text-white/60">Coverage</p>
            <p className="font-ui text-xs font-bold text-white">{ins.coverage_type}</p>
          </div>
        </div>

        {/* Member ID — large, easy to read */}
        <div className="mb-3">
          <p className="font-ui text-xs text-white/50 uppercase tracking-widest">Member ID</p>
          <p className="font-mono text-xl font-bold text-white tracking-widest mt-0.5">{ins.member_id}</p>
        </div>

        {/* Rehab sessions coverage bar */}
        <div className="bg-white/10 rounded-xl p-3 relative">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-ui text-white/70">Cardiac Rehab Sessions</span>
            <span className="font-ui font-bold text-white">{ins.rehab_sessions_used}/{ins.rehab_sessions_covered}</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${sessionsProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <p className="font-ui text-xs text-emerald-300 mt-1.5 font-medium">
            {sessionsLeft} sessions remaining — covered by {ins.provider}
          </p>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setExpanded(o => !o)}
          className="mt-3 w-full font-ui text-xs text-white/60 text-center py-1 flex items-center justify-center gap-1"
        >
          {expanded ? '▲ Less details' : '▼ View full card details'}
        </button>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-bg-surface"
          >
            <div className="p-4 space-y-3">
              {/* Quick copay info */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-bg-elevated rounded-xl p-3 text-center">
                  <p className="font-ui text-xs text-txt-muted">Office Visit Copay</p>
                  <p className="font-display text-xl font-bold text-txt-primary mt-0.5">{ins.copay_office}</p>
                </div>
                <div className="bg-bg-elevated rounded-xl p-3 text-center">
                  <p className="font-ui text-xs text-txt-muted">Specialist Copay</p>
                  <p className="font-display text-xl font-bold text-txt-primary mt-0.5">{ins.copay_specialist}</p>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex gap-2 flex-wrap">
                <span className={clsx(
                  'font-ui text-xs px-3 py-1 rounded-full font-medium',
                  ins.deductible_met
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                )}>
                  {ins.deductible_met ? '✓ Deductible Met' : 'Deductible Not Met'}
                </span>
              </div>

              {/* ID details */}
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Group Number', value: ins.group_number },
                  { label: 'Rx BIN', value: ins.rx_bin },
                  { label: 'Rx PCN', value: ins.rx_pcn },
                ].map(row => (
                  <div key={row.label} className="flex justify-between border-b border-bg-border pb-2">
                    <span className="font-ui text-txt-muted text-xs">{row.label}</span>
                    <span className="font-mono text-txt-primary text-xs font-medium">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Customer service */}
              <a
                href={`tel:${ins.customer_service}`}
                className="flex items-center gap-3 bg-accent-primary/5 border border-accent-primary/20 rounded-xl p-3"
              >
                <span className="text-xl">📞</span>
                <div>
                  <p className="font-ui text-xs text-txt-muted">Customer Service</p>
                  <p className="font-ui text-sm font-semibold text-accent-primary">{ins.customer_service}</p>
                </div>
                <span className="ml-auto font-ui text-xs text-accent-primary">Call →</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Home() {
  const [patient, setPatient] = useState(null)
  const [mood, setMood] = useState(null)
  const [showVoiceCall, setShowVoiceCall] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)
  const [sessionDoneToday, setSessionDoneToday] = useState(false)
  const [showRecap, setShowRecap] = useState(false)
  const [takenMeds, setTakenMeds] = useState(new Set([0, 1, 2])) // first 3 taken by default (demo)
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'
  const navigate = useNavigate()
  const { vitals } = useVitalsWS(PATIENT_ID)

  useEffect(() => {
    fetchPatient(PATIENT_ID).then(setPatient).catch(() => {})
  }, [])

  // Session timer
  useEffect(() => {
    let interval
    if (sessionActive) {
      interval = setInterval(() => setSessionDuration(d => d + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [sessionActive])

  const hr = vitals?.heart_rate ? Math.round(vitals.heart_rate) : '—'
  const spo2 = vitals?.spo2 ? Math.round(vitals.spo2) : '—'
  const temp = vitals?.skin_temperature ? vitals.skin_temperature.toFixed(1) : '—'
  const sleep = vitals?.sleep_hours ? vitals.sleep_hours.toFixed(1) : '—'
  const steps = vitals?.steps_today ? Math.round(vitals.steps_today) : '—'
  const stepsGoal = 2000
  const stepsProgress = steps !== '—' ? Math.min(100, (steps / stepsGoal) * 100) : 0

  const hrStatus = hr !== '—' ? (hr > 100 ? 'warning' : 'ok') : 'muted'
  const spo2Status = spo2 !== '—' ? (spo2 < 95 ? 'warning' : 'ok') : 'muted'

  // Rehab progress (12-week journey)
  const rehabProgress = Math.min(100, (REHAB_WEEK / 12) * 100)

  const moods = [
    { emoji: '😊', label: 'Great' },
    { emoji: '😐', label: 'Okay' },
    { emoji: '😟', label: 'Not great' },
    { emoji: '😰', label: 'Scared' },
  ]

  const meds = patient?.medications?.slice(0, 5) || [
    { name: 'Metoprolol', dose: '25mg', time: ['08:00'] },
    { name: 'Lisinopril', dose: '10mg', time: ['08:00'] },
    { name: 'Aspirin', dose: '81mg', time: ['08:00'] },
    { name: 'Atorvastatin', dose: '40mg', time: ['21:00'] },
    { name: 'Furosemide', dose: '20mg', time: ['08:00'] },
  ]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleStartSession = () => {
    setSessionActive(true)
    setSessionDuration(0)
  }

  const handleEndSession = () => {
    setSessionActive(false)
    setSessionDoneToday(true)
    setShowCelebration(true)
  }

  const handleCelebrationClose = () => setShowCelebration(false)

  const handleTalkToCora = () => {
    setShowCelebration(false)
    setShowVoiceCall(true)
  }

  const toggleMed = (index) => {
    setTakenMeds(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const markAllTaken = () => {
    setTakenMeds(new Set(meds.map((_, i) => i)))
  }

  return (
    <>
    <AnimatePresence>
      {showVoiceCall && (
        <PatientCallModal
          patient={patient || { id: PATIENT_ID, name: 'John Mercer', surgery_type: 'CABG', days_post_op: 8 }}
          onClose={() => setShowVoiceCall(false)}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {showCelebration && (
        <CelebrationOverlay
          onClose={handleCelebrationClose}
          onTalkToCora={handleTalkToCora}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {showRecap && <WeeklyRecap onClose={() => setShowRecap(false)} />}
    </AnimatePresence>

    <div className="app-container pb-8">
      {/* Header */}
      <div className="bg-bg-surface px-5 pt-safe pt-8 pb-5 border-b border-bg-border">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl text-txt-primary">
              {greeting}, {patient?.name?.split(' ')[0] || 'John'} ☀️
            </h1>
            <p className="font-ui text-sm text-txt-secondary mt-1">Week {REHAB_WEEK} of your cardiac rehab</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Streak badge */}
            <div className="flex flex-col items-center bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
              <span className="text-lg leading-none">🔥</span>
              <span className="font-ui text-xs font-bold text-amber-600">{REHAB_STREAK}d</span>
            </div>
            {/* Voice call button */}
            <motion.button
              onClick={() => setShowVoiceCall(true)}
              whileTap={{ scale: 0.92 }}
              className="w-10 h-10 rounded-full bg-accent-calm flex items-center justify-center shadow-md relative"
              title="Talk to Cora"
            >
              <span className="text-white text-lg">🎙️</span>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-400 border-2 border-bg-surface animate-pulse" />
            </motion.button>
            {/* Chat button */}
            <button
              onClick={() => navigate('/chat')}
              className="w-10 h-10 rounded-full bg-accent-primary flex items-center justify-center shadow-md"
            >
              <span className="text-white text-lg">💬</span>
            </button>
          </div>
        </div>

        {/* 12-week Rehab Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-xs font-ui text-txt-muted mb-1.5">
            <span>Start</span>
            <span className="text-accent-primary font-medium">Week {REHAB_WEEK} ← you are here</span>
            <span>Week 12</span>
          </div>
          <div className="relative h-2 bg-bg-elevated rounded-full overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 h-full bg-accent-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${rehabProgress}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            {[0, 2, 4, 8, 12].map(week => (
              <div
                key={week}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-bg-surface border-2 border-accent-primary"
                style={{ left: `${(week / 12) * 100}%`, transform: 'translate(-50%, -50%)' }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs font-ui text-txt-muted">
              {SESSIONS_THIS_WEEK} of {SESSIONS_GOAL} sessions this week
            </p>
            <button
              onClick={() => navigate('/progress')}
              className="font-ui text-xs text-accent-primary font-semibold"
            >
              See full journey →
            </button>
          </div>
        </div>

        {/* Daily Win — 4 habits */}
        {(() => {
          const allMedsTaken = takenMeds.size === (patient?.medications?.length || 5)
          const coraUsed = false // demo default
          const habits = [
            { icon: '🏃', label: 'Session', done: sessionDoneToday },
            { icon: '💊', label: 'Meds',    done: allMedsTaken },
            { icon: '😊', label: 'Mood',    done: mood !== null },
            { icon: '💬', label: 'Cora',    done: coraUsed },
          ]
          const doneCount = habits.filter(h => h.done).length
          return (
            <div className="mt-3 bg-bg-elevated rounded-2xl px-3 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-ui text-xs font-semibold text-txt-secondary">Today's Daily Win</p>
                <span className={clsx(
                  'font-ui text-xs font-bold px-2 py-0.5 rounded-full',
                  doneCount === 4
                    ? 'bg-accent-calm/15 text-accent-calm'
                    : 'bg-bg-border text-txt-muted'
                )}>
                  {doneCount}/4 {doneCount === 4 ? '🎉' : ''}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {habits.map(h => (
                  <div key={h.label} className="flex flex-col items-center gap-1">
                    <div className={clsx(
                      'w-9 h-9 rounded-full flex items-center justify-center text-base border-2 transition-all',
                      h.done
                        ? 'bg-accent-calm border-accent-calm text-white shadow-sm'
                        : 'bg-bg-surface border-bg-border text-txt-muted'
                    )}>
                      {h.done ? '✓' : h.icon}
                    </div>
                    <span className="font-ui text-[9px] text-txt-muted">{h.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* TODAY'S SESSION CARD — "The Win" & "The Wall" demo moment */}
        <motion.div
          className={clsx(
            'rounded-2xl overflow-hidden border shadow-sm',
            sessionActive
              ? 'border-accent-calm bg-accent-calm/5'
              : 'border-bg-border bg-bg-surface'
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-display text-base text-txt-primary">
                  {sessionActive ? 'Session in Progress 🏃' : "Today's Rehab Session"}
                </p>
                <p className="font-ui text-xs text-txt-secondary mt-0.5">
                  {sessionActive
                    ? `Keep going! You're doing great — ${formatTime(sessionDuration)}`
                    : 'Prescribed: 20-min walk at moderate pace'}
                </p>
              </div>
              {sessionActive && (
                <div className="text-right">
                  <p className="font-ui text-2xl font-bold text-accent-calm tabular-nums">
                    {formatTime(sessionDuration)}
                  </p>
                  <p className="font-ui text-xs text-txt-muted">elapsed</p>
                </div>
              )}
            </div>

            {/* Live HR during session */}
            {sessionActive && (
              <motion.div
                className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2 mb-3 border border-accent-calm/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <span className="text-lg">❤️</span>
                <div className="flex-1">
                  <p className="font-ui text-xs text-txt-secondary">Live Heart Rate</p>
                  <p className="font-ui font-bold text-txt-primary">
                    {hr} <span className="font-normal text-xs">bpm</span>
                    <span className={clsx('ml-2 text-xs', hr !== '—' && hr > 100 ? 'text-amber-600' : 'text-accent-calm')}>
                      {hr !== '—' && hr > 110 ? '⚠ Elevated' : '✓ Good zone'}
                    </span>
                  </p>
                </div>
              </motion.div>
            )}

            <div className="flex gap-2">
              {!sessionActive ? (
                <>
                  <motion.button
                    onClick={handleStartSession}
                    whileTap={{ scale: 0.97 }}
                    className="flex-1 py-3 bg-accent-calm text-white rounded-xl font-ui font-semibold text-sm"
                  >
                    Start Walk 🚶
                  </motion.button>
                  <button
                    onClick={() => navigate('/chat')}
                    className="px-4 py-3 border border-bg-border rounded-xl font-ui text-sm text-txt-secondary"
                  >
                    Skip →
                  </button>
                </>
              ) : (
                <motion.button
                  onClick={handleEndSession}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-ui font-semibold text-sm"
                >
                  End Session ✓
                </motion.button>
              )}
            </div>

            {!sessionActive && (
              <p className="text-xs font-ui text-txt-muted text-center mt-2">
                Completed {SESSIONS_THIS_WEEK}/{SESSIONS_GOAL} sessions this week
              </p>
            )}
          </div>
        </motion.div>

        {/* Weekly Recap Card */}
        <motion.button
          onClick={() => setShowRecap(true)}
          className="w-full text-left rounded-2xl p-4 border border-accent-warm/40 shadow-sm"
          style={{ background: 'linear-gradient(135deg, rgba(240,160,80,0.06), rgba(240,160,80,0.14))' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-base text-txt-primary">Week {REHAB_WEEK} Recap Ready 📊</p>
              <p className="font-ui text-xs text-txt-secondary mt-0.5">
                See how your recovery is progressing · share with Sarah
              </p>
            </div>
            <span className="text-xl text-txt-muted ml-2">→</span>
          </div>
        </motion.button>

        {/* Mood Card */}
        <motion.div
          className="bg-bg-surface rounded-2xl p-4 border border-bg-border shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="font-display text-base text-txt-primary mb-3">How are you feeling today?</p>
          <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
            {moods.map(m => (
              <button
                key={m.emoji}
                onClick={() => { setMood(m.emoji); navigate('/chat') }}
                className={clsx(
                  'flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all border-2',
                  mood === m.emoji
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-transparent bg-bg-elevated hover:border-bg-border'
                )}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-xs font-ui text-txt-secondary">{m.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Vitals Card */}
        <motion.div
          className="bg-bg-surface rounded-2xl p-4 border border-bg-border shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <p className="font-display text-base text-txt-primary mb-1">Your Heart & Body</p>
          <p className="font-ui text-xs text-txt-muted mb-3">Live from your wearable</p>

          <VitalRow
            icon="❤️" label="Heart Rate" value={hr} unit="bpm"
            note={hr !== '—' && hr > 100 ? 'A little fast today' : 'In normal range'}
            status={hrStatus}
          />
          <VitalRow
            icon="🫁" label="Oxygen" value={spo2} unit="%"
            note={spo2 !== '—' && spo2 < 95 ? 'Lower than usual — try to rest' : 'Looking good'}
            status={spo2Status}
          />
          <VitalRow
            icon="🌡️" label="Temperature" value={temp} unit="°F"
            note="Slightly warm"
            status="muted"
          />
          <VitalRow
            icon="😴" label="Sleep Last Night" value={sleep} unit="hrs"
            note={sleep !== '—' && parseFloat(sleep) < 6 ? 'You need more rest' : 'Good sleep!'}
            status={sleep !== '—' && parseFloat(sleep) < 6 ? 'warning' : 'ok'}
          />

          {/* Steps Progress */}
          <div className="flex items-start gap-3 pt-3">
            <span className="text-xl w-7 shrink-0">🚶</span>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-ui text-txt-secondary">Steps Today</span>
                <span className="font-ui font-semibold text-txt-primary">{steps} <span className="text-txt-muted text-xs font-normal">/ {stepsGoal} goal</span></span>
              </div>
              <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent-calm rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${stepsProgress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs font-ui text-txt-muted mt-1">{Math.round(stepsProgress)}% of daily goal</p>
            </div>
          </div>
        </motion.div>

        {/* Medications Card */}
        <motion.div
          className="bg-bg-surface rounded-2xl p-4 border border-bg-border shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="font-display text-base text-txt-primary">Today's Medications</p>
            <span className="font-ui text-xs text-txt-secondary bg-bg-elevated px-2 py-0.5 rounded-full">
              {takenMeds.size} of {meds.length}
            </span>
          </div>

          <div className="mt-2">
            {meds.map((med, i) => (
              <MedRow
                key={i}
                name={med.name}
                dose={med.dose}
                time={Array.isArray(med.time) ? med.time[0] : med.time}
                taken={takenMeds.has(i)}
                onToggle={() => toggleMed(i)}
              />
            ))}
          </div>

          {takenMeds.size < meds.length && (
            <button
              onClick={markAllTaken}
              className="mt-3 w-full font-ui text-sm font-medium text-accent-primary py-2.5 border border-accent-primary/30 rounded-xl hover:bg-accent-primary/5 transition-colors"
            >
              Mark All as Taken
            </button>
          )}
          {takenMeds.size === meds.length && (
            <p className="mt-3 text-center font-ui text-sm text-accent-calm">
              ✓ All medications taken today!
            </p>
          )}
        </motion.div>

        {/* Next Appointment */}
        <motion.div
          className="bg-bg-surface rounded-2xl p-4 border border-bg-border shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xl">📅</span>
            </div>
            <div className="flex-1">
              <p className="font-display text-base text-txt-primary">Your Next Visit</p>
              <p className="font-ui text-sm text-txt-secondary mt-0.5">
                {patient?.attending || 'Dr. Kavitha Rao'}
              </p>
              <p className="font-ui text-sm font-semibold text-accent-primary mt-0.5">
                {patient?.next_appointment
                  ? new Date(patient.next_appointment).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Tomorrow · 2:00 PM'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/plan')}
            className="mt-3 w-full font-ui text-sm font-medium text-accent-primary py-2.5 border border-accent-primary/30 rounded-xl hover:bg-accent-primary/5 transition-colors"
          >
            What to Expect →
          </button>
        </motion.div>

        {/* Insurance Card */}
        <InsuranceCard insurance={patient?.insurance} />

        {/* Talk to Cora — voice call card */}
        <motion.div
          className="rounded-2xl overflow-hidden border border-bg-border shadow-sm"
          style={{ background: 'linear-gradient(135deg, #5A9E6F 0%, #4a8a5e 100%)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-display text-lg text-white">Talk to Cora</p>
                <p className="font-ui text-sm text-white/75 mt-0.5">Your cardiac rehab coach, 24/7</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-2xl">🎙️</span>
              </div>
            </div>
            <motion.button
              onClick={() => setShowVoiceCall(true)}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3 bg-white text-accent-calm rounded-xl font-ui font-semibold text-sm shadow-md hover:bg-white/95 transition-colors"
            >
              Start Voice Call →
            </motion.button>
          </div>
        </motion.div>

        {/* Quick Ask Cora */}
        <motion.div
          className="bg-bg-surface rounded-2xl p-4 border border-bg-border shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
        >
          <p className="font-display text-base text-txt-primary mb-3">Have a question?</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ask Cora anything..."
              className="flex-1 bg-bg-elevated border border-bg-border rounded-xl px-4 py-2.5 font-ui text-sm text-txt-primary placeholder-txt-muted outline-none focus:border-accent-primary/50"
              onKeyDown={e => e.key === 'Enter' && navigate('/chat')}
            />
            <button
              onClick={() => navigate('/chat')}
              className="px-4 py-2.5 bg-accent-primary text-white rounded-xl font-ui text-sm font-medium hover:bg-[#d4614a] transition-colors"
            >
              Ask →
            </button>
          </div>
        </motion.div>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-bg-surface border-t border-bg-border px-2 py-2 flex justify-around">
        {[
          { icon: '🏠', label: 'Home',    path: '/'         },
          { icon: '💬', label: 'Cora',    path: '/chat'     },
          { icon: '📊', label: 'Vitals',  path: '/vitals'   },
          { icon: '🏆', label: 'Journey', path: '/progress' },
          { icon: '📋', label: 'Plan',    path: '/plan'     },
        ].map(nav => (
          <button
            key={nav.path}
            onClick={() => navigate(nav.path)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg"
          >
            <span className="text-lg">{nav.icon}</span>
            <span className={clsx(
              'font-ui text-[10px]',
              nav.path === '/' ? 'text-accent-primary font-semibold' : 'text-txt-muted'
            )}>
              {nav.label}
            </span>
          </button>
        ))}
      </nav>

      {isDemo && <DemoPanel />}
    </div>
    </>
  )
}
