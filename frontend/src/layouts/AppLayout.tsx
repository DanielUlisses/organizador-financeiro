import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { GlobalTransactionFab } from '@/components/common/GlobalTransactionFab'
import { Header } from '@/layouts/Header/Header'
import { Sidebar } from '@/layouts/Sidebar/Sidebar'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          collapsed={collapsed}
          onOpenSidebar={() => setMobileOpen(true)}
          onToggleCollapsed={() => setCollapsed((current) => !current)}
        />
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
        <GlobalTransactionFab />
      </div>
    </div>
  )
}
