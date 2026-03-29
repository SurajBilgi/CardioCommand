import { useState, useRef, useCallback } from 'react'

export function useSSE() {
  const [streaming, setStreaming] = useState(false)
  const [events, setEvents] = useState([])
  const [complete, setComplete] = useState(false)
  const abortRef = useRef(null)

  const reset = useCallback(() => {
    setEvents([])
    setComplete(false)
    setStreaming(false)
  }, [])

  const startStream = useCallback(async (fetchFn) => {
    reset()
    setStreaming(true)

    try {
      const response = await fetchFn()
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6))
              setEvents(prev => [...prev, parsed])
              if (parsed.type === 'complete') {
                setComplete(true)
                setStreaming(false)
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setEvents(prev => [...prev, { type: 'error', message: err.message }])
    } finally {
      setStreaming(false)
    }
  }, [reset])

  return { streaming, events, complete, startStream, reset }
}
