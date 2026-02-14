import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useInsightsData, useOverviewData } from '@/hooks'
import { MetricCard } from '@/components/MetricCard'
import { PeriodSelector } from '@/components/PeriodSelector'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { OutcomeDonut } from '@/components/charts/OutcomeDonut'
import { FrictionBarChart } from '@/components/charts/FrictionBarChart'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

function usd(value: number | null): string {
  if (value === null) return '—'
  return `$${value.toFixed(2)}`
}

export function OverviewPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(14)

  const normalizedDays = days === 0 ? 30 : days

  const { data, loading, error, refetch } = useInsightsData(normalizedDays)
  const {
    data: overview,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useOverviewData(normalizedDays)

  const allSessions = useMemo(() => data.flatMap(d => d.sessions), [data])

  const sessionTrend = useMemo(() => {
    return [...data]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ date: d.date, value: d.sessions.length }))
  }, [data])

  const recentSessions = useMemo(() => {
    return [...allSessions]
      .sort((a, b) => b.session_id.localeCompare(a.session_id))
      .slice(0, 5)
      .map(s => ({
        id: s.session_id.slice(0, 8),
        goal: s.underlying_goal.slice(0, 60) + (s.underlying_goal.length > 60 ? '...' : ''),
        outcome: s.outcome,
        type: s.session_type,
      }))
  }, [allSessions])

  if (loading || overviewLoading) return <LoadingState />
  if (error || overviewError) {
    return <ErrorState message={error || overviewError || 'Unknown error'} onRetry={() => {
      refetch()
      refetchOverview()
    }} />
  }
  if (data.length === 0 || !overview) return <EmptyState />

  const kpis = overview.kpis

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('overview.title')}</h2>
          <p className="text-slate-400 text-sm mt-1">{t('overview.sessionsAcross', { count: allSessions.length, days: data.length })}</p>
          {days === 0 && (
            <p className="text-slate-500 text-xs mt-1">{t('overview.allPeriodFallback')}</p>
          )}
        </div>
        <PeriodSelector value={days} onChange={setDays} />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title={t('metrics.successRate')} value={percent(kpis.success_rate)} color="emerald" subtitle={t('metrics.fullyMostly')} />
        <MetricCard title={t('metrics.apiBlocked')} value={percent(kpis.api_error_session_rate)} color="rose" subtitle={t('metrics.sessionsWithApiErrors')} />
        <MetricCard title={t('metrics.contextOverflow')} value={percent(kpis.context_overflow_rate)} color="amber" subtitle={t('metrics.requiredRework')} />
        <MetricCard title={t('metrics.estimatedCost')} value={usd(kpis.estimated_cost_usd)} color="indigo" subtitle="USD" />
        <MetricCard title={t('metrics.costPerSuccess')} value={usd(kpis.cost_per_success)} color="slate" subtitle="USD" />
        <MetricCard title={t('metrics.iterativeRefinement')} value={percent(kpis.iterative_refinement_share)} color="indigo" subtitle={t('common.sessions')} />
      </div>

      {/* Efficiency Summary */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('overview.efficiencySummary')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <MetricCard title={t('overview.avg')} value={kpis.efficiency.summary.average_score} color="indigo" />
          <MetricCard title={t('overview.median')} value={kpis.efficiency.summary.median_score} color="emerald" />
          <MetricCard title={t('overview.p90')} value={kpis.efficiency.summary.p90_score} color="amber" />
        </div>
        {kpis.efficiency.distribution.length > 0 && (
          <div className="space-y-2">
            {kpis.efficiency.distribution.map((bucket) => (
              <div key={bucket.bucket} className="flex items-center justify-between text-sm text-slate-300">
                <span>{bucket.bucket}</span>
                <span>{bucket.count} ({percent(bucket.share)})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('overview.dailySessions')}</h3>
          <TrendLineChart data={sessionTrend} label={t('common.sessions')} />
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('overview.outcomes')}</h3>
          <OutcomeDonut sessions={allSessions} />
        </div>
      </div>

      {/* Friction Chart */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('overview.frictionPoints')}</h3>
        <FrictionBarChart sessions={allSessions} />
      </div>

      {/* Recent Sessions */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('overview.recentSessions')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left py-3 px-4">{t('overview.id')}</th>
                <th className="text-left py-3 px-4">{t('overview.goal')}</th>
                <th className="text-left py-3 px-4">{t('overview.outcome')}</th>
                <th className="text-left py-3 px-4">{t('overview.type')}</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-3 px-4 font-mono text-slate-300">{s.id}</td>
                  <td className="py-3 px-4 text-slate-300">{s.goal}</td>
                  <td className="py-3 px-4">
                    <OutcomeBadge outcome={s.outcome} />
                  </td>
                  <td className="py-3 px-4 text-slate-400">{s.type.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const { t } = useTranslation()
  const styles: Record<string, string> = {
    fully_achieved: 'bg-emerald-500/20 text-emerald-400',
    mostly_achieved: 'bg-indigo-500/20 text-indigo-400',
    partially_achieved: 'bg-amber-500/20 text-amber-400',
    not_achieved: 'bg-rose-500/20 text-rose-400',
    unclear_from_transcript: 'bg-slate-500/20 text-slate-400',
  }
  const labels: Record<string, string> = {
    fully_achieved: t('outcomes.fully'),
    mostly_achieved: t('outcomes.mostly'),
    partially_achieved: t('outcomes.partial'),
    not_achieved: t('outcomes.failed'),
    unclear_from_transcript: t('outcomes.unclear_from_transcript'),
  }
  return (
    <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${styles[outcome] || styles.unclear_from_transcript}`}>
      {labels[outcome] || outcome}
    </span>
  )
}
