import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'
import { useTheme } from '@/app/providers/ThemeProvider'
import { Button } from '@/components/ui/button'
import { HeaderNotifications } from '@/layouts/Header/HeaderNotifications'

type HeaderProps = {
  collapsed: boolean
  onOpenSidebar: () => void
  onToggleCollapsed: () => void
}

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
        <h1 className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <img
              src="/logo.svg"
              alt=""
              className="h-9 w-9 select-none object-contain object-center"
              width={36}
              height={36}
              decoding="async"
            />
          </span>
          <span className="sr-only">Organizador Financeiro</span>
        </h1>
        <div className="ml-2 hidden w-72 items-center rounded-md border bg-card px-3 py-1.5 md:flex">
          <input
            type="text"
            placeholder="Search"
            className="w-full border-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <HeaderNotifications />

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
