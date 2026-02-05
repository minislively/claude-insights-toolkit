import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TrendLineChartProps {
  data: Array<{ date: string; value: number }>
  color?: string
  label?: string
  height?: number
  valueFormatter?: (v: number) => string
}

export function TrendLineChart({ data, color = '#6366f1', label = 'Value', height = 300, valueFormatter }: TrendLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
        <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={valueFormatter} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
          labelFormatter={(l) => `Date: ${l}`}
          formatter={(value: number) => [valueFormatter ? valueFormatter(value) : value, label]}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
