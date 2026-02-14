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
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
        {trend && trendValue && (
          <span className={`text-xs font-semibold ${trendColors[trend]}`}>
            {trendIcons[trend]} {trendValue}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold leading-none text-white lg:text-3xl">{value}</p>
      {subtitle && <p className="mt-2 text-xs text-slate-500">{subtitle}</p>}
    </div>
  )
}
