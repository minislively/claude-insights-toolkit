import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useInsightsData } from '@/hooks'
import { PeriodSelector } from '@/components/PeriodSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'
import { MetricCard } from '@/components/MetricCard'
import { analyzeProductivity, getHelpfulnessScore, getSatisfactionRatio } from '@/lib/analyzers'
import type { IHelpfulnessCorrelation } from '@shared/analyzers/productivity'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

export function HelpfulnessPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(14)
  const { data, loading, error, refetch } = useInsightsData(days)

  const result = useMemo(() => {
    if (data.length === 0) return null
    return analyzeProductivity(data)
  }, [data])

  const satisfactionData = useMemo(() => {
    if (data.length === 0) return null
    return analyzeSatisfactionCorrelation(data)
  }, [data])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (data.length === 0) return <EmptyState />
  if (!result || !satisfactionData) return <EmptyState />

  const veryHelpfulRate = result.helpfulnessDistribution.find(h => h.name === 'very_helpful')?.value || 0
  const veryHelpfulPercentage = Math.round((veryHelpfulRate / result.metrics.totalSessions) * 100)

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Helpfulness & Performance</h2>
          <p className="text-slate-400 text-sm mt-1">{result.summary}</p>
        </div>
        <PeriodSelector value={days} onChange={setDays} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Avg Helpfulness"
          value={`${result.metrics.avgHelpfulnessScore}/4`}
          color={result.metrics.avgHelpfulnessScore >= 3 ? 'emerald' : result.metrics.avgHelpfulnessScore >= 2.5 ? 'amber' : 'rose'}
          subtitle="across all sessions"
        />
        <MetricCard
          title="Very Helpful Rate"
          value={`${veryHelpfulPercentage}%`}
          color={veryHelpfulPercentage >= 60 ? 'emerald' : veryHelpfulPercentage >= 40 ? 'amber' : 'rose'}
          subtitle={`${veryHelpfulRate} sessions`}
        />
        <MetricCard
          title="Satisfaction Ratio"
          value={`${result.metrics.satisfactionRatio}%`}
          color={result.metrics.satisfactionRatio >= 70 ? 'emerald' : result.metrics.satisfactionRatio >= 50 ? 'amber' : 'rose'}
          subtitle="satisfied vs dissatisfied"
        />
        <MetricCard
          title="Correlation Strength"
          value={satisfactionData.correlationStrength}
          color={satisfactionData.correlationStrength === 'Strong' ? 'emerald' : satisfactionData.correlationStrength === 'Moderate' ? 'amber' : 'indigo'}
          subtitle="helpfulness vs outcome"
        />
      </div>

      {/* Helpfulness Distribution */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Helpfulness Distribution</h3>
        <div className="space-y-3">
          {result.helpfulnessDistribution.map((item) => {
            const percentage = Math.round((item.value / result.metrics.totalSessions) * 100)
            const score = getHelpfulnessScore(item.name)
            const colorClass = score >= 4 ? 'bg-emerald-500' : score >= 3 ? 'bg-indigo-500' : score >= 2 ? 'bg-amber-500' : 'bg-rose-500'

            return (
              <div key={item.name} className="flex items-center gap-4">
                <div className="w-32 text-slate-300 text-sm capitalize">
                  {item.name.replace(/_/g, ' ')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 text-xs">{item.value} sessions</span>
                    <span className="text-slate-400 text-xs">{percentage}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colorClass} rounded-full`}
                      style={{ width: `${Math.max(percentage, 4)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Helpfulness vs Outcome Correlation */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Helpfulness vs Outcome Correlation</h3>
        <HelpfulnessScatterChart correlations={result.helpfulnessCorrelation} />
        <div className="overflow-x-auto mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left py-3 px-4">Helpfulness</th>
                <th className="text-center py-3 px-4">Sessions</th>
                <th className="text-center py-3 px-4">Success Rate</th>
                <th className="text-center py-3 px-4">Avg Satisfaction</th>
              </tr>
            </thead>
            <tbody>
              {result.helpfulnessCorrelation.map((row) => (
                <tr key={row.helpfulness} className="border-b border-slate-700/50">
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getHelpfulnessBadgeStyle(row.helpfulness)}`}>
                      {row.helpfulness.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-300">{row.total}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`font-medium ${row.successRate >= 70 ? 'text-emerald-400' : row.successRate >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {row.successRate}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-300">
                    {row.avgSatisfactionRatio.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Satisfaction Distribution */}
      {result.hasSatisfactionData && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">User Satisfaction Distribution</h3>
          <div className="space-y-3">
            {result.satisfactionDistribution.map((item) => {
              const totalSatisfaction = result.satisfactionDistribution.reduce((sum, i) => sum + i.value, 0)
              const percentage = totalSatisfaction > 0 ? Math.round((item.value / totalSatisfaction) * 100) : 0
              const colorClass = item.name.includes('satisfied') && !item.name.includes('dis')
                ? 'bg-emerald-500'
                : item.name.includes('frustrated') || item.name.includes('dis')
                ? 'bg-rose-500'
                : 'bg-indigo-500'

              return (
                <div key={item.name} className="flex items-center gap-4">
                  <div className="w-32 text-slate-300 text-sm capitalize">
                    {item.name.replace(/_/g, ' ')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-400 text-xs">{item.value} mentions</span>
                      <span className="text-slate-400 text-xs">{percentage}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colorClass} rounded-full`}
                        style={{ width: `${Math.max(percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Satisfaction vs Outcome */}
      {satisfactionData.satisfactionByOutcome.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Satisfaction by Outcome</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-3 px-4">Outcome</th>
                  <th className="text-center py-3 px-4">Avg Satisfaction</th>
                  <th className="text-center py-3 px-4">Satisfied %</th>
                  <th className="text-center py-3 px-4">Frustrated %</th>
                </tr>
              </thead>
              <tbody>
                {satisfactionData.satisfactionByOutcome.map((row) => (
                  <tr key={row.outcome} className="border-b border-slate-700/50">
                    <td className="py-3 px-4">
                      <OutcomeBadge outcome={row.outcome} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-medium ${row.avgSatisfaction >= 0.7 ? 'text-emerald-400' : row.avgSatisfaction >= 0.5 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {(row.avgSatisfaction * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">
                      {(row.satisfiedRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">
                      {(row.frustratedRate * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insights */}
      {satisfactionData.insights.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Key Insights</h3>
          <div className="space-y-2">
            {satisfactionData.insights.map((insight, i) => (
              <p key={i} className="text-slate-300 text-sm">{insight}</p>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.filter(r => r.type === 'weakness' || r.type === 'opportunity').length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recommendations</h3>
          <div className="space-y-4">
            {result.recommendations
              .filter(r => r.type === 'weakness' || r.type === 'opportunity')
              .slice(0, 5)
              .map((rec, i) => (
                <div key={i} className={`p-4 rounded-lg border ${rec.type === 'weakness' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${rec.type === 'weakness' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'}`}>
                      {rec.type.toUpperCase()}
                    </span>
                    <h4 className="text-white font-medium">{rec.title}</h4>
                  </div>
                  <p className="text-slate-300 text-sm">{rec.description}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getHelpfulnessBadgeStyle(helpfulness: string): string {
  const styles: Record<string, string> = {
    very_helpful: 'bg-emerald-500/20 text-emerald-400',
    moderately_helpful: 'bg-indigo-500/20 text-indigo-400',
    slightly_helpful: 'bg-amber-500/20 text-amber-400',
    unhelpful: 'bg-rose-500/20 text-rose-400',
  }
  return styles[helpfulness] || 'bg-slate-500/20 text-slate-400'
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

// Additional analyzer for satisfaction correlation
interface ISatisfactionByOutcome {
  outcome: string
  avgSatisfaction: number
  satisfiedRate: number
  frustratedRate: number
  totalSessions: number
}

interface ISatisfactionData {
  correlationStrength: string
  satisfactionByOutcome: ISatisfactionByOutcome[]
  insights: string[]
}

function analyzeSatisfactionCorrelation(data: import('@/types').IInsightsDay[]): ISatisfactionData {
  const allSessions = data.flatMap(d => d.sessions)

  // Group by outcome
  const outcomeGroups = new Map<string, typeof allSessions>()
  allSessions.forEach(s => {
    if (!outcomeGroups.has(s.outcome)) {
      outcomeGroups.set(s.outcome, [])
    }
    outcomeGroups.get(s.outcome)!.push(s)
  })

  const satisfactionByOutcome: ISatisfactionByOutcome[] = Array.from(outcomeGroups.entries())
    .map(([outcome, sessions]) => {
      const totalSatisfaction = sessions.reduce((sum, s) => sum + getSatisfactionRatio(s.user_satisfaction_counts), 0)
      const avgSatisfaction = totalSatisfaction / sessions.length

      const satisfiedCount = sessions.filter(s => {
        const counts = s.user_satisfaction_counts
        return (counts.satisfied || 0) + (counts.likely_satisfied || 0) > (counts.dissatisfied || 0) + (counts.frustrated || 0)
      }).length

      const frustratedCount = sessions.filter(s => {
        const counts = s.user_satisfaction_counts
        return (counts.frustrated || 0) > 0
      }).length

      return {
        outcome,
        avgSatisfaction,
        satisfiedRate: satisfiedCount / sessions.length,
        frustratedRate: frustratedCount / sessions.length,
        totalSessions: sessions.length,
      }
    })
    .sort((a, b) => b.avgSatisfaction - a.avgSatisfaction)

  // Calculate correlation strength
  const successfulOutcomes = satisfactionByOutcome.filter(o =>
    o.outcome === 'fully_achieved' || o.outcome === 'mostly_achieved'
  )
  const failedOutcomes = satisfactionByOutcome.filter(o =>
    o.outcome === 'not_achieved' || o.outcome === 'partially_achieved'
  )

  const avgSuccessSatisfaction = successfulOutcomes.reduce((sum, o) => sum + o.avgSatisfaction, 0) / (successfulOutcomes.length || 1)
  const avgFailedSatisfaction = failedOutcomes.reduce((sum, o) => sum + o.avgSatisfaction, 0) / (failedOutcomes.length || 1)

  const satisfactionGap = avgSuccessSatisfaction - avgFailedSatisfaction
  const correlationStrength = satisfactionGap > 0.3 ? 'Strong' : satisfactionGap > 0.15 ? 'Moderate' : 'Weak'

  // Generate insights
  const insights: string[] = []

  if (satisfactionGap > 0.3) {
    insights.push(`Strong correlation between outcome and satisfaction: successful sessions have ${(satisfactionGap * 100).toFixed(0)}% higher satisfaction`)
  }

  const frustratedInSuccess = successfulOutcomes.reduce((sum, o) => sum + o.frustratedRate, 0) / (successfulOutcomes.length || 1)
  if (frustratedInSuccess > 0.1) {
    insights.push(`${(frustratedInSuccess * 100).toFixed(0)}% of successful sessions still show frustration - review for process improvements`)
  }

  const lowSatisfactionHighSuccess = satisfactionByOutcome.find(o =>
    (o.outcome === 'fully_achieved' || o.outcome === 'mostly_achieved') && o.avgSatisfaction < 0.5
  )
  if (lowSatisfactionHighSuccess) {
    insights.push(`Some successful sessions have low satisfaction - users may be working around limitations`)
  }

  return {
    correlationStrength,
    satisfactionByOutcome,
    insights,
  }
}

function HelpfulnessScatterChart({ correlations }: { correlations: IHelpfulnessCorrelation[] }) {
  const helpfulnessScoreMap: Record<string, number> = {
    'very_unhelpful': 0,
    'unhelpful': 1,
    'somewhat_helpful': 2,
    'helpful': 3,
    'very_helpful': 4
  }

  const chartData = correlations.map(c => ({
    name: c.helpfulness.replace(/_/g, ' '),
    x: helpfulnessScoreMap[c.helpfulness] || 0,
    y: c.successRate,
    z: c.total, // Size represents number of sessions
    satisfaction: c.avgSatisfactionRatio
  }))

  const COLORS: Record<number, string> = {
    0: '#f43f5e', // very unhelpful - rose
    1: '#f59e0b', // unhelpful - amber
    2: '#6366f1', // somewhat helpful - indigo
    3: '#10b981', // helpful - emerald
    4: '#059669'  // very helpful - dark emerald
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          type="number"
          dataKey="x"
          name="Helpfulness"
          domain={[0, 4]}
          ticks={[0, 1, 2, 3, 4]}
          tickFormatter={(value) => ['Very\nUnhelpful', 'Unhelpful', 'Somewhat', 'Helpful', 'Very\nHelpful'][value] || ''}
          stroke="#94a3b8"
          fontSize={10}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Success Rate"
          unit="%"
          stroke="#94a3b8"
          fontSize={12}
          domain={[0, 100]}
        />
        <ZAxis type="number" dataKey="z" range={[50, 400]} name="Sessions" />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#cbd5e1' }}
          itemStyle={{ color: '#e2e8f0' }}
          formatter={(value: any, name?: string) => {
            if (name === 'Success Rate') return [`${value}%`, name]
            if (name === 'Sessions') return [value, name || '']
            return [value, name || '']
          }}
        />
        <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
        <Scatter name="Helpfulness → Success" data={chartData}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[entry.x] || '#6366f1'} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}
