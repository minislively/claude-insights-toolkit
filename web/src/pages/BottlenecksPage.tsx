import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInsightsData, useBottlenecks } from '@/hooks'
import { PeriodSelector } from '@/components/PeriodSelector'
import { MetricCard } from '@/components/MetricCard'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'
import type { IBottleneckPattern } from '@/lib/analyzers'

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-rose-500 bg-rose-500/10',
  high: 'border-amber-500 bg-amber-500/10',
  medium: 'border-indigo-500 bg-indigo-500/10',
  low: 'border-slate-500 bg-slate-500/10',
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-500/20 text-rose-400',
  high: 'bg-amber-500/20 text-amber-400',
  medium: 'bg-indigo-500/20 text-indigo-400',
  low: 'bg-slate-500/20 text-slate-400',
}

export function BottlenecksPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(14)
  const { data, loading, error, refetch } = useInsightsData(days)
  const result = useBottlenecks(data)

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (data.length === 0) return <EmptyState />

  const metrics = result?.metrics

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('bottlenecks.title')}</h2>
          <p className="text-slate-400 text-sm mt-1">{t('bottlenecks.subtitle')}</p>
        </div>
        <PeriodSelector value={days} onChange={setDays} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title={t('metrics.successRate')} value={`${metrics?.successRate ?? 0}%`} color="emerald" />
        <MetricCard title={t('metrics.apiBlocked')} value={`${metrics?.apiBlockedRate ?? 0}%`} color="rose" />
        <MetricCard title={t('metrics.wrongApproach')} value={`${metrics?.wrongApproachRate ?? 0}%`} color="amber" />
        <MetricCard title={t('metrics.contextOverflow')} value={`${metrics?.contextOverflowRate ?? 0}%`} color="indigo" />
      </div>

      {/* Patterns */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">{t('bottlenecks.detectedPatterns')}</h3>
        {result?.patterns && result.patterns.length > 0 ? (
          <div className="space-y-4">
            {result.patterns.map((p, i) => (
              <PatternCard key={i} pattern={p} />
            ))}
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center text-slate-400">
            {t('bottlenecks.noPatterns')}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {result?.recommendations && result.recommendations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">{t('bottlenecks.recommendations')}</h3>
          <div className="space-y-3">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="bg-slate-800 rounded-xl border border-indigo-500/30 p-6">
                <div className="flex items-start gap-3">
                  <span className="text-indigo-400 text-lg">💡</span>
                  <p className="text-slate-300 text-sm">{rec}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PatternCard({ pattern: p }: { pattern: IBottleneckPattern }) {
  const { t } = useTranslation()
  return (
    <div className={`rounded-xl border-l-4 border p-6 bg-slate-800 ${SEVERITY_STYLES[p.severity]}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-white">{p.pattern}</h4>
        <span className={`px-2 py-1 rounded text-xs font-medium ${SEVERITY_BADGE[p.severity]}`}>
          {t(`severity.${p.severity}`)}
        </span>
      </div>
      <p className="text-slate-300 text-sm mb-3">{p.description}</p>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>{p.affectedCount} {t('bottlenecks.sessionsAffected')}</span>
        <span>{p.affectedPercentage}% {t('bottlenecks.ofTotal')}</span>
      </div>
    </div>
  )
}
