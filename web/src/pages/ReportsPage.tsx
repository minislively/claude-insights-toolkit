import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useReports } from '@/hooks'
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingState'

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
  if (reports.length === 0) return <EmptyState message={t('reports.noReports')} />

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
