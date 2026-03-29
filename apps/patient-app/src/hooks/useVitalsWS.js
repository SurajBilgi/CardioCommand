import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_BASE } from '../services/api'
import { DEMO_VITALS } from '../data/patientDemoData'

const REFRESH_INTERVAL_MS = 2000

const OFFLINE_VITALS = {
  'john-mercer': DEMO_VITALS,
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
