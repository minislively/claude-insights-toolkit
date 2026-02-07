import { useTranslation } from 'react-i18next'
import { useSnapshots } from '@/hooks/useSnapshots'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

export function HistoryPage() {
  const { t } = useTranslation()
  const { snapshots, loading, error } = useSnapshots()

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (!snapshots || snapshots.length === 0) {
    return <EmptyState message={t('history.noSnapshots')} />
  }

  // Sort snapshots by date ascending for charts
  const sortedSnapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))

  // Calculate summary stats
  const totalSnapshots = snapshots.length
  const firstSnapshot = sortedSnapshots[0]?.date || 'N/A'
  const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1] || snapshots[0]
  const latestSuccessRate = latestSnapshot?.metrics?.successRate || 0

  // Prepare chart data
  const sessionsChartData = sortedSnapshots.map(s => ({
    date: s.date,
    sessions: s.metrics.sessions,
  }))

  const successRateChartData = sortedSnapshots.map(s => ({
    date: s.date,
    successRate: s.metrics.successRate,
  }))

  // Collect all anomalies
  const allAnomalies = snapshots
    .filter(s => s.delta?.anomalies && s.delta.anomalies.length > 0)
    .flatMap(s =>
      s.delta!.anomalies.map(a => ({ ...a, date: s.date }))
    )

  const criticalAnomalies = allAnomalies.filter(a => a.severity === 'critical')
  const warningAnomalies = allAnomalies.filter(a => a.severity === 'warning')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">{t('history.title')}</h1>
        <p className="text-slate-400 mt-2">{t('history.subtitle')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="text-sm text-slate-400 mb-1">{t('history.totalSnapshots')}</div>
          <div className="text-3xl font-bold text-white">{totalSnapshots}</div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="text-sm text-slate-400 mb-1">{t('history.firstSnapshot')}</div>
          <div className="text-3xl font-bold text-white">{firstSnapshot}</div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="text-sm text-slate-400 mb-1">{t('history.latestSnapshot')}</div>
          <div className="text-3xl font-bold text-white">{latestSnapshot?.date || 'N/A'}</div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="text-sm text-slate-400 mb-1">{t('history.latestSuccessRate')}</div>
          <div className="text-3xl font-bold text-emerald-400">{latestSuccessRate}%</div>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {(criticalAnomalies.length > 0 || warningAnomalies.length > 0) && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">{t('history.anomalyAlerts')}</h2>
          <div className="space-y-3">
            {criticalAnomalies.map((anomaly, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <span className="px-2 py-1 text-xs font-bold text-red-400 bg-red-500/20 rounded">
                  {t('history.critical')}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{anomaly.message}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {anomaly.date} • Previous: {anomaly.details.previous} → Current: {anomaly.details.current}
                    {anomaly.details.changePercent !== undefined && ` (${anomaly.details.changePercent > 0 ? '+' : ''}${anomaly.details.changePercent}%)`}
                  </div>
                </div>
              </div>
            ))}
            {warningAnomalies.map((anomaly, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <span className="px-2 py-1 text-xs font-bold text-amber-400 bg-amber-500/20 rounded">
                  {t('history.warning')}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{anomaly.message}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {anomaly.date} • Previous: {anomaly.details.previous} → Current: {anomaly.details.current}
                    {anomaly.details.changePercent !== undefined && ` (${anomaly.details.changePercent > 0 ? '+' : ''}${anomaly.details.changePercent}%)`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-4">{t('history.sessionsOverTime')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={sessionsChartData}>
              <defs>
                <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#cbd5e1' }}
              />
              <Area type="monotone" dataKey="sessions" stroke="#6366f1" strokeWidth={2} fill="url(#colorSessions)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-4">{t('history.successRateOverTime')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={successRateChartData}>
              <defs>
                <linearGradient id="colorSuccessRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(value: number | undefined) => [`${value}%`, 'Success Rate']}
              />
              <Area type="monotone" dataKey="successRate" stroke="#10b981" strokeWidth={2} fill="url(#colorSuccessRate)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Snapshots Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-bold text-white mb-4">{t('history.snapshotTable')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">{t('history.date')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">{t('history.sessions')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">{t('history.messages')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">{t('history.successRate')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">{t('history.language')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">{t('history.anomalies')}</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot, idx) => {
                const anomalyCount = snapshot.delta?.anomalies?.length || 0
                const criticalCount = snapshot.delta?.anomalies?.filter(a => a.severity === 'critical').length || 0
                const warningCount = snapshot.delta?.anomalies?.filter(a => a.severity === 'warning').length || 0

                return (
                  <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4 text-sm text-slate-200">{snapshot.date}</td>
                    <td className="py-3 px-4 text-sm text-slate-200">{snapshot.metrics.sessions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm text-slate-200">{snapshot.metrics.messages.toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className={snapshot.metrics.successRate >= 70 ? 'text-emerald-400' : snapshot.metrics.successRate >= 50 ? 'text-amber-400' : 'text-red-400'}>
                        {snapshot.metrics.successRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-200">{snapshot.metrics.primaryLanguage}</td>
                    <td className="py-3 px-4 text-sm">
                      {anomalyCount > 0 ? (
                        <div className="flex gap-2">
                          {criticalCount > 0 && (
                            <span className="px-2 py-1 text-xs font-bold text-red-400 bg-red-500/20 rounded">
                              {criticalCount}
                            </span>
                          )}
                          {warningCount > 0 && (
                            <span className="px-2 py-1 text-xs font-bold text-amber-400 bg-amber-500/20 rounded">
                              {warningCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
