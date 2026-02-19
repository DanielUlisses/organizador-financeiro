import { Bell, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'
import { useTheme } from '@/app/providers/ThemeProvider'
import { Button } from '@/components/ui/button'

type HeaderProps = {
  collapsed: boolean
  onOpenSidebar: () => void
  onToggleCollapsed: () => void
}

const INTERNAL_NOTIFICATIONS_COUNT = 4

export function Header({ collapsed, onOpenSidebar, onToggleCollapsed }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onOpenSidebar} aria-label="Open menu" className="md:hidden">
          <Menu className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapsed}
          aria-label="Toggle sidebar collapse"
          className="hidden md:inline-flex"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
        <h1 className="text-sm font-semibold md:text-base">Organizador Financeiro</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card"
          aria-label="Open notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] text-white">
            {INTERNAL_NOTIFICATIONS_COUNT}
          </span>
        </button>

        <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1">
          <div className="hidden text-right text-xs leading-tight sm:block">
            <div className="font-medium">Default User</div>
            <div className="text-muted-foreground">Premium</div>
          </div>
          <div className="h-7 w-7 rounded-full bg-primary/20" />
        </div>
      </div>
    </header>
  )
}
