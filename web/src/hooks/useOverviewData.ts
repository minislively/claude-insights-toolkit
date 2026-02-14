import { useState, useEffect, useCallback } from 'react'
import type { IOverviewResponse } from '@/types'

interface UseOverviewDataReturn {
  data: IOverviewResponse | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useOverviewData(days: number = 30): UseOverviewDataReturn {
  const [data, setData] = useState<IOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/overview?days=${days}`)
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
