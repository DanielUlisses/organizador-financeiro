import { CreditCard, Gauge, Landmark, LineChart, Settings, User, Wallet } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

type SidebarProps = {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
}

const linkKeys = [
  { to: '/dashboard', key: 'nav.dashboard', icon: Gauge },
  { to: '/accounts', key: 'nav.accounts', icon: Landmark },
  { to: '/credit-cards', key: 'nav.creditCards', icon: CreditCard },
  { to: '/investments', key: 'nav.investments', icon: Wallet },
  { to: '/investments/tax', key: 'nav.investmentsTax', icon: Wallet },
  { to: '/analytics', key: 'nav.analytics', icon: LineChart },
  { to: '/settings', key: 'nav.settings', icon: Settings },
  { to: '/profile', key: 'nav.profile', icon: User },
]

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { t } = useTranslation()
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/40 md:hidden ${mobileOpen ? 'block' : 'hidden'}`}
        onClick={onCloseMobile}
      />
      <aside
        className={`fixed left-0 top-0 z-40 h-screen border-r bg-card/95 transition-all md:static md:z-auto ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        data-testid="sidebar-root"
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        <div className="flex h-14 items-center gap-2 border-b px-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <img
              src="/logo.svg"
              alt=""
              className="h-9 w-9 select-none object-contain object-center"
              width={36}
              height={36}
              decoding="async"
            />
          </span>
          {!collapsed ? <span className="truncate text-sm font-semibold tracking-tight">{t('common.appName')}</span> : null}
        </div>
        <div className="px-3 pt-3 text-[10px] uppercase tracking-wide text-muted-foreground">{collapsed ? t('common.nav') : t('common.navigation')}</div>
        <nav className="space-y-1 p-2">
          {linkKeys.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-accent'
                }`
              }
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{t(link.key)}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-3">
          <Button className="w-full" variant="outline" onClick={onCloseMobile}>
            {collapsed ? '>' : t('common.close')}
          </Button>
        </div>
      </aside>
    </>
  )
}
