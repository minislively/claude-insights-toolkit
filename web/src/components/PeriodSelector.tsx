import { useTranslation } from 'react-i18next'

interface PeriodSelectorProps {
  value: number
  onChange: (days: number) => void
  availableDays?: number
}

export function PeriodSelector({ value, onChange, availableDays }: PeriodSelectorProps) {
  const { t } = useTranslation()

  const PERIODS = [
    { days: 1, label: t('period.1d') },
    { days: 7, label: t('period.7d') },
    { days: 14, label: t('period.14d') },
    { days: 30, label: t('period.30d') },
    { days: 0, label: t('period.all') },
  ]

  return (
    <div className="flex flex-wrap gap-1 bg-slate-800/80 border border-slate-700 rounded-lg p-1">
      {PERIODS.map(({ days, label }) => {
        const disabled = availableDays !== undefined && days !== 0 && days > availableDays
        return (
          <button
            key={days}
            onClick={() => !disabled && onChange(days)}
            disabled={disabled}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              value === days
                ? 'bg-indigo-500 text-white'
                : disabled
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
