import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ISessionFacet } from '@/types'

interface FrictionBarChartProps {
  sessions: ISessionFacet[]
  height?: number
}

const FRICTION_LABELS: Record<string, string> = {
  api_error: 'API Error',
  api_errors: 'API Errors',
  api_infrastructure_error: 'Infra Error',
  api_infrastructure_errors: 'Infra Errors',
  buggy_code: 'Buggy Code',
  wrong_approach: 'Wrong Approach',
  context_length_exceeded: 'Context Limit',
  context_limit: 'Context Limit',
}

export function FrictionBarChart({ sessions, height = 300 }: FrictionBarChartProps) {
  const frictionCounts: Record<string, number> = {}

  sessions.forEach(s => {
    Object.entries(s.friction_counts).forEach(([key, val]) => {
      if (val > 0) {
        const label = FRICTION_LABELS[key] || key
        frictionCounts[label] = (frictionCounts[label] || 0) + val
      }
    })
  })

  const data = Object.entries(frictionCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-slate-500 text-sm">No friction data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} width={90} />
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
        <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
