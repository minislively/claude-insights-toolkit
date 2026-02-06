import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface StackedBarChartProps {
  data: Array<Record<string, string | number>>
  categoryKey: string
  keys: string[]
  colors: string[]
  labels?: Record<string, string>
  height?: number
  layout?: 'horizontal' | 'vertical'
}

export function StackedBarChart({
  data,
  categoryKey,
  keys,
  colors,
  labels,
  height = 300,
  layout = 'horizontal',
}: StackedBarChartProps) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-slate-500 text-sm" style={{ height }}>No data</div>
  }

  const isVertical = layout === 'vertical'
  const leftMargin = isVertical ? Math.min(Math.max(...data.map(d => String(d[categoryKey]).length)) * 6, 140) : 30

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={isVertical ? 'vertical' : 'horizontal'} margin={{ top: 5, right: 20, bottom: 5, left: leftMargin }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        {isVertical ? (
          <>
            <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey={categoryKey} stroke="#94a3b8" tick={{ fontSize: 11 }} width={leftMargin - 10} />
          </>
        ) : (
          <>
            <XAxis dataKey={categoryKey} stroke="#94a3b8" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
          </>
        )}
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
        <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{labels?.[value] ?? value.replace(/_/g, ' ')}</span>} />
        {keys.map((key, i) => (
          <Bar key={key} dataKey={key} stackId="stack" fill={colors[i % colors.length]} radius={i === keys.length - 1 ? [4, 4, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
