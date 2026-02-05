import { useTranslation } from 'react-i18next'

interface PeriodSelectorProps {
  value: number
  onChange: (days: number) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const { t } = useTranslation()

  const PERIODS = [
    { days: 7, label: t('period.7d') },
    { days: 14, label: t('period.14d') },
    { days: 30, label: t('period.30d') },
  ]
  return (
    <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
      {PERIODS.map(({ days, label }) => (
        <button
          key={days}
          onClick={() => onChange(days)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            value === days
              ? 'bg-indigo-500 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
