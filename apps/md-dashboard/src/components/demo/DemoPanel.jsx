import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchScenarios, setScenario, triggerAlert, spikeVitals } from '../../services/api'
import { useDemoStore } from '../../store/demoStore'
import { Button } from '../ui/Button'

export function DemoPanel() {
  const [open, setOpen] = useState(false)
  const [scenarios, setScenarios] = useState([])
  const [selectedPatient, setSelectedPatient] = useState('john-mercer')
  const [selectedScenario, setSelectedScenario] = useState('early_warning')
  const [loading, setLoading] = useState(false)
  const { patients } = useDemoStore()

  useEffect(() => {
    fetchScenarios().then(setScenarios).catch(() => {})
  }, [])

  const applyScenario = async () => {
    setLoading(true)
    try {
      await setScenario(selectedPatient, selectedScenario)
    } finally {
      setLoading(false)
    }
  }

  const triggerCritical = async () => {
    await triggerAlert(selectedPatient, 'critical', 'CRITICAL: Atrial Fibrillation detected. Irregular rhythm persisting >2hrs. Immediate physician review required.')
  }

  const spikeHR = async () => {
    await spikeVitals(selectedPatient, 'heart_rate', 25)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mb-3 w-72 bg-bg-elevated border border-bg-border rounded-xl shadow-2xl shadow-black/50 p-4"
          >
            <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-3">🎭 Demo Controls</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Patient</label>
                <select
                  value={selectedPatient}
                  onChange={e => setSelectedPatient(e.target.value)}
                  className="w-full bg-bg-base border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary font-mono"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  {patients.length === 0 && (
                    <>
                      <option value="john-mercer">John Mercer</option>
                      <option value="rosa-delgado">Rosa Delgado</option>
                      <option value="marcus-webb">Marcus Webb</option>
                      <option value="sarah-kim">Sarah Kim</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs text-text-muted block mb-1">Scenario</label>
                <div className="space-y-1">
                  {scenarios.map(s => (
                    <label key={s.key} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="scenario"
                        value={s.key}
                        checked={selectedScenario === s.key}
                        onChange={() => setSelectedScenario(s.key)}
                        className="accent-accent-primary"
                      />
                      <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                        {s.label}
                        {s.has_alert && <span className="ml-1">{s.alert_type === 'critical' ? '🔴' : '🟡'}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button variant="primary" size="sm" onClick={applyScenario} disabled={loading} className="w-full justify-center">
                {loading ? 'Applying...' : '⚡ Apply Scenario'}
              </Button>

              <div className="border-t border-bg-border pt-2 space-y-1.5">
                <Button variant="danger" size="sm" onClick={triggerCritical} className="w-full justify-start">
                  🚨 Trigger Critical Alert
                </Button>
                <Button variant="warning" size="sm" onClick={spikeHR} className="w-full justify-start">
                  📡 Spike Heart Rate
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        className="bg-bg-elevated border border-bg-border rounded-full px-4 py-2 text-sm font-mono text-text-secondary hover:text-text-primary hover:border-accent-primary/40 transition-all shadow-lg"
      >
        🎭 Demo
      </motion.button>
    </div>
  )
}
