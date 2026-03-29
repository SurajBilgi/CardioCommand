import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

const VITALS_META = {
  heart_rate:       { label: 'Heart Rate',    unit: 'bpm',   normal: [60, 100],   icon: '❤️' },
  hrv:              { label: 'HRV',           unit: 'ms',    normal: [20, 70],    icon: '📊' },
  spo2:             { label: 'SpO₂',          unit: '%',     normal: [95, 100],   icon: '🫁' },
  respiratory_rate: { label: 'Resp. Rate',    unit: 'brpm',  normal: [12, 20],    icon: '💨' },
  skin_temperature: { label: 'Skin Temp',     unit: '°F',    normal: [97.0, 99.5],icon: '🌡️' },
  ecg_rhythm:       { label: 'ECG Rhythm',    unit: '',      normal: null,        icon: '📈' },
  afib_risk:        { label: 'AFib Risk',     unit: '%',     normal: [0, 15],     icon: '⚡' },
  steps_today:      { label: 'Steps Today',   unit: 'steps', normal: [1000, 5000],icon: '🚶' },
  activity_level:   { label: 'Activity',      unit: '',      normal: null,        icon: '🏃' },
  sleep_quality:    { label: 'Sleep Quality', unit: '%',     normal: [60, 90],    icon: '😴' },
  sleep_hours:      { label: 'Sleep Duration',unit: 'hrs',   normal: [6, 9],      icon: '🌙' },
  stress_index:     { label: 'Stress Index',  unit: '/10',   normal: [1, 4],      icon: '🧠' },
}

function getStatus(metric, value) {
  const meta = VITALS_META[metric]
  if (!meta || !meta.normal || typeof value === 'string') return 'normal'

  const [min, max] = meta.normal
  if (metric === 'spo2' || metric === 'hrv' || metric === 'sleep_quality' || metric === 'sleep_hours') {
    if (value < min * 0.92) return 'critical'
    if (value < min) return 'warning'
  } else if (metric === 'afib_risk') {
    if (value > 70) return 'critical'
    if (value > 30) return 'warning'
  } else {
    if (value > max * 1.15 || value < min * 0.85) return 'critical'
    if (value > max || value < min) return 'warning'
  }
  return 'normal'
}

const statusColors = {
  normal: { text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400', border: 'border-bg-border' },
  warning: { text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400', border: 'border-amber-500/30' },
  critical: { text: 'text-red-400', badge: 'bg-red-500/10 text-red-400', border: 'border-red-500/40' },
}

const statusLabels = {
  normal: 'Normal',
  warning: 'Elevated',
  critical: 'Critical',
}

export function VitalCard({ metric, value, className }) {
  const meta = VITALS_META[metric] || { label: metric, unit: '', icon: '📊' }
  const status = getStatus(metric, value)
  const colors = statusColors[status]

  const isECG = metric === 'ecg_rhythm'
  const isAfib = metric === 'afib_risk'
  const isString = typeof value === 'string'

  return (
    <motion.div
      layout
      className={clsx(
        'bg-bg-surface border rounded-xl p-3 flex flex-col gap-1 min-w-[120px] relative overflow-hidden',
        colors.border,
        status === 'critical' && 'critical-card',
        className
      )}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Subtle glow for critical */}
      {status === 'critical' && (
        <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider truncate">
          {meta.label}
        </span>
        <span className="text-base">{meta.icon}</span>
      </div>

      {isECG ? (
        <div className="flex-1">
          <ECGWaveform status={status} />
          <p className={clsx('text-xs font-mono mt-1 truncate', colors.text)}>{value}</p>
        </div>
      ) : isAfib ? (
        <div className="flex items-center gap-2">
          <span className={clsx('font-mono text-2xl font-semibold tabular-nums', colors.text)}>
            {typeof value === 'number' ? Math.round(value) : value}
          </span>
          <span className="text-xs text-text-muted">{meta.unit}</span>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          <AnimatePresence mode="wait">
            <motion.span
              key={typeof value === 'number' ? Math.round(value) : value}
              className={clsx('font-mono text-2xl font-semibold tabular-nums leading-none', colors.text)}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {typeof value === 'number' ? (
                metric === 'skin_temperature' ? value.toFixed(1) : Math.round(value)
              ) : value}
            </motion.span>
          </AnimatePresence>
          {meta.unit && (
            <span className="text-xs text-text-muted mb-0.5">{meta.unit}</span>
          )}
        </div>
      )}

      {!isString && !isECG && (
        <span className={clsx('text-xs px-1.5 py-0.5 rounded-full self-start font-medium', colors.badge)}>
          {status === 'critical' ? '⚠️ ' : status === 'warning' ? '⚡ ' : '✓ '}{statusLabels[status]}
        </span>
      )}
    </motion.div>
  )
}

function ECGWaveform({ status }) {
  const color = status === 'critical' ? '#FF3B3B' : status === 'warning' ? '#FF9500' : '#00FF9D'
  return (
    <svg viewBox="0 0 120 30" className="w-full h-8" fill="none">
      <polyline
        className="ecg-line"
        points="0,15 15,15 20,5 25,25 30,15 45,15 50,2 55,28 60,15 75,15 80,5 85,25 90,15 105,15 110,10 115,15 120,15"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
