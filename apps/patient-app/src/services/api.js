import axios from 'axios'
import {
  DEMO_PATIENT,
  DEMO_VITALS,
  buildDemoVitalsHistory,
} from '../data/patientDemoData'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
export const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'

export const api = axios.create({ baseURL: BASE_URL, timeout: 5000 })

const MOCK_SCENARIOS = [
  { key: 'normal_recovery', label: 'Day 3 — Normal Recovery' },
  { key: 'early_warning',   label: 'Day 7 — Early Warning Signs' },
  { key: 'afib_detected',   label: 'Day 10 — AFib Event' },
  { key: 'pre_visit',       label: 'Day 13 — Pre-Visit' },
  { key: 'full_recovery',   label: 'Day 30 — Full Recovery' },
]

async function withFallback(apiFn, fallback) {
  try { return await apiFn() } catch { return fallback }
}

// ─── Exported API functions ────────────────────────────────────────────────────

export const fetchPatient = (id) =>
  withFallback(() => api.get(`/patients/${id}`).then(r => r.data), DEMO_PATIENT)

export const fetchCurrentVitals = (id) =>
  withFallback(() => api.get(`/vitals/${id}/current`).then(r => r.data), DEMO_VITALS)

export const fetchVitalsHistory = (id, n = 240) =>
  withFallback(
    () => api.get(`/vitals/${id}/history?n=${n}`).then(r => r.data),
    buildDemoVitalsHistory(Math.min(n, 120))
  )

export const fetchScenarios = () =>
  withFallback(() => api.get('/demo/scenarios').then(r => r.data), MOCK_SCENARIOS)

export const setScenario = (patientId, scenarioKey) =>
  withFallback(
    () => api.post('/demo/set-scenario', { patient_id: patientId, scenario_key: scenarioKey }).then(r => r.data),
    { success: true }
  )

export const triggerAlert = (patientId, alertType, message) =>
  withFallback(
    () => api.post('/demo/trigger-alert', { patient_id: patientId, alert_type: alertType, message }).then(r => r.data),
    { success: true }
  )

export const sendChat = (patientId, message, patientProfile, history) =>
  fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId, message, patient_profile: patientProfile, conversation_history: history }),
  })
