export type SettingsSectionId =
  | 'general'
  | 'bank-accounts'
  | 'credit-cards'
  | 'categories'
  | 'tags'
  | 'investment-accounts'
  | 'notifications'
  | 'import-export'

export const SETTINGS_SECTIONS: { id: SettingsSectionId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'bank-accounts', label: 'Bank accounts' },
  { id: 'credit-cards', label: 'Credit cards' },
  { id: 'categories', label: 'Categories' },
  { id: 'tags', label: 'Tags' },
  { id: 'investment-accounts', label: 'Investment accounts' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'import-export', label: 'Import & Export' },
]

export const NOTIFICATION_PREFERENCE_KEYS = {
  pending_payments: 'of_notify_pending_payments',
  credit_card_due: 'of_notify_credit_card_due',
  budget_alerts: 'of_notify_budget_alerts',
  reconciliation: 'of_notify_reconciliation',
} as const

export type NotificationPreferenceKey = keyof typeof NOTIFICATION_PREFERENCE_KEYS

export function getNotificationPreferences(): Record<NotificationPreferenceKey, boolean> {
  if (typeof localStorage === 'undefined') {
    return {
      pending_payments: true,
      credit_card_due: true,
      budget_alerts: true,
      reconciliation: true,
    }
  }
  return {
    pending_payments: localStorage.getItem(NOTIFICATION_PREFERENCE_KEYS.pending_payments) !== 'false',
    credit_card_due: localStorage.getItem(NOTIFICATION_PREFERENCE_KEYS.credit_card_due) !== 'false',
    budget_alerts: localStorage.getItem(NOTIFICATION_PREFERENCE_KEYS.budget_alerts) !== 'false',
    reconciliation: localStorage.getItem(NOTIFICATION_PREFERENCE_KEYS.reconciliation) !== 'false',
  }
}

export function setNotificationPreference(key: NotificationPreferenceKey, enabled: boolean): void {
  localStorage.setItem(NOTIFICATION_PREFERENCE_KEYS[key], String(enabled))
}

export const DEFAULT_CURRENCY_KEY = 'of_default_currency'
export const TRANSACTION_ORDER_KEY = 'of_transaction_order'
export const REDUCED_VISUAL_EFFECTS_KEY = 'of_reduced_visual_effects'

export type TransactionOrder = 'older' | 'newer'

export function getDefaultCurrency(): string {
  return typeof localStorage !== 'undefined' ? (localStorage.getItem(DEFAULT_CURRENCY_KEY) ?? 'USD') : 'USD'
}

export function setDefaultCurrency(currency: string): void {
  localStorage.setItem(DEFAULT_CURRENCY_KEY, currency)
}

export function getTransactionOrder(): TransactionOrder {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(TRANSACTION_ORDER_KEY) : null
  return (v === 'older' || v === 'newer' ? v : 'older') as TransactionOrder
}

export function setTransactionOrder(order: TransactionOrder): void {
  localStorage.setItem(TRANSACTION_ORDER_KEY, order)
}

export function getReducedVisualEffects(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(REDUCED_VISUAL_EFFECTS_KEY) === 'true'
}

export function setReducedVisualEffects(enabled: boolean): void {
  localStorage.setItem(REDUCED_VISUAL_EFFECTS_KEY, String(enabled))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('of:reduced-visual-effects-changed', { detail: enabled }))
  }
}
