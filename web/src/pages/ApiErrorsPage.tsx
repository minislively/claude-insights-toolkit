import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useInsightsData } from '@/hooks'
import { PeriodSelector } from '@/components/PeriodSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'
import { MetricCard } from '@/components/MetricCard'
import { analyzeApiErrors } from '@/lib/analyzers'
import type { IApiErrorResult, IApiErrorSession, IApiErrorTrend } from '@shared/analyzers/api-errors'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export function ApiErrorsPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(14)
  const { data, loading, error, refetch } = useInsightsData(days)

  const result = useMemo(() => {
    if (data.length === 0) return null
    return analyzeApiErrors(data)
  }, [data])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (data.length === 0) return <EmptyState />
  if (!result) return <EmptyState />

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">API Error Analysis</h2>
          <p className="text-slate-400 text-sm mt-1">{result.summary}</p>
        </div>
        <PeriodSelector value={days} onChange={setDays} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Affected Sessions"
          value={`${result.metrics.errorSessions} (${result.metrics.errorSessionRate}%)`}
          color={result.metrics.errorSessionRate > 30 ? 'rose' : result.metrics.errorSessionRate > 10 ? 'amber' : 'emerald'}
          subtitle={`of ${result.metrics.totalSessions} total`}
        />
        <MetricCard
          title="Total API Errors"
          value={result.metrics.totalErrorCount}
          color="indigo"
          subtitle="across all sessions"
        />
        <MetricCard
          title="Avg Errors/Session"
          value={result.metrics.avgErrorsPerErrorSession}
          color="amber"
          subtitle="when affected"
        />
        <MetricCard
          title="Max in One Session"
          value={result.metrics.maxErrorsInSingleSession}
          color="rose"
          subtitle="worst case"
        />
      </div>

      {/* Insights */}
      {result.insights.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Key Insights</h3>
          <div className="space-y-2">
            {result.insights.map((insight, i) => (
              <p key={i} className="text-slate-300 text-sm">{insight}</p>
            ))}
          </div>
        </div>
      )}

      {/* Error Types Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Error Types Distribution</h3>
          {result.errorTypes.length > 0 ? (
            <div className="space-y-3">
              {result.errorTypes.map((errorType) => (
                <div key={errorType.type} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 text-sm">{errorType.type}</span>
                      <span className="text-slate-400 text-xs">{errorType.count} errors in {errorType.sessions} sessions</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${Math.min(100, (errorType.count / (result.errorTypes[0]?.count || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="ml-4 text-slate-400 text-xs w-16 text-right">{errorType.percentageOfErrorSessions}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No API errors detected</p>
          )}
        </div>

        {/* Pie Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Error Type Proportion</h3>
          {result.errorTypes.length > 0 ? (
            <ErrorTypesPieChart errorTypes={result.errorTypes.slice(0, 8)} />
          ) : (
            <p className="text-slate-400 text-sm">No API errors detected</p>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      {result.trends.length > 1 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Error Rate Trend</h3>
          <TrendChart trends={result.trends} />
        </div>
      )}

      {/* Impact Analysis */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Impact on Outcomes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left py-3 px-4">Outcome</th>
                <th className="text-center py-3 px-4">Total</th>
                <th className="text-center py-3 px-4">With API Errors</th>
                <th className="text-center py-3 px-4">Without</th>
              </tr>
            </thead>
            <tbody>
              {result.impactAnalysis.map((impact) => (
                <tr key={impact.outcome} className="border-b border-slate-700/50">
                  <td className="py-3 px-4">
                    <OutcomeBadge outcome={impact.outcome} />
                  </td>
                  <td className="py-3 px-4 text-center text-slate-300">{impact.totalSessions}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={impact.withApiErrors > 0 ? 'text-rose-400' : 'text-slate-500'}>
                      {impact.withApiErrors}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-400">{impact.withoutApiErrors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Worst Affected Sessions */}
      {result.worstSessions.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Most Affected Sessions</h3>
          <div className="space-y-3">
            {result.worstSessions.slice(0, 5).map((session) => (
              <SessionCard key={session.sessionId} session={session} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recommendations</h3>
          <div className="space-y-4">
            {result.recommendations.map((rec, i) => (
              <div key={i} className={`p-4 rounded-lg border ${getRecommendationStyles(rec.type)}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${getRecommendationBadgeStyles(rec.type)}`}>
                    {rec.type.toUpperCase()}
                  </span>
                  <h4 className="text-white font-medium">{rec.title}</h4>
                </div>
                <p className="text-slate-300 text-sm mb-2">{rec.description}</p>
                <p className="text-slate-400 text-xs">{rec.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TrendChart({ trends }: { trends: IApiErrorTrend[] }) {
  const chartData = trends.map(t => ({
    date: t.date.slice(5), // MM-DD format
    errors: t.totalErrorCount,
    sessions: t.errorSessions
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
        <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} />
        <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#cbd5e1' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Legend wrapperStyle={{ color: '#94a3b8' }} />
        <Line yAxisId="left" type="monotone" dataKey="errors" stroke="#f43f5e" strokeWidth={2} name="Total Errors" />
        <Line yAxisId="right" type="monotone" dataKey="sessions" stroke="#f59e0b" strokeWidth={2} name="Error Sessions" />
      </LineChart>
    </ResponsiveContainer>
  )
}

function SessionCard({ session }: { session: IApiErrorSession }) {
  const outcomeStyles: Record<string, string> = {
    fully_achieved: 'bg-emerald-500/20 text-emerald-400',
    mostly_achieved: 'bg-indigo-500/20 text-indigo-400',
    partially_achieved: 'bg-amber-500/20 text-amber-400',
    not_achieved: 'bg-rose-500/20 text-rose-400',
    unclear_from_transcript: 'bg-slate-500/20 text-slate-400',
  }

  return (
    <div className="p-4 bg-slate-700/30 rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-slate-300 text-sm truncate">{session.goal}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded ${outcomeStyles[session.outcome] || outcomeStyles.unclear_from_transcript}`}>
              {session.outcome.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-500">{session.sessionType.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-rose-400">{session.totalErrors}</span>
          <p className="text-xs text-slate-500">errors</p>
        </div>
      </div>
      {session.errorTypes.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-3">
          {session.errorTypes.map((type) => (
            <span key={type} className="text-xs bg-rose-500/10 text-rose-400 px-2 py-1 rounded">
              {type}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const styles: Record<string, string> = {
    fully_achieved: 'bg-emerald-500/20 text-emerald-400',
    mostly_achieved: 'bg-indigo-500/20 text-indigo-400',
    partially_achieved: 'bg-amber-500/20 text-amber-400',
    not_achieved: 'bg-rose-500/20 text-rose-400',
    unclear_from_transcript: 'bg-slate-500/20 text-slate-400',
  }

  const labels: Record<string, string> = {
    fully_achieved: 'Fully Achieved',
    mostly_achieved: 'Mostly Achieved',
    partially_achieved: 'Partially',
    not_achieved: 'Not Achieved',
    unclear_from_transcript: 'Unclear',
  }

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${styles[outcome] || styles.unclear_from_transcript}`}>
      {labels[outcome] || outcome}
    </span>
  )
}

function getRecommendationStyles(type: string): string {
  switch (type) {
    case 'critical':
      return 'bg-rose-500/10 border-rose-500/30'
    case 'warning':
      return 'bg-amber-500/10 border-amber-500/30'
    default:
      return 'bg-blue-500/10 border-blue-500/30'
  }
}

function getRecommendationBadgeStyles(type: string): string {
  switch (type) {
    case 'critical':
      return 'bg-rose-500 text-white'
    case 'warning':
      return 'bg-amber-500 text-white'
    default:
      return 'bg-blue-500 text-white'
  }
}

function ErrorTypesPieChart({ errorTypes }: { errorTypes: Array<{ type: string; count: number }> }) {
  const COLORS = ['#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#14b8a6', '#f97316']

  const data = errorTypes.map((et, idx) => ({
    name: et.type.length > 20 ? et.type.slice(0, 20) + '...' : et.type,
    value: et.count,
    fullName: et.type
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
          outerRadius={90}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#cbd5e1' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
