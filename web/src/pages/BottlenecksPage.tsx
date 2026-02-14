import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInsightsData, useBottlenecks } from '@/hooks'
import { PeriodSelector } from '@/components/PeriodSelector'
import { MetricCard } from '@/components/MetricCard'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'
import type { IBottleneckPattern } from '@/lib/analyzers'

type LoopStatus = 'idle' | 'running' | 'success' | 'error'

interface LoopRunArtifacts {
  runId: string
  generatedAt: string
  issueKeys: string[]
  patternKeys: string[]
  recommendationTitles: string[]
  patternSignature: string
  recommendationSignature: string
  artifactDir?: string
  metrics: {
    totalSessions: number
    successRate: number
    apiBlockedRate: number
    wrongApproachRate: number
    contextOverflowRate: number
  }
}

interface LoopSummary {
  patternsDetected: number
  recommendations: number
  issueLedgerDelta?: {
    added: number
    resolved: number
    reactivated: number
    updated: number
  }
  compare?: {
    deltas: {
      patternsDetected: number
      recommendations: number
      issueLedger: {
        added: number
        resolved: number
        reactivated: number
        updated: number
      }
    }
    improvements: string[]
    regressions: string[]
  }
  runArtifacts?: LoopRunArtifacts
  applyResult?: {
    target: string
    created: boolean
    replaced: boolean
    backupPath?: string
  }
}

interface LoopHistoryEntry {
  at: string
  days: number
  summary: LoopSummary
}

interface LoopTrend {
  improved: string[]
  regressed: string[]
}

const LOOP_HISTORY_KEY = 'cit.improveLoop.history.v1'
const LOOP_HISTORY_MAX = 20

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

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((value): value is string => typeof value === 'string')
}

function normalizeLoopSummary(input: unknown): LoopSummary | null {
  if (!input || typeof input !== 'object') return null
  const summary = input as Record<string, unknown>

  if (typeof summary.patternsDetected !== 'number' || typeof summary.recommendations !== 'number') {
    return null
  }

  const normalized: LoopSummary = {
    patternsDetected: summary.patternsDetected,
    recommendations: summary.recommendations,
  }

  if (summary.issueLedgerDelta && typeof summary.issueLedgerDelta === 'object') {
    const delta = summary.issueLedgerDelta as Record<string, unknown>
    normalized.issueLedgerDelta = {
      added: typeof delta.added === 'number' ? delta.added : 0,
      resolved: typeof delta.resolved === 'number' ? delta.resolved : 0,
      reactivated: typeof delta.reactivated === 'number' ? delta.reactivated : 0,
      updated: typeof delta.updated === 'number' ? delta.updated : 0,
    }
  }

  if (summary.applyResult && typeof summary.applyResult === 'object') {
    const apply = summary.applyResult as Record<string, unknown>
    if (typeof apply.target === 'string' && typeof apply.created === 'boolean' && typeof apply.replaced === 'boolean') {
      normalized.applyResult = {
        target: apply.target,
        created: apply.created,
        replaced: apply.replaced,
        backupPath: typeof apply.backupPath === 'string' ? apply.backupPath : undefined,
      }
    }
  }

  if (summary.runArtifacts && typeof summary.runArtifacts === 'object') {
    const artifacts = summary.runArtifacts as Record<string, unknown>
    const metrics = artifacts.metrics && typeof artifacts.metrics === 'object'
      ? artifacts.metrics as Record<string, unknown>
      : null

    if (typeof artifacts.runId === 'string' && typeof artifacts.generatedAt === 'string' && metrics) {
      normalized.runArtifacts = {
        runId: artifacts.runId,
        generatedAt: artifacts.generatedAt,
        issueKeys: toStringArray(artifacts.issueKeys),
        patternKeys: toStringArray(artifacts.patternKeys),
        recommendationTitles: toStringArray(artifacts.recommendationTitles),
        patternSignature: typeof artifacts.patternSignature === 'string' ? artifacts.patternSignature : '',
        recommendationSignature: typeof artifacts.recommendationSignature === 'string' ? artifacts.recommendationSignature : '',
        artifactDir: typeof artifacts.artifactDir === 'string' ? artifacts.artifactDir : undefined,
        metrics: {
          totalSessions: typeof metrics.totalSessions === 'number' ? metrics.totalSessions : 0,
          successRate: typeof metrics.successRate === 'number' ? metrics.successRate : 0,
          apiBlockedRate: typeof metrics.apiBlockedRate === 'number' ? metrics.apiBlockedRate : 0,
          wrongApproachRate: typeof metrics.wrongApproachRate === 'number' ? metrics.wrongApproachRate : 0,
          contextOverflowRate: typeof metrics.contextOverflowRate === 'number' ? metrics.contextOverflowRate : 0,
        },
      }
    }
  }

  return normalized
}

function compareRuns(current: LoopSummary, previous: LoopSummary | undefined): LoopTrend {
  if (!previous) return { improved: [], regressed: [] }

  const improved: string[] = []
  const regressed: string[] = []

  if (current.patternsDetected < previous.patternsDetected) improved.push('patterns')
  if (current.patternsDetected > previous.patternsDetected) regressed.push('patterns')

  if (current.recommendations < previous.recommendations) improved.push('recommendations')
  if (current.recommendations > previous.recommendations) regressed.push('recommendations')

  if (current.runArtifacts && previous.runArtifacts) {
    const curMetrics = current.runArtifacts.metrics
    const prevMetrics = previous.runArtifacts.metrics

    if (curMetrics.successRate > prevMetrics.successRate) improved.push('success_rate')
    if (curMetrics.successRate < prevMetrics.successRate) regressed.push('success_rate')

    if (curMetrics.apiBlockedRate < prevMetrics.apiBlockedRate) improved.push('api_blocked_rate')
    if (curMetrics.apiBlockedRate > prevMetrics.apiBlockedRate) regressed.push('api_blocked_rate')

    if (curMetrics.wrongApproachRate < prevMetrics.wrongApproachRate) improved.push('wrong_approach_rate')
    if (curMetrics.wrongApproachRate > prevMetrics.wrongApproachRate) regressed.push('wrong_approach_rate')

    if (curMetrics.contextOverflowRate < prevMetrics.contextOverflowRate) improved.push('context_overflow_rate')
    if (curMetrics.contextOverflowRate > prevMetrics.contextOverflowRate) regressed.push('context_overflow_rate')

    const currentPatterns = new Set(current.runArtifacts.patternKeys)
    const previousPatterns = new Set(previous.runArtifacts.patternKeys)

    const removedPatterns = Array.from(previousPatterns).filter((pattern) => !currentPatterns.has(pattern))
    const addedPatterns = Array.from(currentPatterns).filter((pattern) => !previousPatterns.has(pattern))

    if (removedPatterns.length > 0) improved.push('pattern_set')
    if (addedPatterns.length > 0) regressed.push('pattern_set')
  }

  return { improved, regressed }
}

function trendLabelKey(key: string): string {
  const keys: Record<string, string> = {
    patterns: 'bottlenecks.improveLoop.trend.patterns',
    recommendations: 'bottlenecks.improveLoop.trend.recommendations',
    success_rate: 'bottlenecks.improveLoop.trend.successRate',
    api_blocked_rate: 'bottlenecks.improveLoop.trend.apiBlockedRate',
    wrong_approach_rate: 'bottlenecks.improveLoop.trend.wrongApproachRate',
    context_overflow_rate: 'bottlenecks.improveLoop.trend.contextOverflowRate',
    pattern_set: 'bottlenecks.improveLoop.trend.patternSet',
  }

  return keys[key] ?? key
}

export function BottlenecksPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(14)
  const [loopStatus, setLoopStatus] = useState<LoopStatus>('idle')
  const [loopError, setLoopError] = useState<string | null>(null)
  const [loopSummary, setLoopSummary] = useState<LoopSummary | null>(null)
  const [loopHistory, setLoopHistory] = useState<LoopHistoryEntry[]>([])
  const { data, loading, error, refetch } = useInsightsData(days)
  const result = useBottlenecks(data)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = localStorage.getItem(LOOP_HISTORY_KEY)
      if (!raw) return

      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return

      const safe = parsed
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const e = entry as Record<string, unknown>
          if (typeof e.at !== 'string' || typeof e.days !== 'number') return null

          const summary = normalizeLoopSummary(e.summary)
          if (!summary) return null

          const normalizedEntry: LoopHistoryEntry = { at: e.at, days: e.days, summary }
          return normalizedEntry
        })
        .filter((entry): entry is LoopHistoryEntry => entry !== null)
        .slice(0, LOOP_HISTORY_MAX)

      setLoopHistory(safe)
    } catch {
      setLoopHistory([])
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(LOOP_HISTORY_KEY, JSON.stringify(loopHistory.slice(0, LOOP_HISTORY_MAX)))
    } catch {
      // ignore storage errors
    }
  }, [loopHistory])

  const runImproveLoop = async () => {
    setLoopStatus('running')
    setLoopError(null)

    try {
      const response = await fetch('/api/loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, apply: false }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const rawJson: unknown = await response.json()
      const json = normalizeLoopSummary(rawJson)
      if (!json) {
        throw new Error('Invalid loop response')
      }

      setLoopSummary(json)
      setLoopStatus('success')
      setLoopHistory((prev) => [
        { at: new Date().toISOString(), days, summary: json },
        ...prev,
      ].slice(0, LOOP_HISTORY_MAX))
    } catch (err) {
      setLoopStatus('error')
      setLoopError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (data.length === 0) return <EmptyState />

  const metrics = result?.metrics

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
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

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{t('bottlenecks.improveLoop.title')}</h3>
          <p className="text-sm text-slate-400 mt-1">{t('bottlenecks.improveLoop.subtitle')}</p>
        </div>

        {result?.patterns && result.patterns.length > 0 && (
          <div>
            <p className="text-sm text-slate-300 mb-2">{t('bottlenecks.improveLoop.topPatterns')}</p>
            <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
              {result.patterns.slice(0, 3).map((p, i) => (
                <li key={i}>{p.pattern}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={runImproveLoop}
            disabled={loopStatus === 'running'}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t('bottlenecks.improveLoop.runButton')}
          </button>
          <span className="text-sm text-slate-300">
            {t(`bottlenecks.improveLoop.status.${loopStatus}`)}
          </span>
        </div>

        {loopStatus === 'error' && loopError && (
          <p className="text-sm text-rose-400">{loopError}</p>
        )}

        {loopSummary && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-2 text-sm">
            <p className="text-slate-300">
              {t('bottlenecks.improveLoop.summary.patternsCount')}: <span className="text-white">{loopSummary.patternsDetected}</span>
            </p>
            <p className="text-slate-300">
              {t('bottlenecks.improveLoop.summary.recommendationsCount')}: <span className="text-white">{loopSummary.recommendations}</span>
            </p>
            <p className="text-slate-300">
              {t('bottlenecks.improveLoop.summary.issueLedgerDelta')}: <span className="text-white">+{loopSummary.issueLedgerDelta?.added ?? 0} / -{loopSummary.issueLedgerDelta?.resolved ?? 0} / {t('bottlenecks.improveLoop.summary.reactivated')}: {loopSummary.issueLedgerDelta?.reactivated ?? 0}</span>
            </p>

            {(() => {
              const trend = compareRuns(loopSummary, loopHistory[1]?.summary)
              if (trend.improved.length === 0 && trend.regressed.length === 0) return null

              return (
                <div className="space-y-1">
                  {trend.improved.length > 0 && (
                    <p className="text-emerald-300">
                      {t('bottlenecks.improveLoop.trend.improved')}: <span className="text-white">{trend.improved.map((k) => t(trendLabelKey(k))).join(', ')}</span>
                    </p>
                  )}
                  {trend.regressed.length > 0 && (
                    <p className="text-rose-300">
                      {t('bottlenecks.improveLoop.trend.regressed')}: <span className="text-white">{trend.regressed.map((k) => t(trendLabelKey(k))).join(', ')}</span>
                    </p>
                  )}
                </div>
              )
            })()}

            {loopSummary.runArtifacts && (
              <p className="text-slate-400">
                {t('bottlenecks.improveLoop.summary.runId')}: <span className="text-slate-200 font-mono">{loopSummary.runArtifacts.runId.slice(0, 8)}</span> · {t('bottlenecks.improveLoop.summary.generatedAt')}: <span className="text-slate-200">{new Date(loopSummary.runArtifacts.generatedAt).toLocaleString()}</span>
              </p>
            )}

            {loopSummary.applyResult && (
              <p className="text-slate-300">
                {t('bottlenecks.improveLoop.summary.claudeMdApply')}: <span className="text-white">{loopSummary.applyResult.created ? t('bottlenecks.improveLoop.summary.created') : loopSummary.applyResult.replaced ? t('bottlenecks.improveLoop.summary.updated') : t('bottlenecks.improveLoop.summary.applied')}</span>
              </p>
            )}
          </div>
        )}

        <div className="pt-2">
          <h4 className="text-sm font-semibold text-white mb-2">{t('bottlenecks.improveLoop.history.title')}</h4>
          {loopHistory.length === 0 ? (
            <p className="text-sm text-slate-400">{t('bottlenecks.improveLoop.history.empty')}</p>
          ) : (
            <div className="space-y-2">
              {loopHistory.map((entry, index) => {
                const previous = loopHistory[index + 1]?.summary
                const trend = compareRuns(entry.summary, previous)

                return (
                  <div key={`${entry.at}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-sm space-y-1">
                    <p className="text-slate-300">
                      {t('bottlenecks.improveLoop.history.runAt')}: <span className="text-white">{new Date(entry.at).toLocaleString()}</span>
                    </p>
                    <p className="text-slate-300">
                      {t('bottlenecks.improveLoop.history.days')}: <span className="text-white">{entry.days}</span>
                    </p>
                    <p className="text-slate-300">
                      {t('bottlenecks.improveLoop.history.patterns')}: <span className="text-white">{entry.summary.patternsDetected}</span>
                    </p>
                    <p className="text-slate-300">
                      {t('bottlenecks.improveLoop.history.recommendations')}: <span className="text-white">{entry.summary.recommendations}</span>
                    </p>
                    {entry.summary.issueLedgerDelta && (
                      <p className="text-slate-300">
                        {t('bottlenecks.improveLoop.history.issueLedgerDelta')}: <span className="text-white">+{entry.summary.issueLedgerDelta.added} / -{entry.summary.issueLedgerDelta.resolved} / {t('bottlenecks.improveLoop.history.reactivated')}: {entry.summary.issueLedgerDelta.reactivated}</span>
                      </p>
                    )}

                    {(trend.improved.length > 0 || trend.regressed.length > 0) && (
                      <div className="pt-1">
                        {trend.improved.length > 0 && (
                          <p className="text-emerald-300">
                            {t('bottlenecks.improveLoop.trend.improved')}: <span className="text-white">{trend.improved.map((k) => t(trendLabelKey(k))).join(', ')}</span>
                          </p>
                        )}
                        {trend.regressed.length > 0 && (
                          <p className="text-rose-300">
                            {t('bottlenecks.improveLoop.trend.regressed')}: <span className="text-white">{trend.regressed.map((k) => t(trendLabelKey(k))).join(', ')}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {entry.summary.runArtifacts && (
                      <p className="text-slate-500">
                        {t('bottlenecks.improveLoop.summary.runId')}: <span className="text-slate-300 font-mono">{entry.summary.runArtifacts.runId.slice(0, 8)}</span>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {result?.recommendations && result.recommendations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">{t('bottlenecks.recommendations')}</h3>
          <div className="space-y-3">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="bg-slate-800 rounded-xl border border-indigo-500/30 p-6">
                <div className="flex items-start gap-3">
                  <span className="text-indigo-400 text-lg">•</span>
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
