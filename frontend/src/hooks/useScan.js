import { useEffect, useState } from 'react'
import { getScan } from '@/lib/api'

const POLL_MS = 1500
const isDone = (scan) => scan && (scan.status === 'complete' || scan.status === 'failed')

// Fetches a scan and keeps polling until processing finishes.
export function useScan(id) {
  const [scan, setScan] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    let timer

    async function tick() {
      try {
        const data = await getScan(id)
        if (cancelled) return
        setScan(data)
        setError(null)
        if (!isDone(data)) timer = setTimeout(tick, POLL_MS)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }

    setScan(null)
    tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [id])

  return { scan, error }
}
