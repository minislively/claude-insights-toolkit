import { useTranslation } from 'react-i18next'

export function LoadingState({ message }: { message?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm">{message || t('common.loading')}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <p className="text-rose-400 text-lg mb-2">{t('common.error')}</p>
      <p className="text-sm mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 transition-colors">
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <p className="text-lg mb-2">{t('common.noData')}</p>
      <p className="text-sm">{message || t('common.noDataDesc')}</p>
      <p className="text-xs mt-2">{t('common.runCollect')}</p>
    </div>
  )
}
