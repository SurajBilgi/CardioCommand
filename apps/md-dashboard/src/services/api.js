import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
export const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'

export const api = axios.create({ baseURL: BASE_URL, timeout: 5000 })

// ─── Fallback mock data (shown when backend is offline) ────────────────────────

const MOCK_PATIENTS = [
  {
    id: 'john-mercer', name: 'John Mercer', age: 67, photo_initials: 'JM',
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
    home_location: { lat: 37.7749, lng: -122.4194 },
    risk_score: 71, active_scenario: 'early_warning',
    rehab: {
      rehab_week: 2,
      streak_days: 4,
      sessions_this_week: 2,
      sessions_goal: 3,
      last_checkin_mode: 'wall',
      last_barrier_reason: 'Too tired today',
      last_session_duration_seconds: 0,
    },
    current_vitals: {
      heart_rate: 96, hrv: 18, spo2: 93, respiratory_rate: 19,
      skin_temperature: 99.1, ecg_rhythm: 'Sinus Tachycardia', afib_risk: 28,
      steps_today: 600, activity_level: 'Sedentary', sleep_quality: 44,
      sleep_hours: 5.1, stress_index: 6.5, risk_score: 71,
      location: { lat: 37.7751, lng: -122.4196, status: 'at_home', dist_from_home_m: 30 },
      alert: { type: 'yellow', message: 'HR elevated for 48hrs. HRV declining. SpO2 borderline. Recommend same-day outreach.' },
    },
  },
  {
    id: 'rosa-delgado', name: 'Rosa Delgado', age: 54, photo_initials: 'RD',
    surgery_type: 'Transcatheter Aortic Valve Replacement (TAVR)', days_post_op: 5,
    ejection_fraction: 52, attending: 'Dr. Kavitha Rao',
    next_appointment: '2025-03-29T10:30:00',
    comorbidities: ['Atrial Fibrillation', 'Hypertension'],
    medications: [
      { name: 'Warfarin', dose: '5mg', frequency: 'once daily', time: ['17:00'] },
      { name: 'Aspirin', dose: '81mg', frequency: 'once daily', time: ['08:00'] },
      { name: 'Amiodarone', dose: '200mg', frequency: 'twice daily', time: ['08:00', '20:00'] },
    ],
    home_location: { lat: 37.7849, lng: -122.4094 },
    risk_score: 94, active_scenario: 'afib_detected',
    rehab: {
      rehab_week: 1,
      streak_days: 1,
      sessions_this_week: 0,
      sessions_goal: 3,
      last_checkin_mode: 'wall',
      last_barrier_reason: 'Worried it is not safe',
      last_session_duration_seconds: 0,
    },
    current_vitals: {
      heart_rate: 112, hrv: 8, spo2: 91, respiratory_rate: 22,
      skin_temperature: 99.4, ecg_rhythm: 'Atrial Fibrillation — DETECTED', afib_risk: 87,
      steps_today: 200, activity_level: 'Bedrest', sleep_quality: 28,
      sleep_hours: 3.8, stress_index: 9, risk_score: 94,
      location: { lat: 37.7855, lng: -122.4088, status: 'at_home', dist_from_home_m: 80 },
      alert: { type: 'critical', message: 'CRITICAL: Atrial Fibrillation detected. Irregular rhythm persisting >2hrs. Immediate physician review required.' },
    },
  },
  {
    id: 'marcus-webb', name: 'Marcus Webb', age: 71, photo_initials: 'MW',
    surgery_type: 'Implantable Cardioverter Defibrillator (ICD)', days_post_op: 13,
    ejection_fraction: 28, attending: 'Dr. Kavitha Rao',
    next_appointment: '2025-03-26T09:00:00',
    comorbidities: ['Heart Failure (HFrEF)', 'COPD', 'Type 2 Diabetes'],
    medications: [
      { name: 'Sacubitril/Valsartan', dose: '49/51mg', frequency: 'twice daily', time: ['08:00', '20:00'] },
      { name: 'Carvedilol', dose: '12.5mg', frequency: 'twice daily', time: ['08:00', '20:00'] },
    ],
    home_location: { lat: 37.7649, lng: -122.4394 },
    risk_score: 55, active_scenario: 'pre_visit',
    rehab: {
      rehab_week: 3,
      streak_days: 3,
      sessions_this_week: 2,
      sessions_goal: 3,
      last_checkin_mode: 'win',
      last_barrier_reason: '',
      last_session_duration_seconds: 960,
    },
    current_vitals: {
      heart_rate: 88, hrv: 28, spo2: 95, respiratory_rate: 16,
      skin_temperature: 98.4, ecg_rhythm: 'Normal Sinus Rhythm', afib_risk: 19,
      steps_today: 1200, activity_level: 'Light', sleep_quality: 58,
      sleep_hours: 6.4, stress_index: 4.5, risk_score: 55,
      location: { lat: 37.7652, lng: -122.4390, status: 'at_home', dist_from_home_m: 45 },
      alert: { type: 'yellow', message: 'Appointment tomorrow 2:00 PM. Pre-visit brief ready. HR still above baseline.' },
    },
  },
  {
    id: 'sarah-kim', name: 'Sarah Kim', age: 48, photo_initials: 'SK',
    surgery_type: 'Mitral Valve Repair', days_post_op: 30,
    ejection_fraction: 62, attending: 'Dr. Kavitha Rao',
    next_appointment: '2025-04-05T11:00:00',
    comorbidities: [],
    medications: [
      { name: 'Aspirin', dose: '81mg', frequency: 'once daily', time: ['08:00'] },
      { name: 'Metoprolol', dose: '12.5mg', frequency: 'once daily', time: ['08:00'] },
    ],
    home_location: { lat: 37.7949, lng: -122.3994 },
    risk_score: 14, active_scenario: 'full_recovery',
    rehab: {
      rehab_week: 5,
      streak_days: 9,
      sessions_this_week: 3,
      sessions_goal: 3,
      last_checkin_mode: 'win',
      last_barrier_reason: '',
      last_session_duration_seconds: 1260,
    },
    current_vitals: {
      heart_rate: 68, hrv: 52, spo2: 98, respiratory_rate: 13,
      skin_temperature: 97.9, ecg_rhythm: 'Normal Sinus Rhythm', afib_risk: 6,
      steps_today: 4200, activity_level: 'Moderate', sleep_quality: 81,
      sleep_hours: 7.8, stress_index: 2, risk_score: 14,
      location: { lat: 37.7952, lng: -122.3990, status: 'at_home', dist_from_home_m: 55 },
      alert: null,
    },
  },
]

const MOCK_TIMELINE = [
  { id: 'a1', type: 'alert', icon: '🤖', label: 'AI Analysis Complete', detail: 'Risk: 71/100 — HIGH. HR elevated, SpO₂ dipping. Actions: Outreach script generated.', time: '09:41am', day: 'Day 8' },
  { id: 'a2', type: 'vitals_sync', icon: '❤️', label: 'Wearable Sync', detail: 'HR 96bpm · SpO₂ 93% · Steps: 612', time: '07:15am', day: 'Day 8' },
  { id: 'a3', type: 'chat', icon: '💬', label: 'Patient Message via Cora', detail: '"Feeling very tired, slight chest soreness" → Flagged for review', time: '02:30pm', day: 'Day 7' },
  { id: 'a4', type: 'discharge', icon: '🏥', label: 'Discharged from Hospital', detail: 'Post-operative care plan activated. Remote monitoring initiated.', time: '10:00am', day: 'Day 1' },
]

const MOCK_SCENARIOS = [
  { key: 'normal_recovery', label: 'Day 3 — Normal Recovery', risk_score: 38, has_alert: false },
  { key: 'early_warning',   label: 'Day 7 — Early Warning Signs', risk_score: 71, has_alert: true, alert_type: 'yellow' },
  { key: 'afib_detected',   label: 'Day 10 — AFib Event', risk_score: 94, has_alert: true, alert_type: 'critical' },
  { key: 'pre_visit',       label: 'Day 13 — Pre-Visit', risk_score: 55, has_alert: true, alert_type: 'yellow' },
  { key: 'full_recovery',   label: 'Day 30 — Full Recovery', risk_score: 14, has_alert: false },
]

// Wrap every GET with a fallback so the UI never goes blank
async function withFallback(apiFn, fallback) {
  try {
    return await apiFn()
  } catch {
    return fallback
  }
}

// ─── Exported API functions ────────────────────────────────────────────────────

export const fetchPatients = () =>
  withFallback(() => api.get('/patients').then(r => r.data), MOCK_PATIENTS)

export const fetchPatient = (id) =>
  withFallback(
    () => api.get(`/patients/${id}`).then(r => r.data),
    MOCK_PATIENTS.find(p => p.id === id) || MOCK_PATIENTS[0]
  )

export const fetchTimeline = (id) =>
  withFallback(() => api.get(`/patients/${id}/timeline`).then(r => r.data), MOCK_TIMELINE)

export const fetchVitalsHistory = (id, n = 240) =>
  withFallback(() => api.get(`/vitals/${id}/history?n=${n}`).then(r => r.data), _generateMockHistory(id))

export const fetchCurrentVitals = (id) =>
  withFallback(
    () => api.get(`/vitals/${id}/current`).then(r => r.data),
    MOCK_PATIENTS.find(p => p.id === id)?.current_vitals || MOCK_PATIENTS[0].current_vitals
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

export const spikeVitals = (patientId, metric, delta) =>
  withFallback(
    () => api.post('/demo/spike-vitals', { patient_id: patientId, metric, delta }).then(r => r.data),
    { success: true }
  )

export const runAnalysis = (patientId, patientProfile, currentVitals) =>
  fetch(`${BASE_URL}/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId, patient_profile: patientProfile, current_vitals: currentVitals }),
  })

export const getPreVisitBrief = (patientId, patientProfile) =>
  fetch(`${BASE_URL}/ai/pre-visit-brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId, patient_profile: patientProfile }),
  })

export const generateSoapNote = (patientProfile, currentSoap, transcriptChunk) =>
  withFallback(
    () => api.post('/ai/soap-note', { patient_profile: patientProfile, current_soap: currentSoap, transcript_chunk: transcriptChunk }).then(r => r.data),
    {
      subjective: 'Patient reports mild fatigue and incisional soreness. Denies chest pain or dyspnea at rest.',
      objective: `Day ${patientProfile.days_post_op || 8} post-op. HR ~96 bpm. SpO₂ 93%. Bilateral ankle edema mild.`,
      assessment: 'Post-operative recovery on expected trajectory. Mild fluid retention noted. Activity tolerance reduced.',
      plan: 'Continue current diuretic regimen. Increase ambulation to 15 min daily. Follow up in 1 week.',
    }
  )

// ─── Mock vitals history generator ────────────────────────────────────────────

function _generateMockHistory(patientId) {
  const patient = MOCK_PATIENTS.find(p => p.id === patientId) || MOCK_PATIENTS[0]
  const base = patient.current_vitals
  const history = []
  const now = Date.now()
  for (let i = 119; i >= 0; i--) {
    history.push({
      timestamp: new Date(now - i * 2000).toISOString(),
      heart_rate:       +(base.heart_rate + (Math.random() - 0.5) * 6).toFixed(1),
      hrv:              +(base.hrv        + (Math.random() - 0.5) * 4).toFixed(1),
      spo2:             +(base.spo2       + (Math.random() - 0.5) * 1.5).toFixed(1),
      respiratory_rate: +(base.respiratory_rate + (Math.random() - 0.5) * 2).toFixed(1),
      sleep_quality:    base.sleep_quality,
      steps_today:      base.steps_today,
      risk_score:       base.risk_score,
      location:         base.location,
    })
  }
  return history
}
