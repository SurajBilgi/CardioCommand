import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchScenarios, setScenario, triggerAlert } from '../../services/api'

const PATIENT_ID = 'john-mercer'

export function DemoPanel() {
  const [open, setOpen] = useState(false)
  const [scenarios, setScenarios] = useState([])
  const [selectedScenario, setSelectedScenario] = useState('early_warning')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchScenarios().then(setScenarios).catch(() => {})
  }, [])

  const applyScenario = async () => {
    setLoading(true)
    try { await setScenario(PATIENT_ID, selectedScenario) }
    finally { setLoading(false) }
  }

  const actions = [
    {
      label: '😟 Report Chest Soreness',
      onClick: () => triggerAlert(PATIENT_ID, 'yellow', 'Patient reported chest soreness via Cora app — mild, incisional in nature'),
    },
    {
      label: '💊 Miss a Medication',
      onClick: () => triggerAlert(PATIENT_ID, 'yellow', 'Medication non-adherence detected — evening Metoprolol dose missed'),
    },
    {
      label: '📡 Spike Heart Rate',
      onClick: () => setScenario(PATIENT_ID, 'afib_detected'),
    },
    {
      label: '😊 I Feel Great Today',
      onClick: () => setScenario(PATIENT_ID, 'full_recovery'),
    },
  ]

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mb-3 w-64 bg-white border border-bg-border rounded-2xl shadow-xl p-4"
          >
            <p className="text-xs font-ui font-medium text-txt-muted uppercase tracking-wider mb-3">🎭 Demo Controls</p>

            <div className="mb-3">
              <label className="text-xs text-txt-muted font-ui mb-1 block">Scenario</label>
              <select
                value={selectedScenario}
                onChange={e => setSelectedScenario(e.target.value)}
                className="w-full border border-bg-border rounded-lg px-2 py-1.5 text-xs font-ui text-txt-primary"
              >
                {scenarios.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={applyScenario}
                disabled={loading}
                className="mt-2 w-full bg-accent-primary text-white font-ui text-xs font-medium py-2 rounded-lg"
              >
                {loading ? 'Applying...' : '⚡ Apply Scenario'}
              </button>
            </div>

            <div className="space-y-1.5 border-t border-bg-border pt-2">
              {actions.map(a => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className="w-full text-left font-ui text-xs text-txt-secondary hover:text-txt-primary py-2 px-2 rounded-lg hover:bg-bg-elevated transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </div>

            <button
              onClick={async () => {
                await triggerAlert(PATIENT_ID, 'critical', 'Patient flagged urgent symptom via Cora — care team notified')
              }}
              className="mt-2 w-full border border-accent-primary/30 text-accent-primary font-ui text-xs font-medium py-2 rounded-lg"
            >
              → Sync Alert to MD App
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        className="bg-white border border-bg-border rounded-full px-4 py-2 text-sm font-ui text-txt-secondary shadow-md"
      >
        🎭 Demo
      </motion.button>
    </div>
  )
}
