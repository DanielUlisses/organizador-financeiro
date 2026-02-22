import { useMemo, useState } from 'react'
import { getNotificationPreferences } from '@/pages/Settings/settings-sections'

export type NotificationType = 'pending_payments' | 'credit_card_due' | 'budget_alerts' | 'reconciliation'

export type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  description: string
  date: string
  read?: boolean
}

const DISMISSED_KEY = 'of_notifications_dismissed'
const SNOOZED_KEY = 'of_notifications_snoozed'

function getDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setDismissed(ids: string[]) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
}

function getSnoozed(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SNOOZED_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setSnoozed(map: Record<string, string>) {
  localStorage.setItem(SNOOZED_KEY, JSON.stringify(map))
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '/api')
const USER_ID = 1

export function useNotifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [dismissed, setDismissedState] = useState<string[]>(getDismissed)
  const [snoozed, setSnoozedState] = useState<Record<string, string>>(getSnoozed)

  const prefs = useMemo(() => getNotificationPreferences(), [open])
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [open])
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (!prefs[item.type]) return false
      if (dismissed.includes(item.id)) return false
      const snoozedUntil = snoozed[item.id]
      if (snoozedUntil && snoozedUntil > today) return false
      return true
    })
  }, [items, prefs, dismissed, snoozed, today])

  const dismiss = (id: string) => {
    const next = [...dismissed, id]
    setDismissedState(next)
    setDismissed(next)
  }

  const snoozeUntilTomorrow = (id: string) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const until = tomorrow.toISOString().slice(0, 10)
    const next = { ...snoozed, [id]: until }
    setSnoozedState(next)
    setSnoozed(next)
  }

  const load = async () => {
    setLoaded(true)
    try {
      const [paymentsRes, cardsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/payments?user_id=${USER_ID}&limit=50&status=pending`),
        fetch(`${API_BASE_URL}/credit-cards?user_id=${USER_ID}`),
      ])
      const notifs: NotificationItem[] = []
      if (paymentsRes.ok) {
        const payments = (await paymentsRes.json()) as Array<{ id: number; description: string; due_date?: string }>
        payments
          .filter((p) => p.due_date)
          .slice(0, 5)
          .forEach((p) => {
            notifs.push({
              id: `payment-${p.id}`,
              type: 'pending_payments',
              title: 'Pending payment',
              description: p.description,
              date: p.due_date ?? '',
              read: false,
            })
          })
      }
      if (cardsRes.ok) {
        const cards = (await cardsRes.json()) as Array<{ id: number; name: string }>
        cards.slice(0, 3).forEach((c) => {
          notifs.push({
            id: `due-${c.id}`,
            type: 'credit_card_due',
            title: 'Credit card due',
            description: `${c.name} – check due date`,
            date: new Date().toISOString().slice(0, 10),
            read: false,
          })
        })
      }
      notifs.push({
        id: 'budget-1',
        type: 'budget_alerts',
        title: 'Budget alert',
        description: 'Category "Food" is at 80% of budget.',
        date: new Date().toISOString().slice(0, 10),
        read: false,
      })
      notifs.push({
        id: 'recon-1',
        type: 'reconciliation',
        title: 'Reconciliation',
        description: 'Some transactions are not yet reconciled.',
        date: new Date().toISOString().slice(0, 10),
        read: false,
      })
      setItems(notifs)
    } catch {
      setItems([])
    }
  }

  const toggle = () => {
    setOpen((o) => {
      if (!o && !loaded) void load()
      return !o
    })
  }

  const unreadCount = filtered.length

  return { open, setOpen, items: filtered, toggle, unreadCount, dismiss, snoozeUntilTomorrow }
}
