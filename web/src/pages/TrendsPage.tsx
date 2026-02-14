import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInsightsData, useTrends } from '@/hooks'
import { PeriodSelector } from '@/components/PeriodSelector'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'

const TREND_ICONS: Record<string, string> = {
  increasing: '↑',
  decreasing: '↓',
  stable: '→',
}

function getTrendColor(metric: string, t: (key: string) => string): string {
  const normalized = metric.toLowerCase()

  if (
    normalized === t('trends.dailySessions').toLowerCase() ||
    normalized.includes('daily') ||
    normalized.includes('session')
  ) {
    return '#6366f1'
  }

  if (
    normalized === t('trends.successRate').toLowerCase() ||
    normalized.includes('success')
  ) {
    return '#10b981'
  }

  if (
    normalized === t('trends.apiBlockedRate').toLowerCase() ||
    normalized.includes('api')
  ) {
    return '#ef4444'
  }

  return '#6366f1'
}

export function TrendsPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(30)
  const { data, loading, error, refetch } = useInsightsData(days)
  const result = useTrends(data)

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (data.length === 0) return <EmptyState />

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('trends.title')}</h2>
          <p className="text-slate-400 text-sm mt-1">
            {t('trends.dateRange', { start: result?.dateRange.start, end: result?.dateRange.end })}
          </p>
        </div>
        <PeriodSelector value={days} onChange={setDays} />
      </div>

      {/* Trend Charts */}
      {result?.trends.map((trend) => (
        <div key={trend.metric} className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{trend.metric}</h3>
              <p className="text-sm text-slate-400 mt-1">{trend.insight}</p>
            </div>
            <div className="flex items-center gap-2">
              <span>{TREND_ICONS[trend.trend]}</span>
              <span className={`text-sm font-medium ${
                trend.trend === 'increasing' ? 'text-emerald-400' :
                trend.trend === 'decreasing' ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {trend.changePercentage > 0 ? '+' : ''}{trend.changePercentage}%
              </span>
            </div>
          </div>
          <TrendLineChart
            data={trend.dataPoints}
            color={getTrendColor(trend.metric, t)}
            label={trend.metric}
            valueFormatter={trend.metric === t('trends.successRate') || trend.metric === t('trends.apiBlockedRate')
              ? (v) => `${v}%`
              : undefined
            }
          />
        </div>
      ))}

      {/* Key Insights */}
      {result?.insights && result.insights.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('trends.keyInsights')}</h3>
          <div className="space-y-3">
            {result.insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="text-indigo-400">•</span>
                <p>{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
