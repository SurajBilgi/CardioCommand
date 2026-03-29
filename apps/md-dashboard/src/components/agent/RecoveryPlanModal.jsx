import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { VoiceCallModal } from '../voice/VoiceCallModal'
import { fetchRecoveryPlan, saveRecoveryPlan } from '../../services/api'

export function RecoveryPlanModal({ patient, currentVitals, onClose }) {
  const [doctorPlan, setDoctorPlan] = useState('')
  const [phoneNumber, setPhoneNumber] = useState(patient.phone || '')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedPlanId, setSavedPlanId] = useState(null)
  const [showVoiceCall, setShowVoiceCall] = useState(false)

  useEffect(() => {
    let active = true

    async function loadExistingPlan() {
      setLoadingExisting(true)
      setPhoneNumber(patient.phone || '')
      const existing = await fetchRecoveryPlan(patient.id)
      if (!active || !existing) {
        setLoadingExisting(false)
        return
      }

      setDoctorPlan(existing.doctor_plan || '')
      setGeneratedPrompt(existing.generated_prompt || '')
      setSavedPlanId(existing.id || null)
      setLoadingExisting(false)
    }

    loadExistingPlan()
    return () => {
      active = false
    }
  }, [patient.id])

  const handleGenerate = async ({ startCall = false } = {}) => {
    if (!doctorPlan.trim()) {
      setError('Add the doctor recovery plan before generating the patient coaching prompt.')
      return
    }
    if (startCall && !phoneNumber.trim()) {
      setError('Enter the phone number you want Vapi to call.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const saved = await saveRecoveryPlan(
        patient.id,
        patient,
        currentVitals,
        doctorPlan.trim(),
      )

      setGeneratedPrompt(saved.generated_prompt || '')
      setSavedPlanId(saved.id || null)
      if (startCall) {
        setShowVoiceCall(true)
      }
    } catch (err) {
      const detail = err?.response?.data?.detail
      const message = err?.message === 'Network Error'
        ? 'Cannot reach the backend API. Start the backend server, then try Generate + Call again.'
        : err?.message
      setError(detail || message || 'Unable to save the recovery plan right now.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {showVoiceCall && (
        <AnimatePresence>
          <VoiceCallModal
            patient={patient}
            currentVitals={currentVitals}
            outreachScript={generatedPrompt}
            initialPhone={phoneNumber}
            defaultMode="vapi-phone"
            autoStart
            onCallSent={onClose}
            onClose={() => setShowVoiceCall(false)}
          />
        </AnimatePresence>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(7,13,26,0.94)', backdropFilter: 'blur(10px)' }}
        onClick={e => e.target === e.currentTarget && !saving && onClose()}
      >
        <motion.div
          initial={{ scale: 0.96, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 20 }}
          className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-bg-border bg-bg-surface shadow-2xl flex flex-col"
          style={{ boxShadow: '0 0 80px rgba(0,212,255,0.06), 0 25px 50px rgba(0,0,0,0.5)' }}
        >
          <div className="px-5 py-4 border-b border-bg-border flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="info">Recovery Plan</Badge>
                {savedPlanId && <Badge variant="success">Saved</Badge>}
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Build {patient.name}&apos;s recovery coaching call</h2>
              <p className="text-sm text-text-secondary mt-1">
                Write the doctor-facing plan, enter the phone number, then let Cora turn it into engaging patient missions and place the call.
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
              disabled={saving}
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 grid gap-5 lg:grid-cols-[1.05fr,0.95fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-bg-border bg-bg-base p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-text-muted">Doctor Instructions</p>
                    <p className="text-sm text-text-secondary mt-1">
                      Enter the clinical recovery plan in plain text for now.
                    </p>
                  </div>
                  <div className="text-right text-xs font-mono text-text-muted">
                    <p>{patient.phone || 'No phone on file'}</p>
                    <p>Patient call target</p>
                  </div>
                </div>

                <textarea
                  value={doctorPlan}
                  onChange={e => setDoctorPlan(e.target.value)}
                  placeholder={'Example: Walk 10 minutes twice a day, continue incentive spirometer, check for ankle swelling, and take medications on schedule.'}
                  className="w-full min-h-[220px] rounded-xl border border-bg-border bg-bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-primary/40 resize-y"
                />

                <div className="grid gap-3 md:grid-cols-[1fr,auto] md:items-end">
                  <label className="block">
                    <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Phone Number To Call</span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="+1-555-0142"
                      className="mt-2 w-full rounded-xl border border-bg-border bg-bg-surface px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-primary/40"
                    />
                  </label>

                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3">
                    <p className="text-xs font-mono uppercase tracking-wider text-cyan-300">Outbound Target</p>
                    <p className="text-sm text-text-secondary mt-1">{phoneNumber || 'Enter a number to place the Vapi call'}</p>
                  </div>
                </div>

                <p className="text-xs text-text-muted">
                  The phone number is used only for this doctor-initiated outbound Vapi call. The patient app is unchanged.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-bg-border bg-bg-base p-4 min-h-[420px] flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-text-muted">Patient-Facing Prompt</p>
                    <p className="text-sm text-text-secondary mt-1">
                      This is the gamified recovery coaching script Cora will use in chat and calls.
                    </p>
                  </div>
                  {loadingExisting && <Badge variant="muted">Loading</Badge>}
                </div>

                {generatedPrompt ? (
                  <div className="flex-1 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary font-sans">
                      {generatedPrompt}
                    </pre>
                  </div>
                ) : (
                  <div className="flex-1 rounded-xl border border-dashed border-bg-border bg-bg-surface px-4 py-6 flex items-center justify-center">
                    <p className="max-w-sm text-center text-sm text-text-muted leading-relaxed">
                      Save the doctor plan to generate a patient-friendly recovery prompt that turns rehab tasks into small home missions.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-4 border-t border-bg-border flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-mono text-text-muted">
              {savedPlanId ? 'Latest recovery prompt is saved for this patient.' : 'No saved recovery prompt yet.'}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={onClose} disabled={saving}>
                Close
              </Button>
              <Button variant="secondary" onClick={() => handleGenerate()} disabled={saving}>
                {saving ? 'Generating...' : generatedPrompt ? 'Update Prompt' : 'Generate Prompt'}
              </Button>
              <Button
                variant="primary"
                onClick={() => handleGenerate({ startCall: true })}
                disabled={saving}
              >
                <span>📞</span>
                <span>Generate + Call</span>
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}
