import { useMemo } from 'react'
import type { IInsightsDay } from '@/types'
import { analyzeBottlenecks } from '@/lib/analyzers'
import type { IBottleneckResult } from '@/lib/analyzers'

export function useBottlenecks(data: IInsightsDay[]): IBottleneckResult | null {
  return useMemo(() => {
    if (data.length === 0) return null
    return analyzeBottlenecks(data)
  }, [data])
}
