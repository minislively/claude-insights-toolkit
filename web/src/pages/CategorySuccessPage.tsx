import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useInsightsData } from '@/hooks'
import { PeriodSelector } from '@/components/PeriodSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'
import { MetricCard } from '@/components/MetricCard'
import { analyzeProductivity } from '@/lib/analyzers'
import type { ICategoryStats } from '@shared/analyzers/productivity'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'

export function CategorySuccessPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(14)
  const { data, loading, error, refetch } = useInsightsData(days)

  const result = useMemo(() => {
    if (data.length === 0) return null
    return analyzeProductivity(data)
  }, [data])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (data.length === 0) return <EmptyState />
  if (!result) return <EmptyState />

  const lowPerformingCategories = result.categoryStats.filter(c => c.sessions >= 3 && c.successRate < 50)
  const highPerformingCategories = result.categoryStats.filter(c => c.sessions >= 3 && c.successRate >= 70)

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Category Success Rates</h2>
          <p className="text-slate-400 text-sm mt-1">{result.summary}</p>
        </div>
        <PeriodSelector value={days} onChange={setDays} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Categories"
          value={result.categoryStats.length}
          color="indigo"
          subtitle="across all sessions"
        />
        <MetricCard
          title="Top Category"
          value={result.metrics.topCategory.replace(/_/g, ' ')}
          color="emerald"
          subtitle="most frequent"
        />
        <MetricCard
          title="High Performers"
          value={highPerformingCategories.length}
          color="emerald"
          subtitle="70%+ success rate"
        />
        <MetricCard
          title="Needs Attention"
          value={lowPerformingCategories.length}
          color={lowPerformingCategories.length > 0 ? 'rose' : 'emerald'}
          subtitle="below 50% success"
        />
      </div>

      {/* Category Success Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Success Rate Comparison</h3>
          {result.categoryStats.length > 0 ? (
            <CategorySuccessBarChart categories={result.categoryStats.slice(0, 8)} />
          ) : (
            <p className="text-slate-400 text-sm">No category data available</p>
          )}
        </div>

        {/* Radar Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Category Performance Radar</h3>
          {result.categoryStats.length >= 3 ? (
            <CategoryRadarChart categories={result.categoryStats.slice(0, 6)} />
          ) : (
            <p className="text-slate-400 text-sm">Need at least 3 categories for radar chart</p>
          )}
        </div>
      </div>

      {/* Detailed Category List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Detailed Breakdown</h3>
        {result.categoryStats.length > 0 ? (
          <div className="space-y-3">
            {result.categoryStats.slice(0, 10).map((category) => (
              <CategoryBar key={category.category} category={category} />
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">No category data available</p>
        )}
      </div>

      {/* Category-Outcome Matrix */}
      {result.categoryOutcomeMatrix.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Category Outcome Distribution</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-center py-3 px-4 text-emerald-400">Fully</th>
                  <th className="text-center py-3 px-4 text-indigo-400">Mostly</th>
                  <th className="text-center py-3 px-4 text-amber-400">Partially</th>
                  <th className="text-center py-3 px-4 text-rose-400">Not</th>
                  <th className="text-center py-3 px-4">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {result.categoryOutcomeMatrix.map((row) => {
                  const total = row.fully_achieved + row.mostly_achieved + row.partially_achieved + row.not_achieved + row.unclear_from_transcript
                  const successRate = total > 0 ? Math.round(((row.fully_achieved + row.mostly_achieved) / total) * 100) : 0
                  return (
                    <tr key={row.category} className="border-b border-slate-700/50">
                      <td className="py-3 px-4 text-slate-300">{row.category.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-4 text-center text-slate-400">{row.fully_achieved}</td>
                      <td className="py-3 px-4 text-center text-slate-400">{row.mostly_achieved}</td>
                      <td className="py-3 px-4 text-center text-slate-400">{row.partially_achieved}</td>
                      <td className="py-3 px-4 text-center text-slate-400">{row.not_achieved}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-medium ${successRate >= 70 ? 'text-emerald-400' : successRate >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {successRate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low Performing Categories - Recommendations */}
      {lowPerformingCategories.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recommendations for Low-Performing Categories</h3>
          <div className="space-y-4">
            {lowPerformingCategories.slice(0, 5).map((category) => (
              <div key={category.category} className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">{category.category.replace(/_/g, ' ')}</h4>
                  <span className="text-rose-400 font-bold">{category.successRate}% success</span>
                </div>
                <p className="text-slate-300 text-sm mb-2">
                  {category.sessions} sessions with {category.successRate}% success rate.
                  {category.successRate < 30
                    ? ' Critical attention needed - consider adding detailed CLAUDE.md guidance.'
                    : ' Review these sessions for common friction patterns.'}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(category.outcomes)
                    .filter(([, count]) => count > 0)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([outcome, count]) => (
                      <span key={outcome} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                        {outcome.replace(/_/g, ' ')}: {count}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {highPerformingCategories.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Performing Categories</h3>
          <div className="space-y-3">
            {highPerformingCategories.slice(0, 5).map((category) => (
              <div key={category.category} className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div>
                  <span className="text-white font-medium">{category.category.replace(/_/g, ' ')}</span>
                  <p className="text-slate-400 text-xs">{category.sessions} sessions</p>
                </div>
                <span className="text-emerald-400 font-bold">{category.successRate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryBar({ category }: { category: ICategoryStats }) {
  const successWidth = category.successRate
  const failureWidth = 100 - category.successRate

  return (
    <div className="flex items-center gap-4">
      <div className="w-32 text-slate-300 text-sm truncate" title={category.category}>
        {category.category.replace(/_/g, ' ')}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-400 text-xs">{category.sessions} sessions</span>
          <span className={`text-xs font-medium ${category.successRate >= 70 ? 'text-emerald-400' : category.successRate >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
            {category.successRate}%
          </span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${successWidth}%` }}
          />
          <div
            className="h-full bg-rose-500"
            style={{ width: `${failureWidth}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function CategorySuccessBarChart({ categories }: { categories: ICategoryStats[] }) {
  const chartData = categories.map(c => ({
    name: c.category.length > 15 ? c.category.slice(0, 15) + '...' : c.category.replace(/_/g, ' '),
    rate: c.successRate,
    sessions: c.sessions
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} angle={-45} textAnchor="end" height={80} />
        <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#cbd5e1' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Bar dataKey="rate" name="Success Rate (%)" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.rate >= 70 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#f43f5e'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function CategoryRadarChart({ categories }: { categories: ICategoryStats[] }) {
  const chartData = categories.map(c => ({
    category: c.category.length > 12 ? c.category.slice(0, 12) + '...' : c.category.replace(/_/g, ' '),
    successRate: c.successRate,
    sessions: Math.min(c.sessions * 10, 100) // Normalize sessions to 0-100
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis dataKey="category" stroke="#94a3b8" fontSize={11} />
        <PolarRadiusAxis stroke="#94a3b8" fontSize={10} domain={[0, 100]} />
        <Radar name="Success Rate" dataKey="successRate" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
        <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#cbd5e1' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
