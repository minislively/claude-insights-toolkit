import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useReports } from '@/hooks'
import { LoadingState, ErrorState } from '@/components/LoadingState'

export function ReportsPage() {
  const { t } = useTranslation()
  const { reports, loading, error, refetch } = useReports()
  const [selectedReport, setSelectedReport] = useState<string | null>(null)

  // Auto-select first report
  useEffect(() => {
    if (reports.length > 0 && !selectedReport) {
      setSelectedReport(reports[0].filename)
    }
  }, [reports, selectedReport])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (reports.length === 0) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('reports.title')}</h2>
          <p className="text-slate-400 text-sm mt-1">{t('reports.subtitle')}</p>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-3">
          <p className="text-lg text-white">{t('reports.empty.title')}</p>
          <p className="text-sm text-slate-300">{t('reports.empty.description')}</p>

          <div className="space-y-2 text-sm text-slate-300">
            <p>{t('reports.empty.stepInsights')}</p>
            <p>{t('reports.empty.stepCollect')}</p>
            <p>{t('reports.empty.stepProfile')}</p>
          </div>

          <div className="pt-3 border-t border-slate-700 space-y-1 text-xs text-slate-400">
            <p>{t('reports.empty.outputReport')}</p>
            <p>{t('reports.empty.outputProfile')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Report List Sidebar */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">{t('reports.title')}</h2>
          <p className="text-xs text-slate-400 mt-1">{t('reports.subtitle')}</p>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {reports.map((report) => (
            <button
              key={report.filename}
              onClick={() => setSelectedReport(report.filename)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedReport === report.filename
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <div className="font-medium">{report.date}</div>
              <div className="text-xs text-slate-500 truncate">{report.filename}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 flex flex-col">
        {selectedReport ? (
          <iframe
            key={selectedReport}
            src={`/api/report/${selectedReport}`}
            className="flex-1 w-full bg-white"
            title="Claude Code Report"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            {t('reports.selectReport')}
          </div>
        )}
      </div>
    </div>
  )
}
