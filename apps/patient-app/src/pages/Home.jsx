import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { useVitalsWS } from '../hooks/useVitalsWS'
import { fetchPatient, fetchWhoopStatus, getWhoopConnectUrl, syncWhoop } from '../services/api'
import { DemoPanel } from '../components/demo/DemoPanel'
import { PatientCallModal } from '../components/voice/PatientCallModal'

const PATIENT_ID = 'john-mercer'

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

function MedRow({ name, dose, time, taken }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-bg-border last:border-b-0">
      <span className={clsx('w-5 h-5 rounded-full flex items-center justify-center text-xs', taken ? 'bg-accent-calm text-white' : 'border-2 border-bg-border')}>
        {taken ? '✓' : ''}
      </span>
      <div className="flex-1">
        <span className={clsx('font-ui text-sm', taken ? 'text-txt-secondary line-through' : 'text-txt-primary')}>{name} {dose}</span>
      </div>
      <span className="font-ui text-xs text-txt-muted">{time}</span>
    </div>
  )
}

export default function Home() {
  const [patient, setPatient] = useState(null)
  const [mood, setMood] = useState(null)
  const [showVoiceCall, setShowVoiceCall] = useState(false)
  const [showWearableOptions, setShowWearableOptions] = useState(false)
  const [wearableMessage, setWearableMessage] = useState('')
  const [whoopStatus, setWhoopStatus] = useState(null)
  const [whoopSyncing, setWhoopSyncing] = useState(false)
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'
  const navigate = useNavigate()
  const { vitals } = useVitalsWS(PATIENT_ID)

  useEffect(() => {
    fetchPatient(PATIENT_ID).then(setPatient).catch(() => {})
    fetchWhoopStatus(PATIENT_ID).then(setWhoopStatus).catch(() => {})
  }, [])

  useEffect(() => {
    const wearableError = searchParams.get('wearable_error')
    const whoopConnectedParam = searchParams.get('whoop')

    if (wearableError === 'whoop_not_ready') {
      setWearableMessage('WHOOP connection is not ready on this deployment yet. You can still use the app and connect later.')
    } else if (whoopConnectedParam === 'connected') {
      setWearableMessage('Your wearable was connected successfully.')
      fetchWhoopStatus(PATIENT_ID).then(setWhoopStatus).catch(() => {})
    }
  }, [searchParams])

  const hr = vitals?.heart_rate ? Math.round(vitals.heart_rate) : '—'
  const spo2 = vitals?.spo2 ? Math.round(vitals.spo2) : '—'
  const temp = vitals?.skin_temperature ? vitals.skin_temperature.toFixed(1) : '—'
  const sleep = vitals?.sleep_hours ? vitals.sleep_hours.toFixed(1) : '—'
  const steps = vitals?.steps_today ? Math.round(vitals.steps_today) : '—'
  const stepsGoal = 2000
  const stepsProgress = steps !== '—' ? Math.min(100, (steps / stepsGoal) * 100) : 0

  const hrStatus = hr !== '—' ? (hr > 100 ? 'warning' : 'ok') : 'muted'
  const spo2Status = spo2 !== '—' ? (spo2 < 95 ? 'warning' : 'ok') : 'muted'

  const dayNum = patient?.days_post_op || 8
  const recoveryProgress = Math.min(100, (dayNum / 30) * 100)

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
      const next = await syncWhoop(PATIENT_ID)
      setWhoopStatus(next)
    } catch (error) {
      console.error(error)
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
    </AnimatePresence>
    <div className="app-container pb-28">
      {/* Header */}
      <div className="bg-bg-surface px-5 pt-safe pt-8 pb-5 border-b border-bg-border">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl text-txt-primary">
              {greeting}, {patient?.name?.split(' ')[0] || 'John'} ☀️
            </h1>
            <p className="font-ui text-sm text-txt-secondary mt-1">Day {dayNum} of your recovery</p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs font-ui text-txt-muted mb-1.5">
            <span>Surgery</span>
            <span className="text-accent-primary font-medium">Day {dayNum} ← you are here</span>
            <span>30 days</span>
          </div>
          <div className="relative h-2 bg-bg-elevated rounded-full overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 h-full bg-accent-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${recoveryProgress}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            {[0, 7, 14, 30].map(day => (
              <div
                key={day}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-bg-surface border-2 border-accent-primary"
                style={{ left: `${(day / 30) * 100}%`, transform: 'translate(-50%, -50%)' }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {wearableMessage && (
          <motion.div
            className="bg-bg-surface rounded-2xl p-4 border border-bg-border shadow-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="font-ui text-sm text-txt-secondary">{wearableMessage}</p>
          </motion.div>
        )}

        {/* Mood Card */}
        <motion.div
          className="bg-bg-surface rounded-2xl p-4 border border-bg-border shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="font-display text-base text-txt-primary mb-3">How are you feeling today?</p>
          <div className="grid grid-cols-4 gap-2">
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
              3 of {meds.length}
            </span>
          </div>

          <div className="mt-2">
            {meds.map((med, i) => (
              <MedRow
                key={i}
                name={med.name}
                dose={med.dose}
                time={Array.isArray(med.time) ? med.time[0] : med.time}
                taken={i < 3}
              />
            ))}
          </div>

          <button className="mt-3 w-full font-ui text-sm font-medium text-accent-primary py-2.5 border border-accent-primary/30 rounded-xl hover:bg-accent-primary/5 transition-colors">
            Mark as Taken
          </button>
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
                <p className="font-ui text-sm text-white/75 mt-0.5">Speak about any pain or concerns</p>
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
