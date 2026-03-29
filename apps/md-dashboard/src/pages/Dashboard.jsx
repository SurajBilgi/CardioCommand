import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { fetchPatients, fetchTimeline, fetchVitalsHistory } from '../services/api'
import { useVitalsWS } from '../hooks/useVitalsWS'
import { useDemoStore } from '../store/demoStore'
import { VitalCard } from '../components/vitals/VitalCard'
import { VitalsChart } from '../components/vitals/VitalsChart'
import { AgentPanel } from '../components/agent/AgentPanel'
import { DemoPanel } from '../components/demo/DemoPanel'
import { PatientMap } from '../components/map/PatientMap'
import { Badge } from '../components/ui/Badge'
import { WS_BASE } from '../services/api'

const VITAL_METRICS = [
  'heart_rate', 'hrv', 'spo2', 'respiratory_rate', 'skin_temperature',
  'ecg_rhythm', 'afib_risk', 'steps_today', 'activity_level',
  'sleep_quality', 'sleep_hours', 'stress_index',
]

function alertVariant(alert) {
  if (!alert) return 'success'
  if (alert.type === 'critical') return 'critical'
  return 'warning'
}

function RiskBar({ score }) {
  const color = score >= 80 ? 'bg-red-500' : score >= 60 ? 'bg-amber-500' : score >= 35 ? 'bg-cyan-400' : 'bg-emerald-400'
  const label = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 35 ? 'MODERATE' : 'LOW'
  const badgeVariant = score >= 80 ? 'critical' : score >= 60 ? 'warning' : score >= 35 ? 'info' : 'success'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-3xl lg:text-4xl font-bold text-text-primary">{score}</span>
        <Badge variant={badgeVariant}>{label}</Badge>
      </div>
      <div className="w-full bg-bg-base rounded-full h-2">
        <motion.div
          className={clsx('h-2 rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function PatientCard({ patient, selected, onClick }) {
  const { vitals: liveVitals } = useVitalsWS(patient.id)
  const vitals = liveVitals || patient.current_vitals || {}
  const alert = vitals.alert || patient.alert

  const ringColor = alert?.type === 'critical'
    ? 'ring-red-500'
    : alert?.type === 'yellow'
    ? 'ring-amber-500'
    : 'ring-emerald-500'

  return (
    <motion.div
      layout
      onClick={onClick}
      className={clsx(
        'rounded-xl p-3 cursor-pointer transition-all duration-200 border',
        selected
          ? 'bg-bg-elevated border-accent-primary/50'
          : 'bg-bg-surface border-bg-border hover:border-bg-elevated',
        alert?.type === 'critical' && !selected && 'critical-card'
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold ring-2 shrink-0',
          ringColor,
          'bg-bg-base text-text-primary'
        )}>
          {patient.photo_initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-medium truncate">{patient.name}</span>
            {vitals.risk_score !== undefined && (
              <span className={clsx(
                'text-xs font-mono font-bold shrink-0',
                vitals.risk_score >= 80 ? 'text-red-400' : vitals.risk_score >= 60 ? 'text-amber-400' : 'text-emerald-400'
              )}>{vitals.risk_score}</span>
            )}
          </div>
          <p className="text-xs text-text-muted truncate">Day {patient.days_post_op} · {patient.surgery_type?.split(' ').slice(-1)[0]?.replace('(', '')?.replace(')', '')}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs font-mono text-text-secondary">
        {vitals.heart_rate && <span>❤️ {Math.round(vitals.heart_rate)}bpm</span>}
        {vitals.spo2 && <span>🫁 {Math.round(vitals.spo2)}%</span>}
      </div>
    </motion.div>
  )
}

export default function Dashboard() {
  const [patients, setPatients] = useState([])
  const [timeline, setTimeline] = useState([])
  const [vitalsHistory, setVitalsHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [mapOpen, setMapOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'
  const navigate = useNavigate()

  const { selectedPatientId, setSelectedPatient, setPatients: storeSetPatients, addAlert } = useDemoStore()
  const selectedPatient = patients.find(p => p.id === selectedPatientId) || patients[0]

  const { vitals: liveVitals, connected } = useVitalsWS(selectedPatientId)
  const currentVitals = liveVitals || selectedPatient?.current_vitals || {}

  // Alert WebSocket
  const alertWsRef = useRef(null)
  useEffect(() => {
    if (!selectedPatientId) return
    const ws = new WebSocket(`${WS_BASE}/vitals/alerts/stream/${selectedPatientId}`)
    alertWsRef.current = ws
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'alert') addAlert(data)
      } catch {}
    }
    return () => ws.close()
  }, [selectedPatientId, addAlert])

  useEffect(() => {
    fetchPatients()
      .then(data => {
        setPatients(data)
        storeSetPatients(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedPatientId) return
    fetchTimeline(selectedPatientId).then(setTimeline).catch(() => {})
    fetchVitalsHistory(selectedPatientId, 120).then(setVitalsHistory).catch(() => {})
  }, [selectedPatientId])

  const criticalCount = patients.filter(p => p.alert?.type === 'critical').length
  const atRiskCount = patients.filter(p => p.alert?.type === 'yellow').length

  const handleSelectPatient = (id) => {
    setSelectedPatient(id)
    setSidebarOpen(false) // close sidebar on mobile after selection
  }

  return (
    <div className="flex flex-col h-screen bg-bg-base overflow-hidden">
      {/* Top Nav */}
      <nav className="h-12 bg-bg-surface border-b border-bg-border px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* Hamburger for mobile/tablet */}
          <button
            className="lg:hidden p-1 text-text-muted hover:text-text-primary mr-1"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle patient list"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display text-base lg:text-lg font-bold text-text-primary tracking-tight">CardioCommand</span>
          <span className="text-red-400 text-base">❤️</span>
        </div>
        <div className="flex items-center gap-2 lg:gap-4">
          <div className="flex items-center gap-1.5">
            <span className="live-dot w-2 h-2 rounded-full bg-red-500 inline-block" />
            <span className="text-xs font-mono text-red-400">LIVE</span>
          </div>
          <Badge variant="muted" className="hidden sm:inline-flex">{patients.length} Patients</Badge>
          {criticalCount > 0 && <Badge variant="critical">{criticalCount} Critical</Badge>}
          <span className="text-xs text-text-muted font-mono hidden md:inline">Dr. Rao</span>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="fixed inset-0 bg-black/50 z-20 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar — hidden on mobile unless open, always visible lg+ */}
        <aside className={clsx(
          'w-64 bg-bg-surface border-r border-bg-border flex flex-col overflow-hidden shrink-0',
          'absolute lg:static z-30 lg:z-auto h-full',
          'transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}>
          <div className="p-3 border-b border-bg-border">
            <p className="text-xs font-mono text-text-muted uppercase tracking-widest mb-2">My Patients</p>
            <input
              type="text"
              placeholder="Search patients..."
              className="w-full bg-bg-base border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-muted font-mono outline-none focus:border-accent-primary/40"
            />
          </div>

          <div className="flex gap-1 p-2 border-b border-bg-border flex-wrap">
            {['All', '🔴 Critical', '🟡 At Risk', '📅 Pre-Visit'].map(f => (
              <button key={f} className="text-xs font-mono px-2 py-0.5 rounded bg-bg-base text-text-secondary hover:text-text-primary transition-colors">
                {f}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="text-center py-8 text-text-muted text-xs font-mono">Loading patients...</div>
            ) : (
              patients.map(p => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  selected={p.id === selectedPatientId}
                  onClick={() => handleSelectPatient(p.id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-4">

          {/* Live Location Map */}
          <div className="bg-bg-surface border border-bg-border rounded-xl overflow-hidden">
            <button
              onClick={() => setMapOpen(o => !o)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-elevated transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🗺️</span>
                <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Patient Locations</span>
                <span className="flex items-center gap-1 ml-2">
                  <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                  <span className="text-xs font-mono text-red-400">LIVE</span>
                </span>
              </div>
              <span className="text-text-muted text-xs font-mono">{mapOpen ? '▲ Collapse' : '▼ Expand'}</span>
            </button>

            {mapOpen && (
              <div className="h-48 md:h-64 lg:h-[320px]">
                <PatientMap
                  selectedPatientId={selectedPatientId}
                  onSelectPatient={setSelectedPatient}
                />
              </div>
            )}
          </div>

          {selectedPatient ? (
            <>
              {/* Alert Banner */}
              <AnimatePresence>
                {currentVitals.alert && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={clsx(
                      'rounded-xl p-3 flex items-start gap-3 border',
                      currentVitals.alert.type === 'critical'
                        ? 'bg-red-500/10 border-red-500/40'
                        : 'bg-amber-500/10 border-amber-500/30'
                    )}
                  >
                    <span className="text-lg shrink-0">{currentVitals.alert.type === 'critical' ? '🚨' : '⚠️'}</span>
                    <p className="text-sm text-text-primary">{currentVitals.alert.message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Patient Header + Risk Score — stacks on tablet */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
                <div className="md:col-span-2 bg-bg-surface border border-bg-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <h1 className="font-display text-xl lg:text-2xl font-bold text-text-primary truncate">{selectedPatient.name}</h1>
                      <p className="text-text-secondary text-xs lg:text-sm">
                        {selectedPatient.surgery_type} · Day {selectedPatient.days_post_op} Post-Op · EF: {selectedPatient.ejection_fraction}%
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-text-muted">Attending</p>
                      <p className="text-xs lg:text-sm text-text-secondary">{selectedPatient.attending}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {selectedPatient.comorbidities?.map(c => (
                      <Badge key={c} variant="warning">{c}</Badge>
                    ))}
                    {selectedPatient.next_appointment && (
                      <Badge variant="info">📅 {new Date(selectedPatient.next_appointment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Badge>
                    )}
                  </div>
                </div>

                <div className="bg-bg-surface border border-bg-border rounded-xl p-4">
                  <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">Risk Score</p>
                  <RiskBar score={currentVitals.risk_score || 0} />
                </div>
              </div>

              {/* Live Vitals Strip — 2 cols mobile, 3 tablet, 6 desktop */}
              <div>
                <p className="text-xs font-mono text-text-muted uppercase tracking-widest mb-2">Live Vitals</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {VITAL_METRICS.map(metric => (
                    <VitalCard
                      key={metric}
                      metric={metric}
                      value={currentVitals[metric]}
                    />
                  ))}
                </div>
              </div>

              {/* Trend Charts — 1 col mobile, 3 desktop */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <VitalsChart data={vitalsHistory} metrics={['heart_rate']} title="Heart Rate" height={80} />
                <VitalsChart data={vitalsHistory} metrics={['spo2']} title="SpO₂" height={80} />
                <VitalsChart data={vitalsHistory} metrics={['hrv']} title="HRV" height={80} />
              </div>

              {/* AI Panel + Timeline — stack on tablet, side-by-side on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* AI Panel */}
                <div className="lg:col-span-4 bg-bg-surface border border-bg-border rounded-xl p-4 flex flex-col">
                  <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-3">AI Actions</p>
                  <div className="flex-1">
                    <AgentPanel patient={selectedPatient} currentVitals={currentVitals} />
                  </div>
                </div>

                {/* Timeline */}
                <div className="lg:col-span-1 bg-bg-surface border border-bg-border rounded-xl overflow-hidden flex flex-col max-h-80 lg:max-h-none">
                  <div className="px-3 py-2 border-b border-bg-border">
                    <p className="text-xs font-mono text-text-muted uppercase tracking-wider">Timeline</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {timeline.map(event => (
                      <div key={event.id} className="flex gap-2">
                        <div className="flex flex-col items-center">
                          <span className="text-base">{event.icon}</span>
                          <div className="w-px flex-1 bg-bg-border mt-1" />
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className="text-xs font-mono text-text-muted">{event.day} — {event.time}</p>
                          <p className="text-xs font-medium text-text-secondary">{event.label}</p>
                          <p className="text-xs text-text-muted leading-relaxed break-words">{event.detail}</p>
                        </div>
                      </div>
                    ))}
                    {timeline.length === 0 && (
                      <p className="text-xs text-text-muted font-mono text-center py-4">No events yet</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-text-muted font-mono text-sm">
              {loading ? 'Loading...' : 'Select a patient from the sidebar'}
            </div>
          )}
        </main>
      </div>

      {isDemo && <DemoPanel />}
    </div>
  )
}
