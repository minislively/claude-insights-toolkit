import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './LanguageSwitcher'

export function Layout() {
  const { t } = useTranslation()

  const NAV_GROUPS = [
    {
      title: t('navGroups.executiveOverview'),
      items: [
        { to: '/', label: t('nav.overview'), icon: '📊' },
        { to: '/trends', label: t('nav.trends'), icon: '📈' },
      ],
    },
    {
      title: t('navGroups.health'),
      items: [
        { to: '/api-errors', label: 'API Errors', icon: '⚠️' },
        { to: '/bottlenecks', label: t('nav.bottlenecks'), icon: '🔍' },
      ],
    },
    {
      title: t('navGroups.efficiencyCost'),
      items: [
        { to: '/session-efficiency', label: 'Efficiency', icon: '⚡' },
      ],
    },
    {
      title: t('navGroups.qualityBehavior'),
      items: [
        { to: '/category-success', label: 'Categories', icon: '📂' },
        { to: '/helpfulness', label: 'Helpfulness', icon: '💡' },
        { to: '/time-patterns', label: 'Time Patterns', icon: '🕐' },
      ],
    },
    {
      title: t('navGroups.drillDown'),
      items: [
        { to: '/sessions', label: t('nav.sessions'), icon: '📋' },
        { to: '/reports', label: t('nav.reports'), icon: '📄' },
        { to: '/profile', label: t('nav.profile'), icon: '👤' },
        { to: '/history', label: t('nav.history'), icon: '📸' },
      ],
    },
  ]

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Claude Insights</h1>
              <p className="text-sm text-slate-400 mt-1">{t('common.dashboard')}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-4 mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`
                    }
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700 space-y-3">
          <LanguageSwitcher />
          <div className="text-xs text-slate-500">
            Claude Insights Toolkit v0.1
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
