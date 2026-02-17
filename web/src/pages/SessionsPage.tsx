import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useInsightsData } from '@/hooks'
import { PeriodSelector } from '@/components/PeriodSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'
import type { ISessionFacet } from '@/types'

type SortKey = 'outcome' | 'type' | 'goal'
type SortDir = 'asc' | 'desc'

export function SessionsPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(14)
  const { data, loading, error, refetch } = useInsightsData(days)
  const [search, setSearch] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('goal')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const allSessions = useMemo(() => data.flatMap(d => d.sessions), [data])

  const filtered = useMemo(() => {
    let sessions = [...allSessions]
    if (search) {
      const q = search.toLowerCase()
      sessions = sessions.filter(s =>
        s.underlying_goal.toLowerCase().includes(q) ||
        s.brief_summary.toLowerCase().includes(q) ||
        s.session_id.toLowerCase().includes(q)
      )
    }
    if (outcomeFilter !== 'all') {
      sessions = sessions.filter(s => s.outcome === outcomeFilter)
    }
    sessions.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'goal') cmp = a.underlying_goal.localeCompare(b.underlying_goal)
      else if (sortKey === 'outcome') cmp = a.outcome.localeCompare(b.outcome)
      else if (sortKey === 'type') cmp = a.session_type.localeCompare(b.session_type)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sessions
  }, [allSessions, search, outcomeFilter, sortKey, sortDir])

  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (data.length === 0) return <EmptyState />

  const OUTCOMES = ['all', 'fully_achieved', 'mostly_achieved', 'partially_achieved', 'not_achieved', 'unclear_from_transcript']

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('sessions.title')}</h2>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} {t('common.sessions')}</p>
        </div>
        <PeriodSelector value={days} onChange={(d) => { setDays(d); setPage(0) }} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder={t('sessions.searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72"
        />
        <select
          value={outcomeFilter}
          onChange={(e) => { setOutcomeFilter(e.target.value); setPage(0) }}
          className="bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {OUTCOMES.map(o => (
            <option key={o} value={o}>{o === 'all' ? t('sessions.allOutcomes') : t(`outcomes.${o}`)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left py-3 px-4">{t('overview.id')}</th>
                <th className="text-left py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort('goal')}>
                  {t('overview.goal')} {sortKey === 'goal' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort('outcome')}>
                  {t('overview.outcome')} {sortKey === 'outcome' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort('type')}>
                  {t('overview.type')} {sortKey === 'type' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left py-3 px-4">{t('sessions.helpfulness')}</th>
                <th className="text-left py-3 px-4">{t('sessions.friction')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s) => (
                <SessionRow key={s.session_id} session={s} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <span className="text-sm text-slate-400">{t('common.page')} {page + 1} {t('common.of')} {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-sm rounded bg-slate-700 text-white disabled:opacity-40 hover:bg-slate-600"
              >
                {t('common.prev')}
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 text-sm rounded bg-slate-700 text-white disabled:opacity-40 hover:bg-slate-600"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SessionRow({ session: s }: { session: ISessionFacet }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const frictionList = Object.entries(s.friction_counts).filter(([_, v]) => v > 0)
  const topFrictionTypes = [...frictionList]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([key]) => key.replace(/_/g, ' '))
  const extraFrictionCount = Math.max(0, frictionList.length - 2)
  const frictionSummary = frictionList.length > 0
    ? `${topFrictionTypes.join(', ')}${extraFrictionCount > 0 ? ` +${extraFrictionCount} more` : ''}`
    : '-'
  const helpfulnessLabel = t(`helpfulness.${s.claude_helpfulness}`, { defaultValue: t('sessions.unknownHelpfulness') })

  const outcomeStyles: Record<string, string> = {
    fully_achieved: 'bg-emerald-500/20 text-emerald-400',
    mostly_achieved: 'bg-indigo-500/20 text-indigo-400',
    partially_achieved: 'bg-amber-500/20 text-amber-400',
    not_achieved: 'bg-rose-500/20 text-rose-400',
    unclear_from_transcript: 'bg-slate-500/20 text-slate-400',
  }

  return (
    <>
      <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="py-3 px-4 font-mono text-slate-300 text-xs">{s.session_id.slice(0, 8)}</td>
        <td className="py-3 px-4 text-slate-300 max-w-xs truncate">{s.underlying_goal.slice(0, 80)}</td>
        <td className="py-3 px-4">
          <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${outcomeStyles[s.outcome] || outcomeStyles.unclear_from_transcript}`}>
            {t(`outcomes.${s.outcome}`)}
          </span>
        </td>
        <td className="py-3 px-4 text-slate-400 text-xs">{s.session_type.replace(/_/g, ' ')}</td>
        <td className="py-3 px-4 text-slate-400 text-xs">{helpfulnessLabel}</td>
        <td className="py-3 px-4 text-slate-400 text-xs">{frictionSummary}</td>
      </tr>
      {expanded && (
        <tr className="bg-slate-700/20">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-2 text-sm">
              <p className="text-slate-300"><span className="text-slate-500">{t('sessions.summary')}:</span> {s.brief_summary}</p>
              {s.friction_detail && <p className="text-slate-300"><span className="text-slate-500">{t('sessions.frictionDetail')}:</span> {s.friction_detail}</p>}
              {frictionList.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {frictionList.map(([key, val]) => (
                    <span key={key} className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-xs">
                      {key.replace(/_/g, ' ')}: {val}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {Object.entries(s.goal_categories).map(([cat, count]) => (
                  <span key={cat} className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded text-xs">
                    {cat.replace(/_/g, ' ')}: {count}
                  </span>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
