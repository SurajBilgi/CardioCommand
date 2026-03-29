import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_BASE } from '../services/api'

const REFRESH_INTERVAL_MS = 2000

// Offline fallback vitals per patient
const OFFLINE_VITALS = {
  'john-mercer':  { heart_rate: 96, hrv: 18, spo2: 93, respiratory_rate: 19, skin_temperature: 99.1, ecg_rhythm: 'Sinus Tachycardia', afib_risk: 28, steps_today: 600, activity_level: 'Sedentary', sleep_quality: 44, sleep_hours: 5.1, stress_index: 6.5, risk_score: 71, location: { lat: 37.7751, lng: -122.4196, status: 'at_home', dist_from_home_m: 30 }, alert: { type: 'yellow', message: 'HR elevated for 48hrs. HRV declining. SpO2 borderline.' } },
  'rosa-delgado': { heart_rate: 112, hrv: 8, spo2: 91, respiratory_rate: 22, skin_temperature: 99.4, ecg_rhythm: 'Atrial Fibrillation — DETECTED', afib_risk: 87, steps_today: 200, activity_level: 'Bedrest', sleep_quality: 28, sleep_hours: 3.8, stress_index: 9, risk_score: 94, location: { lat: 37.7855, lng: -122.4088, status: 'at_home', dist_from_home_m: 80 }, alert: { type: 'critical', message: 'CRITICAL: Atrial Fibrillation detected. Immediate physician review required.' } },
  'marcus-webb':  { heart_rate: 88, hrv: 28, spo2: 95, respiratory_rate: 16, skin_temperature: 98.4, ecg_rhythm: 'Normal Sinus Rhythm', afib_risk: 19, steps_today: 1200, activity_level: 'Light', sleep_quality: 58, sleep_hours: 6.4, stress_index: 4.5, risk_score: 55, location: { lat: 37.7652, lng: -122.4390, status: 'at_home', dist_from_home_m: 45 }, alert: { type: 'yellow', message: 'Appointment tomorrow 2:00 PM.' } },
  'sarah-kim':    { heart_rate: 68, hrv: 52, spo2: 98, respiratory_rate: 13, skin_temperature: 97.9, ecg_rhythm: 'Normal Sinus Rhythm', afib_risk: 6, steps_today: 4200, activity_level: 'Moderate', sleep_quality: 81, sleep_hours: 7.8, stress_index: 2, risk_score: 14, location: { lat: 37.7952, lng: -122.3990, status: 'at_home', dist_from_home_m: 55 }, alert: null },
}

export function useVitalsWS(patientId) {
  const [vitals, setVitals] = useState(patientId ? (OFFLINE_VITALS[patientId] || null) : null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const pendingRef = useRef(null)
  const flushTimer = useRef(null)

  const connect = useCallback(() => {
    if (!patientId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_BASE}/vitals/stream/${patientId}`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onmessage = (e) => {
      try {
        // Buffer the latest reading; flush to state at most every REFRESH_INTERVAL_MS
        pendingRef.current = JSON.parse(e.data)
        if (!flushTimer.current) {
          flushTimer.current = setTimeout(() => {
            if (pendingRef.current) setVitals(pendingRef.current)
            flushTimer.current = null
          }, REFRESH_INTERVAL_MS)
        }
      } catch {}
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
  }, [patientId])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      clearTimeout(flushTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { vitals, connected }
}
