import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { ISessionFacet } from '@/types'

const OUTCOME_COLORS: Record<string, string> = {
  fully_achieved: '#10b981',
  mostly_achieved: '#6366f1',
  partially_achieved: '#f59e0b',
  not_achieved: '#ef4444',
  unclear_from_transcript: '#64748b',
}

const OUTCOME_LABELS: Record<string, string> = {
  fully_achieved: 'Fully Achieved',
  mostly_achieved: 'Mostly Achieved',
  partially_achieved: 'Partially',
  not_achieved: 'Not Achieved',
  unclear_from_transcript: 'Unclear',
}

interface OutcomeDonutProps {
  sessions: ISessionFacet[]
  height?: number
}

export function OutcomeDonut({ sessions, height = 300 }: OutcomeDonutProps) {
  const counts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.outcome] = (acc[s.outcome] || 0) + 1
    return acc
  }, {})

  const data = Object.entries(counts).map(([name, value]) => ({
    name: OUTCOME_LABELS[name] || name,
    value,
    color: OUTCOME_COLORS[name] || '#64748b',
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
        <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}
