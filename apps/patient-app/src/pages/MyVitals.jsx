import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { fetchVitalsHistory, fetchWhoopStatus } from '../services/api'
import {
  DEMO_VITAL_TRENDS,
  PATIENT_ID,
} from '../data/patientDemoData'

function VitalChart({ data, metric, label, unit, color, normalMin, normalMax, headline, trend }) {
  const chartData = data.slice(-60).map((d, i) => ({ index: i, value: d[metric] }))
  const trendColor = trend === 'up' ? '#D94040' : trend === 'down' ? '#5A9E6F' : '#F0A050'

  return (
    <motion.div
      className="bg-bg-surface rounded-2xl border border-bg-border p-4 shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between mb-1">
        <p className="font-display text-sm text-txt-primary">{label}</p>
        <span className="text-xs font-ui px-2 py-0.5 rounded-full" style={{ background: `${trendColor}20`, color: trendColor }}>
          {trend === 'up' ? '↑ Rising' : trend === 'down' ? '↓ Improving' : '→ Stable'}
        </span>
      </div>
      <p className="font-ui text-xs text-txt-secondary mb-3">{headline}</p>

      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D4" vertical={false} />
          <XAxis dataKey="index" hide />
          <YAxis
            tick={{ fill: '#B0A89F', fontSize: 9, fontFamily: 'DM Sans' }}
            tickLine={false}
            axisLine={false}
          />
          {normalMin && <ReferenceLine y={normalMin} stroke={color} strokeDasharray="4 4" strokeOpacity={0.3} />}
          {normalMax && <ReferenceLine y={normalMax} stroke={color} strokeDasharray="4 4" strokeOpacity={0.3} />}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
          <Tooltip
            contentStyle={{ background: '#FAF7F2', border: '1px solid #E8E0D4', borderRadius: '8px', fontSize: '11px', fontFamily: 'DM Sans' }}
            formatter={(v) => [`${typeof v === 'number' ? v.toFixed(1) : v} ${unit}`, label]}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

export default function MyVitals() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [whoopStatus, setWhoopStatus] = useState(null)

  useEffect(() => {
    fetchVitalsHistory(PATIENT_ID, 240).then(setHistory).catch(() => {})
    fetchWhoopStatus(PATIENT_ID).then(setWhoopStatus).catch(() => {})
  }, [])

  const whoopLatest = whoopStatus?.latest || {}
  const whoopConnected = Boolean(whoopStatus?.connected)

  return (
    <div className="app-container pb-24">
      <div className="bg-bg-surface border-b border-bg-border px-4 pt-safe pt-8 pb-4">
        <button onClick={() => navigate('/')} className="font-ui text-txt-secondary text-sm mb-2">← Back</button>
        <h1 className="font-display text-2xl text-txt-primary">My Vitals</h1>
        <p className="font-ui text-sm text-txt-secondary">Your health trends over the past week</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {whoopConnected && (
          <motion.div
            className="bg-bg-surface rounded-2xl border border-bg-border p-4 shadow-sm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="font-display text-sm text-txt-primary">Wearable Summary</p>
            <p className="font-ui text-xs text-txt-secondary mt-1">Latest synced wearable summary for your care team</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-bg-elevated rounded-xl p-3">
                <p className="font-ui text-xs text-txt-muted">Recovery</p>
                <p className="font-display text-lg text-txt-primary mt-1">{whoopLatest.recovery_score ?? '—'}%</p>
              </div>
              <div className="bg-bg-elevated rounded-xl p-3">
                <p className="font-ui text-xs text-txt-muted">Sleep</p>
                <p className="font-display text-lg text-txt-primary mt-1">{whoopLatest.sleep_hours ?? '—'} hrs</p>
              </div>
              <div className="bg-bg-elevated rounded-xl p-3">
                <p className="font-ui text-xs text-txt-muted">Resting HR</p>
                <p className="font-display text-lg text-txt-primary mt-1">{whoopLatest.resting_heart_rate ?? '—'} bpm</p>
              </div>
              <div className="bg-bg-elevated rounded-xl p-3">
                <p className="font-ui text-xs text-txt-muted">HRV</p>
                <p className="font-display text-lg text-txt-primary mt-1">{whoopLatest.hrv_ms ?? '—'} ms</p>
              </div>
            </div>
          </motion.div>
        )}

        {history.length > 0 ? (
          <>
            <VitalChart
              data={history}
              metric="heart_rate"
              label="Heart Rate"
              unit="bpm"
              color="#E8715A"
              normalMin={60}
              normalMax={100}
              headline={DEMO_VITAL_TRENDS.heartRate.headline}
              trend={DEMO_VITAL_TRENDS.heartRate.trend}
            />
            <VitalChart
              data={history}
              metric="spo2"
              label="Oxygen Level"
              unit="%"
              color="#5A9E6F"
              normalMin={95}
              normalMax={100}
              headline={DEMO_VITAL_TRENDS.oxygen.headline}
              trend={DEMO_VITAL_TRENDS.oxygen.trend}
            />
            <VitalChart
              data={history}
              metric="sleep_quality"
              label="Sleep Quality"
              unit="%"
              color="#7B6CF6"
              normalMin={60}
              normalMax={90}
              headline={DEMO_VITAL_TRENDS.sleep.headline}
              trend={DEMO_VITAL_TRENDS.sleep.trend}
            />
            <VitalChart
              data={history}
              metric="steps_today"
              label="Daily Steps"
              unit="steps"
              color="#F0A050"
              normalMin={1000}
              normalMax={5000}
              headline={DEMO_VITAL_TRENDS.steps.headline}
              trend={DEMO_VITAL_TRENDS.steps.trend}
            />
          </>
        ) : (
          <div className="text-center py-12">
            <p className="font-ui text-txt-muted text-sm">Loading your vitals data...</p>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-bg-surface border-t border-bg-border px-4 py-2 flex justify-around">
        {[
          { icon: '🏠', label: 'Home', path: '/' },
          { icon: '💬', label: 'Cora', path: '/chat' },
          { icon: '📊', label: 'My Vitals', path: '/vitals' },
          { icon: '📋', label: 'My Plan', path: '/plan' },
        ].map(nav => (
          <button key={nav.path} onClick={() => navigate(nav.path)} className="flex flex-col items-center gap-0.5 px-3 py-1">
            <span className="text-xl">{nav.icon}</span>
            <span className="font-ui text-xs text-txt-muted">{nav.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
