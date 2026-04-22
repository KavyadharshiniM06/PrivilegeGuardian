import { useEffect, useRef, useState } from 'react'

export function useSSE(onEvent) {
  const [connected, setConnected] = useState(false)
  const esRef = useRef(null)
  const retryRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('pg_token')
    if (!token) return

    function connect() {
      try {
        if (esRef.current) esRef.current.close()
        const es = new EventSource(`/api/events/stream?token=${token}`)
        esRef.current = es

        es.onopen = () => setConnected(true)

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.type !== 'connected') onEvent?.(data)
          } catch (_) {}
        }

        es.onerror = () => {
          setConnected(false)
          es.close()
          retryRef.current = setTimeout(connect, 5000)
        }
      } catch (_) {}
    }

    connect()

    return () => {
      esRef.current?.close()
      clearTimeout(retryRef.current)
    }
  }, [])

  return connected
}
