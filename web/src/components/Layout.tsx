import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './LanguageSwitcher'

export function Layout() {
  const { t } = useTranslation()

  const NAV_GROUPS = [
    {
      title: t('navGroups.executiveOverview'),
      items: [
        { to: '/', label: t('nav.overview') },
        { to: '/trends', label: t('nav.trends') },
      ],
    },
    {
      title: t('navGroups.health'),
      items: [
        { to: '/api-errors', label: t('nav.apiErrors') },
        { to: '/bottlenecks', label: t('nav.bottlenecks') },
      ],
    },
    {
      title: t('navGroups.efficiencyCost'),
      items: [
        { to: '/session-efficiency', label: t('nav.sessionEfficiency') },
      ],
    },
    {
      title: t('navGroups.qualityBehavior'),
      items: [
        { to: '/category-success', label: t('nav.categorySuccess') },
        { to: '/helpfulness', label: t('nav.helpfulness') },
        { to: '/time-patterns', label: t('nav.timePatterns') },
      ],
    },
    {
      title: t('navGroups.drillDown'),
      items: [
        { to: '/sessions', label: t('nav.sessions') },
        { to: '/reports', label: t('nav.reports') },
        { to: '/profile', label: t('nav.profile') },
        { to: '/history', label: t('nav.history') },
      ],
    },
  ]

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:shrink-0 lg:border-r lg:border-slate-800 lg:bg-slate-900/80 lg:backdrop-blur">
        <div className="border-b border-slate-800 px-6 py-5">
          <h1 className="text-lg font-semibold text-white">Claude Insights</h1>
          <p className="mt-1 text-sm text-slate-400">{t('common.dashboard')}</p>
        </div>

        <nav className="flex-1 overflow-auto px-4 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-indigo-500/15 text-indigo-300'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-3 border-t border-slate-800 px-4 py-4">
          <LanguageSwitcher />
          <p className="px-1 text-xs text-slate-500">Claude Insights Toolkit v0.1</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto bg-slate-950/40">
        <div className="border-b border-slate-800 px-4 py-3 lg:hidden">
          <h1 className="text-base font-semibold text-white">Claude Insights</h1>
          <p className="text-xs text-slate-400">{t('common.dashboard')}</p>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
