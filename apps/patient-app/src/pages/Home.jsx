import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { useVitalsWS } from '../hooks/useVitalsWS'
import { fetchPatient, fetchWhoopStatus, getWhoopConnectUrl, sendRehabCheckin, syncWhoop } from '../services/api'
import { DemoPanel } from '../components/demo/DemoPanel'
import {
  DEMO_INSURANCE,
  DEMO_PATIENT,
  PATIENT_ID,
  REHAB_PROGRAM,
  getGreeting,
} from '../data/patientDemoData'
import { StreakRewards } from '../components/streak/StreakRewards'
import { PatientCallModal } from '../components/voice/PatientCallModal'

function buildProgramLevels(programLength, currentStreak, bestStreak) {
  const levels = Array(programLength).fill(0)
  const currentStart = Math.max(0, programLength - currentStreak)
  const breakIndex = currentStart - 1
  const previousRunLength = Math.min(bestStreak, Math.max(breakIndex, 0))
  const previousRunStart = Math.max(0, breakIndex - previousRunLength)

  for (let index = 0; index < previousRunStart; index += 1) {
    levels[index] = [1, 3, 5].includes(index % 7) ? 2 : 0
  }

  for (let index = previousRunStart; index < breakIndex; index += 1) {
    levels[index] = index % 2 === 0 ? 3 : 2
  }

  if (breakIndex >= 0) {
    levels[breakIndex] = 0
  }

  for (let index = currentStart; index < programLength; index += 1) {
    levels[index] = 4
  }

  return levels
}

function buildStreakCalendar(year, currentStreak, rehabWeek, bestStreak) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const programLength = Math.max(rehabWeek * 7, currentStreak + bestStreak + 1)
  const rehabStart = new Date(today)
  rehabStart.setDate(rehabStart.getDate() - (programLength - 1))
  rehabStart.setHours(0, 0, 0, 0)
  const programLevels = buildProgramLevels(programLength, currentStreak, bestStreak)

  const firstDay = new Date(year, 0, 1)
  const start = new Date(firstDay)
  start.setDate(start.getDate() - start.getDay())

  const days = []
  const monthLabels = []
  const seenMonths = new Set()
  let cursor = new Date(start)
  let weekIndex = 0

  while (cursor <= today) {
    const date = new Date(cursor)
    const isInYear = date.getFullYear() === year
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`

    if (isInYear && !seenMonths.has(monthKey)) {
      monthLabels.push({
        label: date.toLocaleDateString('en-US', { month: 'short' }),
        weekIndex,
      })
      seenMonths.add(monthKey)
    }

    let level = -1
    if (isInYear) {
      if (date >= rehabStart && date <= today) {
        const programIndex = Math.round((date.getTime() - rehabStart.getTime()) / 86400000)
        level = programLevels[programIndex] ?? 0
      }
    }

    days.push({
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      level,
      weekIndex,
      dayIndex: date.getDay(),
    })

    cursor.setDate(cursor.getDate() + 1)
    if (cursor.getDay() === 0) weekIndex += 1
  }

  const weekCount = weekIndex + 1
  const weeks = Array.from({ length: weekCount }, () => Array(7).fill(null))

  days.forEach(day => {
    weeks[day.weekIndex][day.dayIndex] = day
  })

  const completedDays = days.filter(day => day.level >= 2).length
  const activeWeeks = weeks.filter(week => week.filter(day => day?.level >= 2).length >= 4).length

  return {
    weeks,
    monthLabels,
    completedDays,
    activeWeeks,
    programStartLabel: rehabStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

function StreakCalendarModal({ streak, onClose, calendar }) {
  const columnWidth = 14
  const gridWidth = calendar.weeks.length * columnWidth

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[30px] border border-bg-border bg-bg-surface shadow-[0_24px_48px_rgba(44,36,32,0.22)]"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 22 }}
      >
        <div className="px-5 pt-5 pb-5 border-b border-bg-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-primary/80">Recovery Streak</p>
              <h2 className="font-display text-[30px] leading-tight text-txt-primary mt-2">{streak} days in a row</h2>
              <p className="font-ui text-sm leading-6 text-txt-secondary mt-2">
                A simple year view of the days you stayed on track with rehab.
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 px-4 py-2 rounded-full bg-bg-elevated border border-bg-border font-ui text-sm font-semibold text-txt-primary"
            >
              Done
            </button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Current', value: `${streak}d` },
              { label: 'Best', value: `${REHAB_PROGRAM.bestStreak}d` },
              { label: 'Weeks On Track', value: `${calendar.activeWeeks}` },
            ].map(stat => (
              <div key={stat.label} className="rounded-[18px] border border-bg-border/70 bg-bg-elevated px-3 py-3 text-center">
                <p className="font-ui text-[11px] leading-4 text-txt-muted">{stat.label}</p>
                <p className="font-display text-xl leading-tight text-txt-primary mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <StreakRewards streak={streak} />

          <div className="rounded-[24px] border border-bg-border bg-bg-elevated p-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-ui text-sm font-semibold text-txt-primary">Year view</p>
                <p className="font-ui text-xs text-txt-secondary mt-1">
                  {calendar.completedDays} steady rehab days since {calendar.programStartLabel}.
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-bg-border bg-bg-surface px-3 py-1">
                <p className="font-ui text-[11px] font-medium text-txt-secondary">{new Date().getFullYear()}</p>
              </div>
            </div>

            <div className="rounded-[20px] border border-bg-border bg-bg-surface px-3 py-3">
              <div className="overflow-x-auto">
                <div className="min-w-max mx-auto" style={{ width: `${gridWidth}px` }}>
                  <div className="relative h-5 mb-3">
                    {calendar.monthLabels.map(label => (
                      <span
                        key={`${label.label}-${label.weekIndex}`}
                        className="absolute font-ui text-[11px] text-txt-muted"
                        style={{ left: `${label.weekIndex * columnWidth}px` }}
                      >
                        {label.label}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-1">
                    {calendar.weeks.map((week, index) => (
                      <div key={`week-${index}`} className="flex flex-col gap-1">
                        {week.map((day, dayIndex) => {
                          const tone = day?.level ?? -1
                          return (
                            <div
                              key={day?.key || `empty-${index}-${dayIndex}`}
                              title={day?.label}
                              className={clsx(
                                'w-[10px] h-[10px] rounded-[3px]',
                                tone === -1 && 'bg-transparent',
                                tone === 0 && 'bg-white border border-bg-border',
                                tone === 1 && 'bg-emerald-100',
                                tone === 2 && 'bg-emerald-300',
                                tone === 3 && 'bg-accent-calm',
                                tone === 4 && 'bg-emerald-700'
                              )}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-bg-border">
                <p className="font-ui text-xs text-txt-secondary">
                  Blank days are before rehab started.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-ui text-[11px] text-txt-muted">Less</span>
                  {['bg-white border border-bg-border', 'bg-emerald-100', 'bg-emerald-300', 'bg-accent-calm', 'bg-emerald-700'].map(tone => (
                    <span key={tone} className={clsx('w-3 h-3 rounded-[3px]', tone)} />
                  ))}
                  <span className="font-ui text-[11px] text-txt-muted">More</span>
                </div>
              </div>
            </div>

            <p className="font-ui text-xs leading-5 text-txt-secondary mt-3 px-1">
              Darker squares mean stronger consistency once your rehab plan began.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

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

function CelebrationOverlay({ onClose, onTalkToCora, streakDays }) {
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
          <p className="font-ui text-accent-calm font-semibold text-lg">🔥 {Math.max(1, streakDays)}-day streak!</p>
          <p className="font-ui text-xs text-txt-secondary mt-0.5">That is another steady step forward, John.</p>
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

function SkipReasonModal({ onClose, onSelectReason }) {
  const options = [
    'Too tired today',
    'Worried it is not safe',
    'Pain or discomfort',
    'No time today',
    'Just not feeling up to it',
  ]

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-mobile bg-bg-surface rounded-3xl border border-bg-border shadow-xl p-4"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-display text-xl text-txt-primary">What got in the way today?</p>
        <p className="font-ui text-sm text-txt-secondary mt-1 mb-3">Pick the one that feels closest. Cora will adjust your plan.</p>
        <div className="space-y-2">
          {options.map(option => (
            <button
              key={option}
              onClick={() => onSelectReason(option)}
              className="w-full text-left rounded-2xl border border-bg-border bg-bg-elevated px-4 py-3 font-ui text-sm text-txt-primary"
            >
              {option}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 font-ui text-sm text-txt-muted"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  )
}

async function readSseText(response) {
  const reader = response.body?.getReader()
  if (!reader) return { text: '', rehab: null }

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let rehab = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'token') fullText += event.content
        if (event.type === 'state') rehab = event.rehab
      } catch {}
    }
  }

  return { text: fullText.trim(), rehab }
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
  const [showWearableOptions, setShowWearableOptions] = useState(false)
  const [wearableMessage, setWearableMessage] = useState('')
  const [wearableMessageTone, setWearableMessageTone] = useState('neutral')
  const [whoopStatus, setWhoopStatus] = useState(null)
  const [whoopSyncing, setWhoopSyncing] = useState(false)
  const [showStreakCalendar, setShowStreakCalendar] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showSkipReasons, setShowSkipReasons] = useState(false)
  const [coachFeedback, setCoachFeedback] = useState('')
  const [rehabSubmitting, setRehabSubmitting] = useState(false)
  const [rehabState, setRehabState] = useState(null)
  const [takenMeds, setTakenMeds] = useState(new Set([0, 1, 2]))
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'
  const navigate = useNavigate()
  const { vitals } = useVitalsWS(PATIENT_ID)

  const refreshPatient = async () => {
    const nextPatient = await fetchPatient(PATIENT_ID)
    setPatient(nextPatient)
    setRehabState(nextPatient?.rehab || null)
    return nextPatient
  }

  useEffect(() => {
    refreshPatient().catch(() => {})
    fetchWhoopStatus(PATIENT_ID).then(setWhoopStatus).catch(() => {})
  }, [])

  useEffect(() => {
    const wearableError = searchParams.get('wearable_error')
    const wearableDetail = searchParams.get('wearable_detail')
    const whoopConnectedParam = searchParams.get('whoop')

    if (wearableError === 'whoop_not_ready') {
      setWearableMessage('WHOOP connection is not ready on this deployment yet. You can still use the app and connect later.')
      setWearableMessageTone('warning')
    } else if (wearableError) {
      setWearableMessage(wearableDetail || 'We could not connect your wearable yet. Please try again.')
      setWearableMessageTone('error')
    } else if (whoopConnectedParam === 'connected') {
      setWearableMessage('Your wearable was connected successfully.')
      setWearableMessageTone('success')
      fetchWhoopStatus(PATIENT_ID).then(setWhoopStatus).catch(() => {})
    }
  }, [searchParams])

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
  const patientProfile = patient || DEMO_PATIENT
  const activeRehab = rehabState || patient?.rehab || {}
  const totalRehabWeeks = REHAB_PROGRAM.totalWeeks || 12
  const rehabWeek = activeRehab.rehab_week ?? REHAB_PROGRAM.currentWeek
  const streakDays = activeRehab.streak_days ?? REHAB_PROGRAM.currentStreak
  const sessionsThisWeek = activeRehab.sessions_this_week ?? REHAB_PROGRAM.sessionsThisWeek
  const sessionsGoal = activeRehab.sessions_goal ?? REHAB_PROGRAM.sessionsGoal
  const rehabProgress = Math.min(100, (rehabWeek / totalRehabWeeks) * 100)
  const weeksRemaining = Math.max(totalRehabWeeks - rehabWeek, 0)

  const moods = [
    { emoji: '😊', label: 'Great' },
    { emoji: '😐', label: 'Okay' },
    { emoji: '😟', label: 'Not great' },
    { emoji: '😰', label: 'Scared' },
  ]

  const meds = patient?.medications?.slice(0, 5) || DEMO_PATIENT.medications.slice(0, 5)
  const greeting = getGreeting()
  const whoopLatest = whoopStatus?.latest || {}
  const whoopConnected = Boolean(whoopStatus?.connected)
  const whoopSleep = whoopLatest.sleep_hours ?? '—'
  const whoopRecovery = whoopLatest.recovery_score ?? '—'
  const whoopRhr = whoopLatest.resting_heart_rate ?? '—'
  const whoopConfigured = Boolean(whoopStatus?.configured)
  const whoopLastSync = whoopStatus?.last_sync_at
    ? new Date(whoopStatus.last_sync_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  async function handleWhoopSync() {
    try {
      setWhoopSyncing(true)
      setWearableMessage('')
      const next = await syncWhoop(PATIENT_ID)
      setWhoopStatus(next)
      setWearableMessage('Wearable synced successfully.')
      setWearableMessageTone('success')
    } catch (error) {
      console.error(error)
      setWearableMessage(error.message || 'WHOOP sync failed. Please try again.')
      setWearableMessageTone('error')
    } finally {
      setWhoopSyncing(false)
    }
  }

  function handleWhoopConnect() {
    setShowWearableOptions(false)
    window.location.assign(getWhoopConnectUrl(PATIENT_ID))
  }

  function handleAppleHealthConnect() {
    setShowWearableOptions(false)
    setWearableMessage('Apple Health connection needs a small iPhone companion app. For this demo, WHOOP is the live wearable path.')
    setWearableMessageTone('warning')
  }
  const streakCalendar = useMemo(
    () => buildStreakCalendar(new Date().getFullYear(), streakDays, rehabWeek, REHAB_PROGRAM.bestStreak),
    [rehabWeek, streakDays]
  )

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleStartSession = () => {
    setCoachFeedback('')
    setSessionActive(true)
    setSessionDuration(0)
  }

  const handleEndSession = async () => {
    setSessionActive(false)
    setRehabSubmitting(true)
    try {
      const response = await sendRehabCheckin({
        patientId: PATIENT_ID,
        patientProfile: patient || {},
        mode: 'win',
        sessionDuration,
        rehabWeek,
        streak: streakDays,
      })
      const result = await readSseText(response)
      setCoachFeedback(result.text)
      if (result.rehab) setRehabState(result.rehab)
      await refreshPatient()
      setShowCelebration(true)
    } catch (error) {
      console.error(error)
      setCoachFeedback("Amazing work. Even a short walk counts today.")
      setShowCelebration(true)
    } finally {
      setRehabSubmitting(false)
    }
  }

  const handleCelebrationClose = () => setShowCelebration(false)

  const handleTalkToCora = () => {
    setShowCelebration(false)
    setShowVoiceCall(true)
  }

  const handleSkipReason = async (reason) => {
    setShowSkipReasons(false)
    setRehabSubmitting(true)
    try {
      const response = await sendRehabCheckin({
        patientId: PATIENT_ID,
        patientProfile: patient || {},
        mode: 'wall',
        context: reason,
        barrierLabel: reason,
        rehabWeek,
        streak: streakDays,
      })
      const result = await readSseText(response)
      setCoachFeedback(result.text)
      if (result.rehab) setRehabState(result.rehab)
      await refreshPatient()
    } catch (error) {
      console.error(error)
      setCoachFeedback("That's okay — recovery is still happening. Let's take one very small step tomorrow.")
    } finally {
      setRehabSubmitting(false)
    }
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
          patient={patientProfile}
          onClose={() => setShowVoiceCall(false)}
        />
      )}
      {showWearableOptions && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowWearableOptions(false)}
        >
          <motion.div
            className="w-full max-w-mobile bg-bg-surface rounded-3xl border border-bg-border shadow-xl p-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-display text-xl text-txt-primary">Choose a wearable</p>
                <p className="font-ui text-sm text-txt-secondary mt-1">Keep this simple. Pick the device you already use.</p>
              </div>
              <button
                onClick={() => setShowWearableOptions(false)}
                className="w-8 h-8 rounded-full bg-bg-elevated text-txt-secondary"
              >
                ×
              </button>
            </div>

            <button
              onClick={handleWhoopConnect}
              className="w-full text-left rounded-2xl border border-bg-border bg-bg-elevated px-4 py-4 mb-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-base text-txt-primary">WHOOP</p>
                  <p className="font-ui text-sm text-txt-secondary mt-1">
                    {whoopConfigured ? 'Connect and sync your recovery, sleep, and heart data' : 'Ready in this app once the WHOOP credentials are added'}
                  </p>
                </div>
                <span className={clsx(
                  'font-ui text-xs px-2 py-1 rounded-full',
                  whoopConfigured ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-surface text-txt-muted'
                )}>
                  {whoopConfigured ? 'Connect' : 'Not ready'}
                </span>
              </div>
            </button>

            <button
              onClick={handleAppleHealthConnect}
              className="w-full text-left rounded-2xl border border-bg-border bg-bg-elevated px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-base text-txt-primary">Apple Health</p>
                  <p className="font-ui text-sm text-txt-secondary mt-1">
                    Best on iPhone with a small companion app bridge.
                  </p>
                </div>
                <span className="font-ui text-xs px-2 py-1 rounded-full bg-bg-surface text-txt-muted">Soon</span>
              </div>
            </button>
          </motion.div>
        </motion.div>
      )}
      {showCelebration && (
        <CelebrationOverlay
          onClose={handleCelebrationClose}
          onTalkToCora={handleTalkToCora}
          streakDays={streakDays}
        />
      )}
      {showSkipReasons && (
        <SkipReasonModal
          onClose={() => setShowSkipReasons(false)}
          onSelectReason={handleSkipReason}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {showStreakCalendar && (
        <StreakCalendarModal
          streak={streakDays}
          calendar={streakCalendar}
          onClose={() => setShowStreakCalendar(false)}
        />
      )}
    </AnimatePresence>

    <div className="app-container pb-28">
      {/* Header */}
      <div className="bg-bg-surface px-5 pt-safe pt-8 pb-5 border-b border-bg-border">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl text-txt-primary">
              {greeting}, {patientProfile.name.split(' ')[0]} ☀️
            </h1>
            <p className="font-ui text-sm text-txt-secondary mt-1">Week {rehabWeek} of your cardiac rehab</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Streak badge */}
            <button
              onClick={() => setShowStreakCalendar(true)}
              className="flex flex-col items-center bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 active:scale-95 transition-transform"
              title="View recovery streak"
            >
              <span className="text-lg leading-none">🔥</span>
              <span className="font-ui text-xs font-bold text-amber-600">{streakDays}d</span>
            </button>
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
        <div className="mt-5 rounded-[24px] border border-bg-border bg-bg-elevated/70 px-4 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base text-txt-primary">Recovery progress</p>
              <p className="font-ui text-sm text-txt-secondary mt-1">
                Week {rehabWeek} of {totalRehabWeeks} in your cardiac rehab plan
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-accent-primary/15 bg-bg-surface px-3 py-2 text-right">
              <p className="font-ui text-[11px] uppercase tracking-[0.14em] text-txt-muted">Plan done</p>
              <p className="font-display text-lg leading-tight text-accent-primary">{Math.round(rehabProgress)}%</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-ui font-medium text-txt-muted">
              <span>Start</span>
              <span>Midpoint</span>
              <span>Week {totalRehabWeeks}</span>
            </div>

            <div className="mt-2 h-4 rounded-full border border-bg-border/80 bg-bg-surface p-1">
              <motion.div
                className="h-full rounded-full bg-accent-primary"
                initial={{ width: 0 }}
                animate={{ width: `${rehabProgress}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-accent-primary/10 px-3 py-1.5 font-ui text-sm font-semibold text-accent-primary">
                You are in Week {rehabWeek}
              </span>
              <span className="font-ui text-sm text-txt-secondary">
                {sessionsThisWeek} of {sessionsGoal} sessions complete this week
              </span>
            </div>

            <p className="mt-2 font-ui text-xs text-txt-muted">
              {weeksRemaining > 0
                ? `${weeksRemaining} weeks left after this week. Slow, steady progress is exactly the goal.`
                : 'Final week. Keep the pace gentle and finish strong.'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {wearableMessage && (
          <motion.div
            className={clsx(
              'rounded-2xl p-4 border shadow-sm',
              wearableMessageTone === 'error' && 'bg-red-50 border-red-200',
              wearableMessageTone === 'warning' && 'bg-amber-50 border-amber-200',
              wearableMessageTone === 'success' && 'bg-emerald-50 border-emerald-200',
              wearableMessageTone === 'neutral' && 'bg-bg-surface border-bg-border'
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className={clsx(
              'font-ui text-sm',
              wearableMessageTone === 'error' && 'text-red-700',
              wearableMessageTone === 'warning' && 'text-amber-700',
              wearableMessageTone === 'success' && 'text-emerald-700',
              wearableMessageTone === 'neutral' && 'text-txt-secondary'
            )}>
              {wearableMessage}
            </p>
          </motion.div>
        )}

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
                    : `Prescribed: ${REHAB_PROGRAM.prescribedWalkMinutes}-min walk at moderate pace`}
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
                    className="flex-1 py-3 bg-accent-calm text-white rounded-xl font-ui font-semibold text-sm disabled:opacity-60"
                    disabled={rehabSubmitting}
                  >
                    Start Walk 🚶
                  </motion.button>
                  <button
                    onClick={() => setShowSkipReasons(true)}
                    className="px-4 py-3 border border-bg-border rounded-xl font-ui text-sm text-txt-secondary disabled:opacity-60"
                    disabled={rehabSubmitting}
                  >
                    Skip →
                  </button>
                </>
              ) : (
                <motion.button
                  onClick={handleEndSession}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-ui font-semibold text-sm disabled:opacity-60"
                  disabled={rehabSubmitting}
                >
                  {rehabSubmitting ? 'Saving...' : 'End Session ✓'}
                </motion.button>
              )}
            </div>

            {coachFeedback && (
              <div className="mt-3 bg-bg-elevated border border-bg-border rounded-xl p-3">
                <p className="font-display text-sm text-txt-primary">Cora says</p>
                <p className="font-ui text-sm text-txt-secondary mt-1">{coachFeedback}</p>
              </div>
            )}

            {!sessionActive && (
              <p className="text-xs font-ui text-txt-muted text-center mt-2">
                Completed {sessionsThisWeek}/{sessionsGoal} sessions this week
              </p>
            )}
          </div>
        </motion.div>

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
                {patientProfile.attending}
              </p>
              <p className="font-ui text-sm font-semibold text-accent-primary mt-0.5">
                {patientProfile.next_appointment
                  ? new Date(patientProfile.next_appointment).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
        <InsuranceCard insurance={patientProfile.insurance} />

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

        <motion.div
          className="bg-bg-surface rounded-2xl p-4 border border-bg-border shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base text-txt-primary">Connect Wearable</p>
              <p className="font-ui text-xs text-txt-muted mt-0.5">
                {whoopConnected
                  ? `Connected${whoopLastSync ? ` · Last synced ${whoopLastSync}` : ''}`
                  : 'Link your wearable to bring in your recovery, sleep, and heart data'}
              </p>
            </div>
            <span className={clsx(
              'font-ui text-xs px-2 py-1 rounded-full',
              whoopConnected ? 'bg-accent-calm/10 text-accent-calm' : 'bg-bg-elevated text-txt-secondary'
            )}>
              {whoopConnected ? 'Connected' : 'Optional'}
            </span>
          </div>

          {whoopConnected ? (
            <>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-bg-elevated rounded-xl p-3">
                  <p className="font-ui text-xs text-txt-muted">Recovery</p>
                  <p className="font-display text-xl text-txt-primary mt-1">{whoopRecovery}<span className="text-sm text-txt-secondary">%</span></p>
                </div>
                <div className="bg-bg-elevated rounded-xl p-3">
                  <p className="font-ui text-xs text-txt-muted">Sleep</p>
                  <p className="font-display text-xl text-txt-primary mt-1">{whoopSleep}<span className="text-sm text-txt-secondary"> hrs</span></p>
                </div>
                <div className="bg-bg-elevated rounded-xl p-3">
                  <p className="font-ui text-xs text-txt-muted">Resting HR</p>
                  <p className="font-display text-xl text-txt-primary mt-1">{whoopRhr}<span className="text-sm text-txt-secondary"> bpm</span></p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleWhoopSync}
                  disabled={whoopSyncing}
                  className="flex-1 font-ui text-sm font-medium text-white bg-accent-primary py-2.5 rounded-xl hover:bg-[#d4614a] transition-colors disabled:opacity-60"
                >
                  {whoopSyncing ? 'Syncing...' : 'Sync Wearable'}
                </button>
                <button
                  onClick={() => navigate('/vitals')}
                  className="flex-1 font-ui text-sm font-medium text-accent-primary py-2.5 border border-accent-primary/30 rounded-xl hover:bg-accent-primary/5 transition-colors"
                >
                  View Details
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowWearableOptions(true)}
              className="mt-3 w-full font-ui text-sm font-medium text-white bg-accent-primary py-3 rounded-xl hover:bg-[#d4614a] transition-colors"
            >
              Connect Wearable
            </button>
          )}
        </motion.div>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-bg-surface border-t border-bg-border px-4 py-2 flex justify-around">
        {[
          { icon: '🏠', label: 'Home', path: '/' },
          { icon: '💬', label: 'Cora', path: '/chat' },
          { icon: '📊', label: 'My Vitals', path: '/vitals' },
          { icon: '📋', label: 'My Plan', path: '/plan' },
        ].map(nav => (
          <button
            key={nav.path}
            onClick={() => navigate(nav.path)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg"
          >
            <span className="text-xl">{nav.icon}</span>
            <span className="font-ui text-xs text-txt-muted">{nav.label}</span>
          </button>
        ))}
      </nav>

      {isDemo && <DemoPanel />}
    </div>
    </>
  )
}
