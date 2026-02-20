import { CreditCard, Gauge, Landmark, LineChart, Settings, User, Wallet } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'

type SidebarProps = {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
}

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/credit-cards', label: 'Credit Cards', icon: CreditCard },
  { to: '/investments', label: 'Investments', icon: Wallet },
  { to: '/investments/tax', label: 'Investments Tax', icon: Wallet },
  { to: '/analytics', label: 'Analytics', icon: LineChart },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/profile', label: 'Profile', icon: User },
]

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
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
          {!collapsed ? <span className="truncate text-sm font-semibold tracking-tight">Organizador Financeiro</span> : null}
        </div>
        <div className="px-3 pt-3 text-[10px] uppercase tracking-wide text-muted-foreground">{collapsed ? 'Nav' : 'Navigation'}</div>
        <nav className="space-y-1 p-2">
          {links.map((link) => (
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
              {!collapsed ? <span>{link.label}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-3">
          <Button className="w-full" variant="outline" onClick={onCloseMobile}>
            {collapsed ? '>' : 'Close'}
          </Button>
        </div>
      </aside>
    </>
  )
}
