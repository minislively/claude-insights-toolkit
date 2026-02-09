import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string }>
  height?: number
}

export function DonutChart({ data, height = 300 }: DonutChartProps) {
  if (data.length === 0 || data.every(d => d.value === 0)) {
    return <div className="flex items-center justify-center text-slate-500 text-sm" style={{ height }}>No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
          formatter={(value, name) => [value as number, name as string]}
        />
        <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}
