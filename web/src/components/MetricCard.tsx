interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate'
}

const colorMap = {
  indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  slate: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
}

const trendIcons = { up: '↑', down: '↓', stable: '→' }
const trendColors = { up: 'text-emerald-400', down: 'text-rose-400', stable: 'text-slate-400' }

export function MetricCard({ title, value, subtitle, trend, trendValue, color = 'indigo' }: MetricCardProps) {
  return (
    <div className={`rounded-xl border p-6 ${colorMap[color]}`}>
      <p className="text-sm text-slate-400 mb-1">{title}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-white">{value}</p>
        {trend && trendValue && (
          <span className={`text-sm font-medium ${trendColors[trend]}`}>
            {trendIcons[trend]} {trendValue}
          </span>
        )}
      </div>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  )
}
