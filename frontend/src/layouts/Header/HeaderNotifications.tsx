import { useEffect, useRef } from 'react'
import { Bell, Trash2, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotifications } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'

export function HeaderNotifications() {
  const { open, setOpen, items, toggle, unreadCount, dismiss, snoozeUntilTomorrow } = useNotifications()
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, setOpen])

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card hover:bg-muted"
        aria-label={t('common.openNotifications')}
        aria-expanded={open}
        onClick={toggle}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-card py-2 shadow-lg"
          role="dialog"
          aria-label={t('common.notifications')}
        >
          <div className="border-b px-3 py-2">
            <h3 className="text-sm font-semibold">{t('common.notifications')}</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t('common.noNotifications')}</p>
            ) : (
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.date}</p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => snoozeUntilTomorrow(item.id)}
                        aria-label={t('common.snoozeUntilTomorrow')}
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => dismiss(item.id)}
                        aria-label={t('common.dismiss')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
