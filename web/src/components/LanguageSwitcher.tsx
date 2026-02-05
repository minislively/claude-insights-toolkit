import { useTranslation } from 'react-i18next'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ko' ? 'en' : 'ko'
    i18n.changeLanguage(newLang)
  }

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
    >
      <span className="text-sm">{i18n.language === 'ko' ? '🇰🇷' : '🇺🇸'}</span>
      <span>{i18n.language === 'ko' ? '한국어' : 'EN'}</span>
    </button>
  )
}
