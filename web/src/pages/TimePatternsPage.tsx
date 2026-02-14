import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useInsightsData } from '@/hooks'
import { PeriodSelector } from '@/components/PeriodSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'
import { MetricCard } from '@/components/MetricCard'
import { analyzeTimePatterns } from '@/lib/analyzers'
import type { ITimePatternResult, ITimeSlotStats } from '@shared/analyzers/time-patterns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

export function TimePatternsPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(14)
  const { data, loading, error, refetch } = useInsightsData(days)

  const result = useMemo(() => {
    if (data.length === 0) return null
    return analyzeTimePatterns(data)
  }, [data])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (data.length === 0) return <EmptyState />
  if (!result) return <EmptyState />

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Time Patterns</h2>
          <p className="text-slate-400 text-sm mt-1">{result.summary}</p>
        </div>
        <PeriodSelector value={days} onChange={setDays} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Peak Activity"
          value={result.peakHours[0] || 'N/A'}
          color="indigo"
          subtitle="most active hour"
        />
        <MetricCard
          title="Best Success Rate"
          value={result.optimalHours[0] || 'N/A'}
          color="emerald"
          subtitle="optimal hour"
        />
        <MetricCard
          title="Best Period"
          value={result.bestPeriod || 'N/A'}
          color="amber"
          subtitle="most productive time"
        />
        <MetricCard
          title="Best Day"
          value={result.bestDays[0] || 'N/A'}
          color="emerald"
          subtitle="most productive day"
        />
      </div>

      {/* Hourly Stats */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Activity by Hour</h3>
        <HourlyActivityChart hourlyStats={result.hourlyStats} />
        <div className="grid grid-cols-6 gap-2 mt-6">
          {result.hourlyStats.map((stat) => (
            <TimeSlotCard key={stat.slot} stat={stat} />
          ))}
        </div>
      </div>

      {/* Day of Week */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Day of Week Patterns</h3>
        <div className="grid grid-cols-7 gap-2">
          {result.dayOfWeekStats.map((day) => (
            <DayCard key={day.day} day={day} />
          ))}
        </div>
      </div>

      {/* Period Stats */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Time Periods</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {result.periodStats.map((periodStat) => (
            <PeriodCard key={periodStat.slot} periodStat={periodStat} />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recommendations</h3>
          <div className="space-y-3">
            {result.recommendations.slice(0, 5).map((rec, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border ${
                  rec.type === 'optimal_time'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : rec.type === 'avoid_time'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      rec.type === 'optimal_time'
                        ? 'bg-emerald-500 text-white'
                        : rec.type === 'avoid_time'
                        ? 'bg-rose-500 text-white'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {rec.type.toUpperCase().replace('_', ' ')}
                  </span>
                  <h4 className="text-white font-medium">{rec.title}</h4>
                </div>
                <p className="text-slate-300 text-sm">{rec.description}</p>
                <p className="text-slate-400 text-xs mt-1">Confidence: {rec.confidence}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TimeSlotCard({ stat }: { stat: ITimeSlotStats }) {
  const intensity = stat.sessionCount > 0 ? Math.min(100, (stat.sessionCount / 10) * 100) : 0

  return (
    <div className={`p-3 rounded-lg border ${intensity > 50 ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-slate-700/30 border-slate-700'}`}>
      <div className="text-xs text-slate-400 mb-1">{stat.slot}</div>
      <div className="text-lg font-bold text-white">{stat.sessionCount}</div>
      <div className="text-xs text-slate-500">{stat.successRate}% success</div>
      {intensity > 0 && (
        <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${intensity}%` }} />
        </div>
      )}
    </div>
  )
}

function DayCard({ day }: { day: { day: string; dayIndex: number; sessionCount: number; avgSessionsPerDay: number; successRate: number } }) {
  const hasData = day.sessionCount > 0

  return (
    <div className={`p-3 rounded-lg border ${hasData ? 'bg-slate-700/30 border-slate-700' : 'bg-slate-800/30 border-slate-800'}`}>
      <div className="text-xs text-slate-400 mb-1">{day.day.slice(0, 3)}</div>
      <div className="text-lg font-bold text-white">{day.sessionCount}</div>
      {hasData && <div className="text-xs text-slate-500">{day.successRate}%</div>}
    </div>
  )
}

function PeriodCard({ periodStat }: { periodStat: ITimeSlotStats }) {
  const periodColors: Record<string, string> = {
    'early_morning': 'bg-amber-500/20 border-amber-500/30',
    'morning': 'bg-yellow-500/20 border-yellow-500/30',
    'afternoon': 'bg-orange-500/20 border-orange-500/30',
    'evening': 'bg-indigo-500/20 border-indigo-500/30',
    'night': 'bg-purple-500/20 border-purple-500/30',
  }

  return (
    <div className={`p-4 rounded-lg border ${periodColors[periodStat.slot] || 'bg-slate-700/30 border-slate-700'}`}>
      <div className="text-sm text-slate-300 capitalize">{periodStat.slot.replace('_', ' ')}</div>
      <div className="text-2xl font-bold text-white mt-1">{periodStat.sessionCount}</div>
      <div className="text-xs text-slate-400">{periodStat.successRate}% success</div>
    </div>
  )
}

function HourlyActivityChart({ hourlyStats }: { hourlyStats: ITimeSlotStats[] }) {
  const chartData = hourlyStats.map(stat => ({
    hour: stat.slot,
    sessions: stat.sessionCount,
    successRate: stat.successRate
  }))

  const getBarColor = (value: number, max: number) => {
    const intensity = value / max
    if (intensity > 0.7) return '#6366f1' // indigo
    if (intensity > 0.4) return '#8b5cf6' // purple
    return '#64748b' // slate
  }

  const maxSessions = Math.max(...chartData.map(d => d.sessions), 1)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} angle={-45} textAnchor="end" height={60} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#cbd5e1' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Bar dataKey="sessions" name="Sessions" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.sessions, maxSessions)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
