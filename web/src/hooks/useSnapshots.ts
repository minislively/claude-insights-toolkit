import { useState, useEffect } from 'react'

export interface Snapshot {
  version: number
  date: string
  createdAt: string
  metrics: {
    sessions: number
    messages: number
    days: number
    msgsPerDay: number
    linesAdded: number
    linesRemoved: number
    files: number
    successRate: number
    primaryLanguage: string
    dateRangeStart: string
    dateRangeEnd: string
  }
  delta: {
    sessionsDiff: number
    sessionsDiffPercent: number
    messagesDiff: number
    successRateDiff: number
    anomalies: Array<{
      type: string
      severity: 'critical' | 'warning' | 'info'
      message: string
      details: { previous: number | string; current: number | string; changePercent?: number }
    }>
  } | null
  source: {
    reportHtmlPath: string
    facetsCollected: number
  }
}

export function useSnapshots() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/snapshots')
      .then(res => res.json())
      .then(data => { setSnapshots(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  return { snapshots, loading, error }
}
