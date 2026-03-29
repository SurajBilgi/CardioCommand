import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
export const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'

export const api = axios.create({ baseURL: BASE_URL, timeout: 5000 })

// ─── Fallback mock data ────────────────────────────────────────────────────────

const MOCK_PATIENT = {
  id: 'john-mercer', name: 'John Mercer', age: 67,
  surgery_type: 'Coronary Artery Bypass Graft (CABG)', days_post_op: 8,
  ejection_fraction: 35, attending: 'Dr. Kavitha Rao',
  next_appointment: '2025-03-26T14:00:00',
  comorbidities: ['Type 2 Diabetes', 'Hypertension', 'CKD Stage 2'],
  medications: [
    { name: 'Metoprolol', dose: '25mg', frequency: 'twice daily', time: ['08:00', '20:00'] },
    { name: 'Lisinopril', dose: '10mg', frequency: 'once daily', time: ['08:00'] },
    { name: 'Aspirin', dose: '81mg', frequency: 'once daily', time: ['08:00'] },
    { name: 'Atorvastatin', dose: '40mg', frequency: 'nightly', time: ['21:00'] },
    { name: 'Furosemide', dose: '20mg', frequency: 'once daily', time: ['08:00'] },
  ],
}

const MOCK_VITALS = {
  heart_rate: 96, hrv: 18, spo2: 93, respiratory_rate: 19,
  skin_temperature: 99.1, ecg_rhythm: 'Sinus Tachycardia', afib_risk: 28,
  steps_today: 600, activity_level: 'Sedentary', sleep_quality: 44,
  sleep_hours: 5.1, stress_index: 6.5, risk_score: 71,
  alert: { type: 'yellow', message: 'HR elevated. SpO₂ borderline. Recommend rest.' },
}

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
  withFallback(() => api.get(`/patients/${id}`).then(r => r.data), MOCK_PATIENT)

export const fetchCurrentVitals = (id) =>
  withFallback(() => api.get(`/vitals/${id}/current`).then(r => r.data), MOCK_VITALS)

export const fetchVitalsHistory = (id, n = 240) =>
  withFallback(
    () => api.get(`/vitals/${id}/history?n=${n}`).then(r => r.data),
    Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 2000).toISOString(),
      heart_rate:       +(96 + (Math.random() - 0.5) * 6).toFixed(1),
      spo2:             +(93 + (Math.random() - 0.5) * 1.5).toFixed(1),
      sleep_quality:    44,
      steps_today:      600 + Math.round(Math.random() * 80),
    }))
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
