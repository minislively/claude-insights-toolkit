import { useMemo } from 'react'
import type { IInsightsDay } from '@/types'
import { analyzeTrends } from '@/lib/analyzers'
import type { ITrendAnalysis } from '@/lib/analyzers'

export function useTrends(data: IInsightsDay[]): ITrendAnalysis | null {
  return useMemo(() => {
    if (data.length === 0) return null
    return analyzeTrends(data)
  }, [data])
}
