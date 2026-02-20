import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { GlobalTransactionFab } from '@/components/common/GlobalTransactionFab'
import { useReducedVisualEffects } from '@/hooks/useReducedVisualEffects'
import { Header } from '@/layouts/Header/Header'
import { Sidebar } from '@/layouts/Sidebar/Sidebar'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const reducedVisualEffects = useReducedVisualEffects()
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const openSidebar = useCallback(() => setSidebarOpen(true), [])

  return (
    <div className="relative flex min-h-screen bg-background text-foreground">
      {!reducedVisualEffects ? (
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,0.14),transparent_38%),radial-gradient(circle_at_85%_0%,rgba(59,130,246,0.12),transparent_33%)]" />
      ) : null}
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenSidebar={openSidebar} />
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
