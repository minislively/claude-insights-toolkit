import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'

interface ProfileData {
  generatedAt: string;
  identity: { totalMessages: number; totalSessions: number; activeDays: number; msgsPerDay: number; dateRange: { start: string; end: string } };
  languages: Array<{ name: string; value: number; percentage: number }>;
  primaryLanguage: string;
  tools: Array<{ name: string; value: number; percentage: number }>;
  topTool: string;
  workStyle: { dominantSessionType: string; sessionTypeBreakdown: Array<{ type: string; count: number; percentage: number }>; avgResponseTime: { median: number; average: number } | null; multiClauding: { overlapEvents: number; sessionsInvolved: number; ofMessages: string } | null };
  timePatterns: { hourlyActivity: Record<string, number>; peakPeriod: string; peakHours: string };
  goalCategories: Array<{ name: string; count: number; percentage: number }>;
  topGoalCategory: string;
  projectAreas: Array<{ name: string; sessionCount: string; description: string }>;
  successProfile: { outcomes: Array<{ name: string; count: number }>; successRate: number; whatHelpsMost: Array<{ name: string; count: number }> };
  frictionProfile: { topFrictionTypes: Array<{ name: string; count: number }>; categories: Array<{ title: string; description: string; examples: string[] }> };
  satisfaction: { distribution: Array<{ name: string; count: number }>; overallSentiment: 'positive' | 'mixed' | 'negative' };
  strengths: string[];
  weaknesses: string[];
  keyInsight: string;
  claudeMdSuggestions: Array<{ code: string; reason: string }>;
  featureRecommendations: Array<{ title: string; oneliner: string; why: string }>;
}

function BarItem({ name, percentage, color = 'indigo' }: { name: string; percentage: number; color?: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
  }
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-28 text-sm text-slate-300 truncate">{name}</span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorMap[color] || colorMap.indigo}`} style={{ width: `${percentage}%` }} />
      </div>
      <span className="w-10 text-right text-xs text-slate-400">{percentage}%</span>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 text-center">
      <div className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-sm text-slate-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: 'positive' | 'mixed' | 'negative' }) {
  const styles = {
    positive: 'bg-emerald-500/20 text-emerald-400',
    mixed: 'bg-amber-500/20 text-amber-400',
    negative: 'bg-rose-500/20 text-rose-400',
  }
  const labels = { positive: 'Positive', mixed: 'Mixed', negative: 'Negative' }
  return <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${styles[sentiment]}`}>{labels[sentiment]}</span>
}

export function ProfilePage() {
  const { t } = useTranslation()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => setProfile(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />
  if (!profile) return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">{t('profile.title')}</h2>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
        <p className="text-slate-400 text-lg mb-2">{t('profile.noReport')}</p>
        <p className="text-slate-500 text-sm">{t('profile.runInsights')}</p>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">{t('profile.title')}</h2>
        <p className="text-slate-400 text-sm mt-1">{t('profile.subtitle', { start: profile.identity.dateRange.start, end: profile.identity.dateRange.end })}</p>
      </div>

      {/* Identity Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('profile.messages')} value={profile.identity.totalMessages} />
        <StatCard label={t('profile.sessions')} value={profile.identity.totalSessions} />
        <StatCard label={t('profile.activeDays')} value={profile.identity.activeDays} sub={`${profile.identity.msgsPerDay.toFixed(1)} ${t('profile.msgsPerDay')}`} />
        <StatCard label={t('profile.successRate')} value={`${profile.successProfile.successRate}%`} sub={t('profile.fullyMostly')} />
      </div>

      {/* Key Insight */}
      {profile.keyInsight && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-5">
          <div className="text-sm font-medium text-indigo-400 mb-1">{t('profile.keyInsightLabel')}</div>
          <p className="text-slate-200 text-sm leading-relaxed">{profile.keyInsight}</p>
        </div>
      )}

      {/* Languages & Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('profile.languages')}</h3>
          {profile.languages.slice(0, 6).map(lang => (
            <BarItem key={lang.name} name={lang.name} percentage={lang.percentage} color="emerald" />
          ))}
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('profile.tools')}</h3>
          {profile.tools.slice(0, 6).map(tool => (
            <BarItem key={tool.name} name={tool.name} percentage={tool.percentage} color="cyan" />
          ))}
        </div>
      </div>

      {/* Work Style & Time Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('profile.workStyle')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{t('profile.dominantType')}</span>
              <span className="text-white font-medium">{profile.workStyle.dominantSessionType}</span>
            </div>
            {profile.workStyle.sessionTypeBreakdown.map(st => (
              <BarItem key={st.type} name={st.type} percentage={st.percentage} color="violet" />
            ))}
            {profile.workStyle.multiClauding && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400 mb-2">{t('profile.multiClauding')}</div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-violet-400">{profile.workStyle.multiClauding.overlapEvents}</div>
                    <div className="text-xs text-slate-500">{t('profile.overlaps')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-violet-400">{profile.workStyle.multiClauding.sessionsInvolved}</div>
                    <div className="text-xs text-slate-500">{t('profile.sessionsInvolved')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-violet-400">{profile.workStyle.multiClauding.ofMessages}</div>
                    <div className="text-xs text-slate-500">{t('profile.ofMessages')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('profile.timePatterns')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{t('profile.peakPeriod')}</span>
              <span className="text-white font-medium">{profile.timePatterns.peakPeriod} ({profile.timePatterns.peakHours})</span>
            </div>
            {profile.workStyle.avgResponseTime && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400 mb-2">{t('profile.responseTime')}</div>
                <div className="flex gap-6">
                  <div>
                    <span className="text-lg font-bold text-white">{profile.workStyle.avgResponseTime.median.toFixed(1)}s</span>
                    <span className="text-xs text-slate-500 ml-1">{t('profile.median')}</span>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-white">{profile.workStyle.avgResponseTime.average.toFixed(1)}s</span>
                    <span className="text-xs text-slate-500 ml-1">{t('profile.average')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Goal Categories */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('profile.goalCategories')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          {profile.goalCategories.slice(0, 6).map(cat => (
            <BarItem key={cat.name} name={cat.name} percentage={cat.percentage} color="amber" />
          ))}
        </div>
      </div>

      {/* Project Areas */}
      {profile.projectAreas.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('profile.projectAreas')}</h3>
          <div className="space-y-4">
            {profile.projectAreas.map(area => (
              <div key={area.name} className="border-b border-slate-700 pb-4 last:border-0 last:pb-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-white font-medium text-sm">{area.name}</span>
                  <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">{area.sessionCount}</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success & Friction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-emerald-400 mb-4">{t('profile.strengths')}</h3>
          <div className="space-y-2">
            {profile.strengths.map(s => (
              <div key={s} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">+</span>
                <span className="text-slate-300 text-sm">{s}</span>
              </div>
            ))}
          </div>
          {profile.successProfile.whatHelpsMost.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="text-xs text-slate-500 mb-2">{t('profile.whatHelpsMost')}</div>
              {profile.successProfile.whatHelpsMost.slice(0, 3).map(h => (
                <div key={h.name} className="flex justify-between text-sm py-0.5">
                  <span className="text-slate-400">{h.name}</span>
                  <span className="text-slate-300">{h.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weaknesses */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-rose-400 mb-4">{t('profile.areasToImprove')}</h3>
          <div className="space-y-2">
            {profile.weaknesses.map(w => (
              <div key={w} className="flex items-start gap-2">
                <span className="text-rose-400 mt-0.5">!</span>
                <span className="text-slate-300 text-sm">{w}</span>
              </div>
            ))}
          </div>
          {profile.frictionProfile.topFrictionTypes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="text-xs text-slate-500 mb-2">{t('profile.topFriction')}</div>
              {profile.frictionProfile.topFrictionTypes.slice(0, 3).map(f => (
                <div key={f.name} className="flex justify-between text-sm py-0.5">
                  <span className="text-slate-400">{f.name}</span>
                  <span className="text-rose-300">{f.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Satisfaction */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t('profile.satisfaction')}</h3>
          <SentimentBadge sentiment={profile.satisfaction.overallSentiment} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {profile.satisfaction.distribution.map(s => (
            <div key={s.name} className="text-center">
              <div className="text-lg font-bold text-white">{s.count}</div>
              <div className="text-xs text-slate-400 capitalize">{s.name.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {(profile.claudeMdSuggestions.length > 0 || profile.featureRecommendations.length > 0) && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('profile.recommendations')}</h3>
          {profile.claudeMdSuggestions.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-medium text-indigo-400 mb-3">{t('profile.claudeMdAdditions')}</div>
              <div className="space-y-3">
                {profile.claudeMdSuggestions.slice(0, 3).map((s, i) => (
                  <div key={i} className="bg-slate-900 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">{s.reason}</p>
                    <pre className="text-xs text-indigo-300 whitespace-pre-wrap font-mono overflow-x-auto">{s.code.slice(0, 200)}{s.code.length > 200 ? '...' : ''}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}
          {profile.featureRecommendations.length > 0 && (
            <div>
              <div className="text-sm font-medium text-emerald-400 mb-3">{t('profile.featureRecs')}</div>
              <div className="space-y-2">
                {profile.featureRecommendations.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5 text-sm">*</span>
                    <div>
                      <span className="text-white text-sm font-medium">{f.title}</span>
                      <span className="text-slate-400 text-sm"> - {f.oneliner}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
