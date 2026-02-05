import { useState, useEffect, useCallback } from 'react'
import type { IInsightsDay } from '@/types'

interface UseInsightsDataReturn {
  data: IInsightsDay[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useInsightsData(days: number = 30): UseInsightsDataReturn {
  const [data, setData] = useState<IInsightsDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/data?days=${days}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
