import { CreditCard, Gauge, Landmark, LineChart, Settings, User, Wallet, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useReducedVisualEffects } from '@/hooks/useReducedVisualEffects'

type SidebarProps = {
  open: boolean
  onClose: () => void
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

export function Sidebar({ open, onClose }: SidebarProps) {
  const { t } = useTranslation()
  const reducedVisualEffects = useReducedVisualEffects()
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/45 ${reducedVisualEffects ? '' : 'backdrop-blur-sm'} ${open ? 'block' : 'hidden'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-72 p-3 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}
        data-testid="sidebar-root"
      >
        <div className={`flex h-full flex-col rounded-3xl p-3 ${reducedVisualEffects ? 'border bg-card shadow-sm' : 'of-surface'}`}>
          <div className="flex h-14 items-center justify-between gap-3 rounded-2xl px-2">
            <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
              <img
                src="/logo.svg"
                alt=""
                className="h-8 w-8 select-none object-contain object-center"
                width={32}
                height={32}
                decoding="async"
              />
            </span>
            <span className="truncate text-sm font-semibold tracking-tight">{t('common.appName')}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="px-2 pt-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{t('common.navigation')}</div>
          <nav className="mt-2 space-y-1 p-1">
            {linkKeys.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground'
                  }`
                }
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/10 group-hover:bg-black/15">
                  <link.icon className="h-4 w-4 shrink-0" />
                </span>
                <span>{t(link.key)}</span>
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto p-2">
            <Button className="w-full" variant="outline" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
