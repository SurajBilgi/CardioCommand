import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchPatients } from '../services/api'
import { useVitalsWS } from '../hooks/useVitalsWS'
import { PatientMap } from '../components/map/PatientMap'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'

function PatientRow({ patient, index }) {
  const { vitals: liveVitals } = useVitalsWS(patient.id)
  const vitals = liveVitals || patient.current_vitals || {}
  const score = vitals.risk_score || 0
  const alert = vitals.alert

  const riskBadge = score >= 80 ? 'critical' : score >= 60 ? 'warning' : score >= 35 ? 'info' : 'success'
  const riskEmoji = score >= 80 ? '🔴' : score >= 60 ? '🟡' : '🟢'

  const rowBg = score >= 80
    ? 'bg-red-500/5 hover:bg-red-500/10'
    : score >= 60
    ? 'bg-amber-500/5 hover:bg-amber-500/10'
    : 'hover:bg-bg-elevated'

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={clsx('border-b border-bg-border transition-colors', rowBg)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-bg-elevated border border-bg-border flex items-center justify-center text-xs font-mono font-bold text-text-secondary">
            {patient.photo_initials}
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{patient.name}</p>
            <p className="text-xs text-text-muted">Age {patient.age}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-mono text-text-secondary">
        {patient.surgery_type?.split('(')[0]?.trim()}
      </td>
      <td className="px-4 py-3 text-xs font-mono text-text-secondary">Day {patient.days_post_op}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span>{riskEmoji}</span>
          <Badge variant={riskBadge}>{score}</Badge>
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-mono">
        <span className={vitals.heart_rate > 100 ? 'text-amber-400' : 'text-emerald-400'}>
          {vitals.heart_rate ? Math.round(vitals.heart_rate) : '—'} bpm
        </span>
      </td>
      <td className="px-4 py-3 text-xs font-mono">
        <span className={vitals.spo2 < 95 ? 'text-amber-400' : 'text-emerald-400'}>
          {vitals.spo2 ? Math.round(vitals.spo2) : '—'}%
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-text-muted font-mono">2h ago</td>
      <td className="px-4 py-3">
        {score >= 80 ? (
          <Button size="sm" variant="danger">🚨 Urgent</Button>
        ) : score >= 60 ? (
          <Button size="sm" variant="warning">📞 Outreach</Button>
        ) : score >= 35 ? (
          <Button size="sm" variant="secondary">📋 Pre-Visit</Button>
        ) : (
          <Badge variant="success">✓ Stable</Badge>
        )}
      </td>
    </motion.tr>
  )
}

export default function WarRoom() {
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchPatients().then(setPatients).catch(() => {})
  }, [])

  const criticalCount = patients.filter(p => (p.risk_score || 0) >= 80).length
  const highRiskCount = patients.filter(p => (p.risk_score || 0) >= 60).length
  const savings = 98000

  const donutData = [
    { name: 'Critical', value: patients.filter(p => (p.risk_score || 0) >= 80).length, color: '#FF3B3B' },
    { name: 'High Risk', value: patients.filter(p => (p.risk_score || 0) >= 60 && (p.risk_score || 0) < 80).length, color: '#FF9500' },
    { name: 'Moderate', value: patients.filter(p => (p.risk_score || 0) >= 35 && (p.risk_score || 0) < 60).length, color: '#00D4FF' },
    { name: 'Stable', value: patients.filter(p => (p.risk_score || 0) < 35).length, color: '#00FF9D' },
  ].filter(d => d.value > 0)

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
        <span className="font-display text-base font-bold text-text-primary">War Room</span>
        <span className="text-text-muted text-xs font-mono">Population Risk Overview</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="live-dot w-2 h-2 rounded-full bg-red-500 inline-block" />
          <span className="text-xs font-mono text-red-400">LIVE</span>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active Patients', value: patients.length, icon: '👥', sub: 'Under monitoring' },
            { label: 'Require Action', value: highRiskCount, icon: '🚨', sub: `${criticalCount} critical, ${highRiskCount - criticalCount} high`, variant: highRiskCount > 0 ? 'red' : 'green' },
            { label: 'Predicted Savings', value: `$${savings.toLocaleString()}`, icon: '💰', sub: 'Avoided readmission cost', variant: 'green' },
          ].map(stat => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-bg-surface border border-bg-border rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-mono text-text-muted uppercase tracking-wider">{stat.label}</p>
                <span className="text-2xl">{stat.icon}</span>
              </div>
              <p className={clsx(
                'font-display text-3xl font-bold mb-1',
                stat.variant === 'red' ? 'text-red-400' : stat.variant === 'green' ? 'text-emerald-400' : 'text-text-primary'
              )}>{stat.value}</p>
              <p className="text-xs text-text-muted">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Donut Chart */}
        <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
          <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-4">Risk Distribution</p>
          <div className="flex items-center gap-8">
            <ResponsiveContainer width={200} height={160}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={1000}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0D1629', border: '1px solid #1E2D4A', borderRadius: '8px', fontSize: '11px', fontFamily: 'DM Mono' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {donutData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                  <span className="text-sm text-text-secondary">{d.name}</span>
                  <span className="font-mono text-sm text-text-primary ml-1">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Location Map */}
        <div className="bg-bg-surface border border-bg-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-bg-border flex items-center gap-2">
            <span className="text-base">🗺️</span>
            <p className="text-xs font-mono text-text-muted uppercase tracking-wider">Live Patient Locations</p>
            <span className="flex items-center gap-1 ml-2">
              <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              <span className="text-xs font-mono text-red-400">LIVE</span>
            </span>
          </div>
          <div style={{ height: 420 }}>
            <PatientMap
              selectedPatientId={selectedPatientId}
              onSelectPatient={setSelectedPatientId}
            />
          </div>
        </div>

        {/* Patient Table */}
        <div className="bg-bg-surface border border-bg-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-bg-border">
            <p className="text-xs font-mono text-text-muted uppercase tracking-wider">All Patients</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bg-border">
                  {['Patient', 'Surgery', 'Day', 'Risk', 'HR', 'SpO₂', 'Last Contact', 'Action'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-mono text-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((patient, i) => (
                  <PatientRow key={patient.id} patient={patient} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
