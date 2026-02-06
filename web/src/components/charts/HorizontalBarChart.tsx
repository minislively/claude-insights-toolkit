import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface HorizontalBarChartProps {
  data: Array<{ name: string; value: number; secondaryValue?: number }>
  color?: string
  secondaryColor?: string
  valueFormatter?: (v: number) => string
  valueKey?: string
  secondaryKey?: string
  height?: number
}

export function HorizontalBarChart({
  data,
  color = '#6366f1',
  secondaryColor = '#10b981',
  valueFormatter,
  valueKey = 'value',
  secondaryKey = 'secondaryValue',
  height = 300,
}: HorizontalBarChartProps) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-slate-500 text-sm" style={{ height }}>No data</div>
  }

  const hasSecondary = data.some(d => d.secondaryValue !== undefined && d.secondaryValue > 0)
  const leftMargin = Math.min(Math.max(...data.map(d => d.name.length)) * 6, 140)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: leftMargin }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={valueFormatter} />
        <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} width={leftMargin - 10} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
          formatter={(value: number, name: string) => [valueFormatter ? valueFormatter(value) : value, name === valueKey ? 'Count' : 'Success Rate']}
        />
        <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} />
        {hasSecondary && (
          <Bar dataKey={secondaryKey} fill={secondaryColor} radius={[0, 4, 4, 0]} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
