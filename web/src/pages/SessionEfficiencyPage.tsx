import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useInsightsData } from '@/hooks'
import { PeriodSelector } from '@/components/PeriodSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'
import { MetricCard } from '@/components/MetricCard'
import type { IInsightsDay, ISessionFacet } from '@/types'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

interface IEfficiencyResult {
  summary: string
  generatedAt: string
  metrics: {
    totalSessions: number
    avgIterations: number
    highIterationSessions: number
    highIterationRate: number
    excessiveChangesSessions: number
    excessiveChangesRate: number
    inefficientSessions: number
    inefficientRate: number
  }
  inefficientSessions: IInefficientSession[]
  iterationDistribution: Array<{ range: string; count: number; percentage: number }>
  insights: string[]
  recommendations: IRecommendation[]
}

interface IInefficientSession {
  sessionId: string
  goal: string
  outcome: string
  iterationCount: number
  hasExcessiveChanges: boolean
  frictionTypes: string[]
  inefficiencyScore: number
}

interface IRecommendation {
  type: 'critical' | 'warning' | 'info'
  title: string
  description: string
  action: string
}

export function SessionEfficiencyPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(14)
  const { data, loading, error, refetch } = useInsightsData(days)

  const result = useMemo(() => {
    if (data.length === 0) return null
    return analyzeSessionEfficiency(data)
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
          <h2 className="text-2xl font-bold text-white">Session Efficiency</h2>
          <p className="text-slate-400 text-sm mt-1">{result.summary}</p>
        </div>
        <PeriodSelector value={days} onChange={setDays} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Avg Iterations"
          value={result.metrics.avgIterations.toFixed(1)}
          color="indigo"
          subtitle="per session"
        />
        <MetricCard
          title="High Iteration"
          value={`${result.metrics.highIterationRate}%`}
          color={result.metrics.highIterationRate > 30 ? 'rose' : result.metrics.highIterationRate > 15 ? 'amber' : 'emerald'}
          subtitle={`${result.metrics.highIterationSessions} sessions`}
        />
        <MetricCard
          title="Excessive Changes"
          value={`${result.metrics.excessiveChangesRate}%`}
          color={result.metrics.excessiveChangesRate > 20 ? 'rose' : result.metrics.excessiveChangesRate > 10 ? 'amber' : 'emerald'}
          subtitle={`${result.metrics.excessiveChangesSessions} sessions`}
        />
        <MetricCard
          title="Inefficient"
          value={`${result.metrics.inefficientRate}%`}
          color={result.metrics.inefficientRate > 25 ? 'rose' : result.metrics.inefficientRate > 12 ? 'amber' : 'emerald'}
          subtitle={`${result.metrics.inefficientSessions} sessions`}
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

      {/* Iteration Distribution */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Iteration Count Distribution</h3>
        <IterationDistributionChart distribution={result.iterationDistribution} />
      </div>

      {/* Inefficient Sessions */}
      {result.inefficientSessions.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Most Inefficient Sessions</h3>
          <div className="space-y-3">
            {result.inefficientSessions.slice(0, 10).map((session) => (
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

function SessionCard({ session }: { session: IInefficientSession }) {
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
            {session.hasExcessiveChanges && (
              <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded">
                excessive changes
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-amber-400">{session.iterationCount}</span>
          <p className="text-xs text-slate-500">iterations</p>
        </div>
      </div>
      {session.frictionTypes.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-3">
          {session.frictionTypes.map((type) => (
            <span key={type} className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded">
              {type.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
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

// Analyzer function
function analyzeSessionEfficiency(data: IInsightsDay[]): IEfficiencyResult {
  const allSessions = data.flatMap(d => d.sessions)
  const total = allSessions.length

  if (total === 0) {
    return {
      summary: 'No sessions to analyze',
      generatedAt: new Date().toISOString(),
      metrics: {
        totalSessions: 0,
        avgIterations: 0,
        highIterationSessions: 0,
        highIterationRate: 0,
        excessiveChangesSessions: 0,
        excessiveChangesRate: 0,
        inefficientSessions: 0,
        inefficientRate: 0,
      },
      inefficientSessions: [],
      iterationDistribution: [],
      insights: [],
      recommendations: [],
    }
  }

  // Calculate iteration counts (estimate from friction counts)
  const sessionsWithIterations = allSessions.map(session => {
    const frictionCount = Object.values(session.friction_counts).reduce((sum, count) => sum + count, 0)
    // Estimate iterations based on friction + some base amount
    const estimatedIterations = Math.max(1, Math.round(frictionCount * 0.5 + 2))
    const hasExcessiveChanges = frictionCount > 10 || session.friction_counts.wrong_approach > 2

    const frictionTypes = Object.entries(session.friction_counts)
      .filter(([, count]) => count > 0)
      .map(([type]) => type)

    // Inefficiency score: higher iterations + excessive changes + failed outcome
    let inefficiencyScore = estimatedIterations
    if (hasExcessiveChanges) inefficiencyScore += 5
    if (session.outcome === 'not_achieved') inefficiencyScore += 3
    if (session.outcome === 'partially_achieved') inefficiencyScore += 1

    return {
      sessionId: session.session_id,
      goal: session.underlying_goal.slice(0, 100),
      outcome: session.outcome,
      iterationCount: estimatedIterations,
      hasExcessiveChanges,
      frictionTypes,
      inefficiencyScore,
    }
  })

  // Calculate metrics
  const totalIterations = sessionsWithIterations.reduce((sum, s) => sum + s.iterationCount, 0)
  const avgIterations = totalIterations / total

  const highIterationSessions = sessionsWithIterations.filter(s => s.iterationCount >= 7)
  const highIterationRate = Math.round((highIterationSessions.length / total) * 100)

  const excessiveChangesSessions = sessionsWithIterations.filter(s => s.hasExcessiveChanges)
  const excessiveChangesRate = Math.round((excessiveChangesSessions.length / total) * 100)

  const inefficientSessions = sessionsWithIterations
    .filter(s => s.inefficiencyScore >= 8)
    .sort((a, b) => b.inefficiencyScore - a.inefficiencyScore)

  const inefficientRate = Math.round((inefficientSessions.length / total) * 100)

  // Iteration distribution
  const ranges = [
    { range: '1-3 iterations', min: 1, max: 3 },
    { range: '4-6 iterations', min: 4, max: 6 },
    { range: '7-9 iterations', min: 7, max: 9 },
    { range: '10+ iterations', min: 10, max: Infinity },
  ]

  const iterationDistribution = ranges.map(r => {
    const count = sessionsWithIterations.filter(s => s.iterationCount >= r.min && s.iterationCount <= r.max).length
    return {
      range: r.range,
      count,
      percentage: Math.round((count / total) * 100),
    }
  })

  // Generate insights
  const insights: string[] = []

  if (highIterationRate > 30) {
    insights.push(`${highIterationRate}% of sessions have high iteration counts (7+), indicating potential workflow inefficiencies`)
  }

  if (excessiveChangesRate > 20) {
    insights.push(`${excessiveChangesRate}% of sessions show excessive changes patterns, suggesting unclear requirements or wrong approaches`)
  }

  const avgIterationsInsight = avgIterations > 6
    ? `Average of ${avgIterations.toFixed(1)} iterations per session is high - consider more upfront planning`
    : avgIterations < 4
    ? `Average of ${avgIterations.toFixed(1)} iterations per session indicates efficient workflows`
    : null

  if (avgIterationsInsight) {
    insights.push(avgIterationsInsight)
  }

  // Generate recommendations
  const recommendations: IRecommendation[] = []

  if (highIterationRate > 25) {
    recommendations.push({
      type: 'critical',
      title: 'High Iteration Rate',
      description: `${highIterationRate}% of sessions require 7+ iterations`,
      action: 'Add upfront planning requirements to CLAUDE.md: require goal clarification before implementation',
    })
  }

  if (excessiveChangesRate > 15) {
    recommendations.push({
      type: 'warning',
      title: 'Excessive Changes Pattern',
      description: `${excessiveChangesRate}% of sessions show excessive back-and-forth`,
      action: 'Implement checkpoint pattern: verify approach every 3 iterations before continuing',
    })
  }

  if (inefficientRate > 20) {
    recommendations.push({
      type: 'warning',
      title: 'Inefficient Sessions',
      description: `${inefficientRate}% of sessions are marked as inefficient`,
      action: 'Review CLAUDE.md for missing context about project patterns and constraints',
    })
  }

  const summary = `Analyzed ${total} sessions: avg ${avgIterations.toFixed(1)} iterations, ${highIterationRate}% high iteration, ${inefficientRate}% inefficient`

  return {
    summary,
    generatedAt: new Date().toISOString(),
    metrics: {
      totalSessions: total,
      avgIterations,
      highIterationSessions: highIterationSessions.length,
      highIterationRate,
      excessiveChangesSessions: excessiveChangesSessions.length,
      excessiveChangesRate,
      inefficientSessions: inefficientSessions.length,
      inefficientRate,
    },
    inefficientSessions,
    iterationDistribution,
    insights,
    recommendations,
  }
}

function IterationDistributionChart({ distribution }: { distribution: Array<{ range: string; count: number; percentage: number }> }) {
  const chartData = distribution.map(d => ({
    range: d.range,
    count: d.count,
    percentage: d.percentage
  }))

  const getBarColor = (range: string) => {
    if (range.includes('10+')) return '#f43f5e' // rose - inefficient
    if (range.includes('7-9')) return '#f59e0b' // amber - concerning
    if (range.includes('4-6')) return '#6366f1' // indigo - moderate
    return '#10b981' // emerald - efficient
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="range" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} label={{ value: 'Sessions', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#cbd5e1' }}
          itemStyle={{ color: '#e2e8f0' }}
          formatter={(value: any, name?: string) => [value, name === 'count' ? 'Sessions' : (name || '')]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
