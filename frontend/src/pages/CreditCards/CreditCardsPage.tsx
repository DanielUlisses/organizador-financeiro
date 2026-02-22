import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Check, CircleDashed, Clock3, SignalHigh, Trash2, Wifi, X } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, Bar, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMonthContext } from '@/app/providers/MonthContextProvider'
import { ChartCard } from '@/components/common/ChartCard'
import { MonthNavigator } from '@/components/common/MonthNavigator'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'
import { CHART_THEME } from '@/lib/chart-colors'
import { getCategoryIconFromMetadata } from '@/lib/category-icons'
import { getTransactionTypeFromBackendCategory, type TransactionType } from '@/lib/transaction-taxonomy'
import { getDefaultCurrency } from '@/pages/Settings/settings-sections'

type CreditCard = {
  id: number
  name: string
  issuer?: string | null
  card_network?: string | null
  card_number_last4?: string | null
  current_balance: number
  credit_limit: number
  available_credit: number
  utilization_percentage: number
  default_payment_account_id?: number | null
  currency?: string
}

function CardNetworkIcon({ network }: { network?: string | null }) {
  const raw = (network ?? '').toLowerCase()
  const n = raw.includes('visa') ? 'visa' : raw.includes('master') ? 'mastercard' : raw.includes('amex') || raw.includes('american') ? 'amex' : raw
  if (n === 'visa')
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-10" fill="currentColor" aria-hidden>
        <path d="M9.112 8.262L2.012 15.75H0l2.512-7.488h2.6zm2.6 0l3.9 7.488h-2.65l-.65-1.638h-3.575l-.425 1.638H5.762l4.95-7.488zm8.475 0l2.6 7.488h-2.375l-1.625-4.213-1.3 4.213h-2.6l2.6-7.488h2.35l1.55 4.075z" />
      </svg>
    )
  if (n === 'mastercard')
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-9" fill="currentColor" aria-hidden>
        <path d="M15.245 17.831h-6.49a5.42 5.42 0 0 1 2.06-4.166 5.417 5.417 0 0 1 6.37 0 5.42 5.42 0 0 1 2.06 4.166zm-3.245-6.669a3.735 3.735 0 0 0-3.24 1.875 3.735 3.735 0 0 0 0 3.588 3.735 3.735 0 0 0 3.24 1.875 3.735 3.735 0 0 0 3.24-1.875 3.735 3.735 0 0 0 0-3.588 3.735 3.735 0 0 0-3.24-1.875zM12 3C6.477 3 2 7.477 2 13s4.477 10 10 10 10-4.477 10-10S17.523 3 12 3z" />
      </svg>
    )
  if (n === 'amex')
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-9" fill="currentColor" aria-hidden>
        <path d="M2 6h20v2.4l-1.2 1.6 1.2 1.6V14H2v-2.4l1.2-1.6L2 8.4V6zm0 10h20v2H2v-2zm3-6.5h2v1.5H5V9.5zm3 0h2v1.5H8V9.5zm5 0l2.5 2-2.5 2v-1.5h-2v-1h2V9.5z" />
      </svg>
    )
  return <span className="text-[10px] font-bold opacity-80">CARD</span>
}

type StatementTransaction = {
  payment_id: number
  occurrence_id?: number | null
  description: string
  amount: number
  signed_amount: number
  transaction_date: string
  status: string
  direction: 'charge' | 'payment'
  payment_type?: string
  category?: string | null
  category_id?: number | null
  notes?: string | null
  tag_ids?: number[]
  from_account_id?: number | null
}

type StatementSummary = {
  cycle_start_date: string
  cycle_end_date: string
  close_date: string
  due_date: string
  charges_total: number
  payments_total: number
  statement_balance: number
  transactions: StatementTransaction[]
}

type StatementRow =
  | { type: 'group'; key: string; date: string; closingBalance: number }
  | { type: 'payment'; key: string; item: StatementTransaction }

type EditForm = {
  description: string
  amount: string
  transactionType: TransactionType
  categoryId: string
  dueDate: string
  status: string
  notes: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '/api')
const USER_ID = 1

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10)
const normalizeDate = (value?: string | null) => (value ?? '').slice(0, 10)
const getStatusIcon = (status?: string | null) => {
  const value = (status ?? '').toLowerCase()
  if (value === 'reconciled') return Check
  if (value === 'processed') return Check
  if (value === 'scheduled' || value === 'planned') return Clock3
  if (value === 'cancelled') return X
  return CircleDashed
}
const getStatusButtonClass = (status?: string | null) => {
  const value = (status ?? '').toLowerCase()
  if (value === 'reconciled') return 'border-emerald-500 bg-emerald-500 text-white'
  if (value === 'processed') return 'border-emerald-300 bg-emerald-100 text-emerald-700'
  if (value === 'scheduled' || value === 'planned') return 'border-amber-300 bg-amber-100 text-amber-700'
  if (value === 'cancelled') return 'border-rose-300 bg-rose-100 text-rose-700'
  return 'bg-card'
}
const shiftIsoDate = (value: string, deltaDays: number) => {
  const date = new Date(`${normalizeDate(value)}T00:00:00`)
  date.setDate(date.getDate() + deltaDays)
  return toIsoDate(date)
}

export function CreditCardsPage() {
  const { currentMonth } = useMonthContext()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US'
  const referenceDate = useMemo(
    () => toIsoDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 15)),
    [currentMonth],
  )

  const [cards, setCards] = useState<CreditCard[]>([])
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [summary, setSummary] = useState<StatementSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'older' | 'newer'>('older')
  const [editing, setEditing] = useState<StatementTransaction | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    description: '',
    amount: '',
    transactionType: 'expense',
    categoryId: '',
    dueDate: '',
    status: 'pending',
    notes: '',
  })
  const [editTagIds, setEditTagIds] = useState<number[]>([])
  const [recurringScope, setRecurringScope] = useState<'only_event' | 'from_event_forward' | 'all_events'>('only_event')
  const [categories, setCategories] = useState<Array<{ id: number; transaction_type: TransactionType; name: string; icon?: string; color?: string }>>([])
  const [tags, setTags] = useState<Array<{ id: number; name: string }>>([])
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: number; name: string }>>([])
  const [paymentAccountId, setPaymentAccountId] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(referenceDate)
  const [paymentDescription, setPaymentDescription] = useState('Credit card payment')
  const [invoiceHistory, setInvoiceHistory] = useState<
    Array<{ period_label: string; charges_total: number; statement_balance: number }>
  >([])

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  )
  const currencyCode = (selectedCard?.currency ?? getDefaultCurrency()).toUpperCase()
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }),
    [locale, currencyCode],
  )

  const loadCards = async () => {
    const response = await fetch(`${API_BASE_URL}/credit-cards?user_id=${USER_ID}&limit=200`)
    if (!response.ok) throw new Error('Failed to load credit cards.')
    const raw = (await response.json()) as Array<{
      id: number
      name: string
      issuer?: string
      card_network?: string | null
      card_number_last4?: string | null
      current_balance: unknown
      credit_limit: unknown
      available_credit: unknown
      utilization_percentage: unknown
      default_payment_account_id?: number | null
      currency?: string
    }>
    const mapped: CreditCard[] = raw.map((card) => ({
      id: card.id,
      name: card.name,
      issuer: card.issuer,
      card_network: card.card_network,
      card_number_last4: card.card_number_last4,
      current_balance: Number(card.current_balance),
      credit_limit: Number(card.credit_limit),
      available_credit: Number(card.available_credit),
      utilization_percentage: Number(card.utilization_percentage),
      default_payment_account_id: card.default_payment_account_id,
      currency: (card.currency ?? 'USD').toUpperCase(),
    }))
    setCards(mapped)
    setSelectedCardId((current) => current ?? mapped[0]?.id ?? null)
  }

  const loadSummary = async (cardId: number) => {
    const syncRes = await fetch(`${API_BASE_URL}/credit-cards/${cardId}/sync-planned-payments?user_id=${USER_ID}`, {
      method: 'POST',
    })
    if (!syncRes.ok) throw new Error('Failed to sync planned card payments.')

    const [summaryRes, paymentsRes, categoriesRes, tagsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/credit-cards/${cardId}/statement-summary?user_id=${USER_ID}&reference_date=${referenceDate}`),
      fetch(`${API_BASE_URL}/payments?user_id=${USER_ID}&limit=2000`),
      fetch(`${API_BASE_URL}/transaction-metadata/categories?user_id=${USER_ID}`),
      fetch(`${API_BASE_URL}/transaction-metadata/tags?user_id=${USER_ID}`),
    ])
    if (!summaryRes.ok || !paymentsRes.ok || !categoriesRes.ok || !tagsRes.ok) {
      throw new Error('Failed to load credit card statement data.')
    }

    const statementRaw = (await summaryRes.json()) as {
      cycle_start_date: string
      cycle_end_date: string
      close_date: string
      due_date: string
      charges_total: unknown
      payments_total: unknown
      statement_balance: unknown
      transactions: Array<{
        payment_id: number
        occurrence_id?: number | null
        description: string
        amount: unknown
        signed_amount: unknown
        transaction_date: string
        status: string
        direction: 'charge' | 'payment'
      }>
    }
    const paymentsRaw = (await paymentsRes.json()) as Array<{
      id: number
      payment_type?: string
      category?: string
      category_id?: number | string
      notes?: string
      tag_ids?: number[]
      from_account_id?: number
    }>
    const paymentMap = new Map(paymentsRaw.map((payment) => [payment.id, payment]))

    const categoriesRaw = (await categoriesRes.json()) as Array<{ id: number; transaction_type: string; name: string; icon?: string; color?: string }>
    setCategories(
      categoriesRaw.map((item) => ({
        id: item.id,
        transaction_type: getTransactionTypeFromBackendCategory(item.transaction_type),
        name: item.name,
        icon: item.icon ?? 'wallet',
        color: item.color,
      })),
    )
    const tagsRaw = (await tagsRes.json()) as Array<{ id: number; name: string }>
    setTags(tagsRaw)

    const transactions: StatementTransaction[] = statementRaw.transactions.map((transaction) => {
      const payment = paymentMap.get(transaction.payment_id)
      return {
        payment_id: transaction.payment_id,
        occurrence_id: transaction.occurrence_id ?? undefined,
        description: transaction.description,
        amount: Number(transaction.amount),
        signed_amount: Number(transaction.signed_amount),
        transaction_date: normalizeDate(transaction.transaction_date),
        status: (transaction.status ?? 'pending').toLowerCase(),
        direction: transaction.direction,
        payment_type: payment?.payment_type,
        category: payment?.category,
        category_id: payment?.category_id != null ? Number(payment.category_id) : undefined,
        notes: payment?.notes,
        tag_ids: payment?.tag_ids ?? [],
        from_account_id: payment?.from_account_id,
      }
    })

    setSummary({
      cycle_start_date: normalizeDate(statementRaw.cycle_start_date),
      cycle_end_date: normalizeDate(statementRaw.cycle_end_date),
      close_date: normalizeDate(statementRaw.close_date),
      due_date: normalizeDate(statementRaw.due_date),
      charges_total: Number(statementRaw.charges_total),
      payments_total: Number(statementRaw.payments_total),
      statement_balance: Number(statementRaw.statement_balance),
      transactions,
    })
  }

  const refreshData = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const [accountsRes] = await Promise.all([fetch(`${API_BASE_URL}/bank-accounts?user_id=${USER_ID}&limit=200`)])
      if (accountsRes.ok) {
        const rawAccounts = (await accountsRes.json()) as Array<{ id: number; name: string }>
        setBankAccounts(rawAccounts)
      }
      await loadCards()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshData()
  }, [])

  useEffect(() => {
    const handler = () => {
      void refreshData()
      if (selectedCardId) void loadSummary(selectedCardId)
    }
    window.addEventListener('of:transactions-changed', handler)
    return () => window.removeEventListener('of:transactions-changed', handler)
  }, [selectedCardId])

  const loadInvoiceHistory = useCallback(async (cardId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/credit-cards/${cardId}/invoice-history?user_id=${USER_ID}&months=12`)
      if (!res.ok) return
      const data = (await res.json()) as { entries: Array<{ period_label: string; charges_total: number; statement_balance: number }> }
      setInvoiceHistory(
        data.entries.map((e) => ({
          period_label: e.period_label,
          charges_total: Number(e.charges_total),
          statement_balance: Number(e.statement_balance),
        })),
      )
    } catch {
      setInvoiceHistory([])
    }
  }, [])

  useEffect(() => {
    if (!selectedCardId) return
    let active = true
    setLoading(true)
    setError(null)
    void loadSummary(selectedCardId)
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unknown error')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedCardId, referenceDate])

  useEffect(() => {
    if (selectedCardId) void loadInvoiceHistory(selectedCardId)
    else setInvoiceHistory([])
  }, [selectedCardId, loadInvoiceHistory])

  useEffect(() => {
    if (!selectedCard) return
    setPaymentAccountId(selectedCard.default_payment_account_id ? String(selectedCard.default_payment_account_id) : '')
    setPaymentAmount(summary ? String(Math.max(summary.statement_balance, 0)) : '')
    setPaymentDate(summary?.due_date ?? referenceDate)
    setPaymentDescription(`Payment - ${selectedCard.name}`)
  }, [selectedCard, summary, referenceDate])

  const groupedStatement = useMemo(() => {
    if (!summary) return []
    const sorted = [...summary.transactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
    let running = 0
    const map = new Map<string, { date: string; closingBalance: number; items: StatementTransaction[] }>()
    for (const item of sorted) {
      const key = item.transaction_date
      const current = map.get(key) ?? { date: key, closingBalance: running, items: [] }
      running += item.signed_amount
      current.items.push(item)
      current.closingBalance = running
      map.set(key, current)
    }
    const values = [...map.values()]
    values.sort((a, b) => a.date.localeCompare(b.date))
    return sortOrder === 'older' ? values : values.reverse()
  }, [summary, sortOrder])
  const statementRows = useMemo<StatementRow[]>(
    () =>
      groupedStatement.flatMap((group) => [
        {
          type: 'group',
          key: `group-${group.date}`,
          date: group.date,
          closingBalance: group.closingBalance,
        } as StatementRow,
        ...group.items.map(
          (item): StatementRow => ({
            type: 'payment',
            key: `payment-${item.payment_id}-${item.occurrence_id ?? 'base'}-${item.transaction_date}`,
            item,
          }),
        ),
      ]),
    [groupedStatement],
  )
  const statementListRef = useRef<HTMLDivElement | null>(null)
  const statementVirtualizer = useVirtualizer({
    count: statementRows.length,
    getScrollElement: () => statementListRef.current,
    estimateSize: (index) => {
      const row = statementRows[index]
      if (!row) return 48
      if (row.type === 'group') return 40
      return 52
    },
    overscan: 12,
  })

  const chartSeries = useMemo(() => {
    if (!summary) return []
    const sorted = [...summary.transactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
    const map = new Map<
      string,
      { day: string; runningBalance: number; dailyCharges: number; charges: number; payments: number }
    >()
    let running = 0
    for (const item of sorted) {
      const key = item.transaction_date
      const current = map.get(key) ?? { day: key.slice(5, 10), runningBalance: running, dailyCharges: 0, charges: 0, payments: 0 }
      running += item.signed_amount
      if (item.signed_amount > 0) {
        current.charges += item.signed_amount
        current.dailyCharges += item.signed_amount
      } else {
        current.payments += Math.abs(item.signed_amount)
      }
      current.runningBalance = running
      map.set(key, current)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, value]) => value)
  }, [summary])

  const invoiceChartData = useMemo(() => {
    if (invoiceHistory.length === 0) return []
    const sum = invoiceHistory.reduce((acc, e) => acc + e.charges_total, 0)
    const avg = sum / invoiceHistory.length
    return invoiceHistory.map((e) => ({
      period: e.period_label,
      charges: e.charges_total,
      average: Math.round(avg * 100) / 100,
    }))
  }, [invoiceHistory])

  const lastInvoiceValue = useMemo(() => {
    if (invoiceHistory.length === 0) return 0
    return invoiceHistory[invoiceHistory.length - 1]?.statement_balance ?? 0
  }, [invoiceHistory])

  const paymentStatus = useMemo(() => {
    if (!summary) return t('common.noCycleLoaded')
    const due = new Date(`${summary.due_date}T23:59:59`)
    const now = new Date()
    if (summary.statement_balance <= 0) return t('common.paid')
    if (now > due) return t('common.overdue')
    const pendingPayments = summary.transactions.filter((item) => item.direction === 'payment' && item.status === 'pending').length
    return pendingPayments > 0 ? t('common.paymentPendingConfirmation') : t('common.open')
  }, [summary, t])

  const openEditModal = (item: StatementTransaction) => {
    const transactionType = getTransactionTypeFromBackendCategory(item.category)
    setEditing(item)
    setEditForm({
      description: item.description,
      amount: item.amount.toString(),
      transactionType,
      categoryId: item.category_id ? String(item.category_id) : '',
      dueDate: item.transaction_date,
      status: item.status,
      notes: item.notes ?? '',
    })
    setEditTagIds(item.tag_ids ?? [])
    setRecurringScope('only_event')
    setPaymentAccountId(item.from_account_id ? String(item.from_account_id) : paymentAccountId)
  }

  const listOccurrences = async (paymentId: number) => {
    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/occurrences?user_id=${USER_ID}&limit=2000`)
    if (!response.ok) throw new Error('Could not load recurring occurrences.')
    return (await response.json()) as Array<{ id: number; scheduled_date: string }>
  }

  const updateOccurrence = async (occurrenceId: number, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/payments/occurrences/${occurrenceId}?user_id=${USER_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error('Failed to update recurring occurrence.')
  }

  const deleteOccurrence = async (occurrenceId: number) => {
    const response = await fetch(`${API_BASE_URL}/payments/occurrences/${occurrenceId}?user_id=${USER_ID}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete recurring occurrence.')
  }

  const saveEdit = async () => {
    if (!editing || !selectedCardId) return
    try {
      const category = categories.find((item) => item.id === Number(editForm.categoryId))
      const basePayload = {
        description: editForm.description,
        amount: Number(editForm.amount),
        category: category?.transaction_type ?? editForm.transactionType,
        category_id: editForm.categoryId ? Number(editForm.categoryId) : null,
        tag_ids: editTagIds,
        status: editForm.status,
        notes: editForm.notes,
      }

      if (editing.occurrence_id && editing.payment_type === 'recurring') {
        if (recurringScope === 'only_event') {
          await updateOccurrence(editing.occurrence_id, {
            scheduled_date: editForm.dueDate,
            amount: Number(editForm.amount),
            status: editForm.status,
            notes: editForm.notes,
          })
        } else {
          const occurrences = await listOccurrences(editing.payment_id)
          const currentDate = normalizeDate(editing.transaction_date)
          const dayMs = 24 * 60 * 60 * 1000
          const deltaDays = Math.round(
            (new Date(`${normalizeDate(editForm.dueDate)}T00:00:00`).getTime() - new Date(`${currentDate}T00:00:00`).getTime()) / dayMs,
          )
          const selectedOccurrences = occurrences.filter((occurrence) =>
            recurringScope === 'all_events' ? true : normalizeDate(occurrence.scheduled_date) >= currentDate,
          )
          await Promise.all(
            selectedOccurrences.map((occurrence) =>
              updateOccurrence(occurrence.id, {
                scheduled_date: shiftIsoDate(occurrence.scheduled_date, deltaDays),
                amount: Number(editForm.amount),
                status: editForm.status,
                notes: editForm.notes,
              }),
            ),
          )
        }

        const paymentResponse = await fetch(`${API_BASE_URL}/payments/${editing.payment_id}?user_id=${USER_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basePayload),
        })
        if (!paymentResponse.ok) throw new Error('Failed to update recurring payment metadata.')
      } else {
        const fromAccountId =
          editing.direction === 'payment' && paymentAccountId
            ? Number(paymentAccountId)
            : undefined
        const response = await fetch(`${API_BASE_URL}/payments/${editing.payment_id}?user_id=${USER_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...basePayload,
            due_date: editForm.dueDate,
            ...(fromAccountId
              ? {
                  from_account_type: 'bank_account',
                  from_account_id: fromAccountId,
                  to_account_type: 'credit_card',
                  to_account_id: selectedCardId,
                }
              : {}),
          }),
        })
        if (!response.ok) throw new Error('Transaction update failed.')
      }

      setEditing(null)
      setNotice('Transaction updated successfully.')
      await loadSummary(selectedCardId)
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit action failed.')
    }
  }

  const deleteTransaction = async () => {
    if (!editing || !selectedCardId) return
    try {
      if (editing.occurrence_id && editing.payment_type === 'recurring') {
        if (recurringScope === 'only_event') {
          await deleteOccurrence(editing.occurrence_id)
        } else if (recurringScope === 'all_events') {
          const response = await fetch(`${API_BASE_URL}/payments/${editing.payment_id}?user_id=${USER_ID}`, { method: 'DELETE' })
          if (!response.ok) throw new Error('Delete action failed.')
        } else {
          const currentDate = normalizeDate(editing.transaction_date)
          const occurrences = await listOccurrences(editing.payment_id)
          const toDelete = occurrences.filter((occurrence) => normalizeDate(occurrence.scheduled_date) >= currentDate)
          await Promise.all(toDelete.map((occurrence) => deleteOccurrence(occurrence.id)))
          if (toDelete.length === occurrences.length) {
            const response = await fetch(`${API_BASE_URL}/payments/${editing.payment_id}?user_id=${USER_ID}`, { method: 'DELETE' })
            if (!response.ok) throw new Error('Delete action failed.')
          } else {
            const response = await fetch(`${API_BASE_URL}/payments/${editing.payment_id}?user_id=${USER_ID}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ end_date: shiftIsoDate(currentDate, -1) }),
            })
            if (!response.ok) throw new Error('Delete action failed.')
          }
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/payments/${editing.payment_id}?user_id=${USER_ID}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('Delete action failed.')
      }

      setEditing(null)
      setNotice('Transaction deleted.')
      await loadSummary(selectedCardId)
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete action failed.')
    }
  }

  const toggleConfirm = async (item: StatementTransaction) => {
    try {
      const currentlyReconciled = item.status === 'reconciled'
      if (item.occurrence_id) {
        await updateOccurrence(item.occurrence_id, {
          status: currentlyReconciled ? 'pending' : 'reconciled',
          reconciled_date: currentlyReconciled ? null : toIsoDate(new Date()),
        })
      } else {
        const response = await fetch(`${API_BASE_URL}/payments/${item.payment_id}?user_id=${USER_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: currentlyReconciled ? 'pending' : 'reconciled',
            reconciled_date: currentlyReconciled ? null : toIsoDate(new Date()),
          }),
        })
        if (!response.ok) throw new Error('Confirm action failed.')
      }
      if (selectedCardId) await loadSummary(selectedCardId)
      setNotice(currentlyReconciled ? 'Transaction moved to pending.' : 'Transaction reconciled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm action failed.')
    }
  }

  const createCardPayment = async () => {
    if (!selectedCardId) return
    if (!paymentAccountId) {
      setError('Select the source bank account.')
      return
    }
    const amount = Number(paymentAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Payment amount must be greater than zero.')
      return
    }
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/payments/one-time?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: paymentDescription,
          amount,
          currency: currencyCode,
          category: 'transfer',
          from_account_type: 'bank_account',
          from_account_id: Number(paymentAccountId),
          to_account_type: 'credit_card',
          to_account_id: selectedCardId,
          due_date: paymentDate,
          status: 'pending',
          notes: '',
        }),
      })
      if (!response.ok) throw new Error('Failed to create payment.')
      setNotice('Card payment created.')
      if (selectedCardId) {
        const syncResponse = await fetch(`${API_BASE_URL}/credit-cards/${selectedCardId}/sync-planned-payments?user_id=${USER_ID}`, {
          method: 'POST',
        })
        if (!syncResponse.ok) throw new Error('Payment created but failed to refresh planned payments.')
      }
      if (selectedCardId) await loadSummary(selectedCardId)
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create payment failed.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="of-surface rounded-3xl p-5">
        <SectionHeader
          title={t('creditCards.title')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="card-select">
                {t('creditCards.card')}
              </label>
              <select
                id="card-select"
                value={selectedCardId ?? ''}
                onChange={(event) => setSelectedCardId(Number(event.target.value))}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
              <MonthNavigator />
              <Button variant="outline" size="sm" onClick={() => void refreshData()}>
                {t('common.refresh')}
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div
            className="relative flex min-h-[210px] flex-col justify-between rounded-t-3xl p-5 text-white"
            style={{
              background: 'linear-gradient(145deg, #09090b 0%, #111827 55%, #1f2937 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-14 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.26em] text-white/70">Premium card</span>
                <p className="text-base font-semibold tracking-wide text-white/95">{selectedCard?.name ?? 'Credit card'}</p>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <SignalHigh className="h-4 w-4" />
                <Wifi className="h-4 w-4 rotate-90" />
              </div>
            </div>
            <div className="relative z-10 mt-2">
              <div className="mb-4 inline-flex h-10 w-14 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                <div className="h-6 w-9 rounded-md bg-gradient-to-br from-yellow-100/90 via-yellow-300/90 to-yellow-500/90" />
              </div>
              <p className="font-mono text-lg tracking-[0.26em] text-white/95">**** **** **** {selectedCard?.card_number_last4 ?? '****'}</p>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-[11px] uppercase tracking-wider text-white/65">{t('common.available')}</p>
                <p className="text-sm font-semibold text-white/90">{currencyFormatter.format(selectedCard?.available_credit ?? 0)}</p>
                <p className="text-xs text-white/60">
                  {t('common.exp')} {summary?.close_date?.slice(5, 7) ?? '**'}/{summary?.due_date?.slice(2, 4) ?? '**'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-white/90 flex h-8 w-12 items-center justify-end overflow-hidden">
                  <CardNetworkIcon network={selectedCard?.card_network ?? selectedCard?.issuer} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">{t('common.statementBalance')}</p>
                <p className="text-2xl font-bold tracking-tight">{currencyFormatter.format(summary?.statement_balance ?? selectedCard?.current_balance ?? 0)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 border-t bg-card px-5 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('common.lastInvoiceValue')}</p>
              <p className="mt-1 text-2xl font-semibold">{currencyFormatter.format(lastInvoiceValue)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('common.paymentStatus')}</p>
              <p className="mt-1 text-sm font-medium">{paymentStatus}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('common.currentBillingCycle')}</p>
              <p className="mt-1 text-sm font-medium">
                {summary ? `${summary.cycle_start_date} to ${summary.cycle_end_date}` : '-'}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('common.closes')} {summary?.close_date ?? '-'} • {t('common.due')} {summary?.due_date ?? '-'}
              </p>
            </div>
          </div>
        </div>

        <ChartCard title={t('common.past12MonthsInvoices')} subtitle={t('common.chargesPerBillingCycle')}>
          {invoiceChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.noInvoiceHistory')}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={invoiceChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => currencyFormatter.format(v)} />
                  <Tooltip formatter={(value: number) => currencyFormatter.format(value)} />
                  <Legend />
                  <Bar dataKey="charges" fill={CHART_THEME.series.balance} name={t('common.charges')} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="average" stroke={CHART_THEME.series.expenses} strokeWidth={3} strokeDasharray="4 4" name={t('common.average')} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{t('creditCards.loadingStatement')}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title={t('common.invoiceBalanceHealth')} subtitle={t('common.runningStatementBalance')}>
          {chartSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.noCardTransactions')}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartSeries}>
                  <defs>
                    <linearGradient id="cc-balance-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_THEME.series.balance} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={CHART_THEME.series.balance} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="cc-charges-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_THEME.series.expenses} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_THEME.series.expenses} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(Number(value))} />
                  <Area type="monotone" dataKey="runningBalance" stroke={CHART_THEME.series.balance} fill="url(#cc-balance-gradient)" name={t('common.runningBalance')} />
                  <Area type="monotone" dataKey="dailyCharges" stroke={CHART_THEME.series.expenses} fill="url(#cc-charges-gradient)" name={t('common.dailyCharges')} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title={t('creditCards.chargesVsPayments')}
          subtitle={t('creditCards.chargesPaymentsSubtitle', { charges: currencyFormatter.format(summary?.charges_total ?? 0), payments: currencyFormatter.format(summary?.payments_total ?? 0) })}
        >
          {chartSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.noFlowPointsInCycle')}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartSeries}>
                  <defs>
                    <linearGradient id="cc-charges-flow-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_THEME.series.outflow} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={CHART_THEME.series.outflow} stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="cc-payments-flow-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_THEME.series.inflow} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={CHART_THEME.series.inflow} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(Number(value))} />
                  <Area type="monotone" dataKey="charges" stroke={CHART_THEME.series.outflow} fill="url(#cc-charges-flow-gradient)" strokeWidth={3} />
                  <Area type="monotone" dataKey="payments" stroke={CHART_THEME.series.inflow} fill="url(#cc-payments-flow-gradient)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title={t('creditCards.registerCardPayment')} subtitle={t('creditCards.registerCardPaymentSubtitle')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="text-sm sm:col-span-2">
            {t('common.sourceAccount')}
            <select
              value={paymentAccountId}
              onChange={(event) => setPaymentAccountId(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="">{t('common.selectAccount')}</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t('common.amount')}
            <input
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            {t('common.date')}
            <input
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-3">
            {t('common.description')}
            <input
              type="text"
              value={paymentDescription}
              onChange={(event) => setPaymentDescription(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <Button onClick={() => void createCardPayment()} className="w-full">
              {t('common.createPayment')}
            </Button>
          </div>
        </div>
      </ChartCard>

      <ChartCard
        title={t('creditCards.cardStatementInvoiceCycle')}
        subtitle={t('creditCards.transactionsInCycle', { count: summary?.transactions.length ?? 0 })}
        titleAction={
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{t('common.sort')}</span>
            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === 'older' ? 'newer' : 'older'))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-muted"
              aria-label={sortOrder === 'older' ? t('common.newerFirst') : t('common.olderFirst')}
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>
        }
      >
        {groupedStatement.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common.noTransactionsForCycle')}</p>
        ) : (
          <div ref={statementListRef} className="max-h-[640px] overflow-auto">
            <div className="relative w-full" style={{ height: `${statementVirtualizer.getTotalSize()}px` }}>
              {statementVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = statementRows[virtualRow.index]
                if (!row) return null
                return (
                  <div
                    key={row.key}
                    className="absolute left-0 top-0 w-full"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {row.type === 'group' ? (
                      <div className="px-2 py-1">
                        <div className="mb-1 flex items-center justify-between border-b pb-1 text-sm font-semibold">
                          <span>{row.date}</span>
                          <span>{currencyFormatter.format(row.closingBalance)}</span>
                        </div>
                      </div>
                    ) : null}
                    {row.type === 'payment' ? (
                      (() => {
                        const item = row.item
                        const isReconciled = item.status === 'reconciled'
                        const StatusIcon = getStatusIcon(item.status)
                        const category = categories.find((cat) => cat.id === item.category_id)
                        const CategoryIcon = getCategoryIconFromMetadata(category?.icon, category?.name)
                        return (
                          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-background/60">
                            <span
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border"
                              style={{ backgroundColor: category?.color ? `${category.color}22` : undefined }}
                              aria-hidden
                            >
                              <CategoryIcon className="h-4 w-4" style={{ color: category?.color ?? 'currentColor' }} />
                            </span>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="truncate text-left font-medium underline-offset-2 hover:underline"
                            >
                              {item.description}
                            </button>
                            <div className={`text-right ${item.signed_amount < 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {currencyFormatter.format(Math.abs(item.amount))}
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                aria-label={isReconciled ? t('common.moveToPending') : t('common.confirmTransaction')}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${getStatusButtonClass(item.status)}`}
                                onClick={() => void toggleConfirm(item)}
                              >
                                <StatusIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })()
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </ChartCard>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{t('common.editTransaction')}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                {t('common.description')}
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              {editing.occurrence_id && editing.payment_type === 'recurring' ? (
                <label className="text-sm sm:col-span-2">
                  {t('common.recurringScopeLabel')}
                  <select
                    value={recurringScope}
                    onChange={(event) =>
                      setRecurringScope(event.target.value as 'only_event' | 'from_event_forward' | 'all_events')
                    }
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  >
                    <option value="only_event">{t('common.recurringScopeOnlyEvent')}</option>
                    <option value="from_event_forward">{t('common.recurringScopeFromForward')}</option>
                    <option value="all_events">{t('common.recurringScopeAllEvents')}</option>
                  </select>
                </label>
              ) : null}
              <label className="text-sm">
                {t('common.date')}
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              {editing.direction === 'payment' ? (
                <label className="text-sm">
                  {t('common.sourceAccount')}
                  <select
                    value={paymentAccountId}
                    onChange={(event) => setPaymentAccountId(event.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  >
                    <option value="">{t('common.selectAccount')}</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-sm">
                {t('common.amount')}
                <input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                {t('common.transactionType')}
                <select
                  value={editForm.transactionType}
                  onChange={(event) => setEditForm((current) => ({ ...current, transactionType: event.target.value as TransactionType }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="expense">{t('settings.expense')}</option>
                  <option value="income">{t('settings.income')}</option>
                  <option value="transfer">{t('settings.transfer')}</option>
                </select>
              </label>
              <label className="text-sm">
                {t('common.category')}
                <select
                  value={editForm.categoryId}
                  onChange={(event) => setEditForm((current) => ({ ...current, categoryId: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="">{t('common.noCategory')}</option>
                  {categories
                    .filter((category) => category.transaction_type === editForm.transactionType)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                {t('common.tags')}
                <select
                  multiple
                  value={editTagIds.map(String)}
                  onChange={(event) => setEditTagIds(Array.from(event.target.selectedOptions).map((option) => Number(option.value)))}
                  className="mt-1 h-24 w-full rounded-md border bg-background px-3 py-2"
                >
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {t('common.statusLabel')}
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="pending">{t('status.pending')}</option>
                  <option value="processed">{t('status.processed')}</option>
                  <option value="reconciled">{t('status.reconciled')}</option>
                  <option value="scheduled">{t('status.scheduled')}</option>
                  <option value="cancelled">{t('status.cancelled')}</option>
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                {t('common.notes')}
                <textarea
                  value={editForm.notes}
                  onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  rows={2}
                />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-2 text-red-600 hover:bg-red-50"
                onClick={() => void deleteTransaction()}
              >
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => void saveEdit()}>{t('common.save')}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
