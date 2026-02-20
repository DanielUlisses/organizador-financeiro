import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Check, CircleDashed, Clock3, Pencil, Trash2, X } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMonthContext } from '@/app/providers/MonthContextProvider'
import { ChartCard } from '@/components/common/ChartCard'
import { MonthNavigator } from '@/components/common/MonthNavigator'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'
import { CHART_THEME } from '@/lib/chart-colors'
import { getCategoryIconFromMetadata } from '@/lib/category-icons'
import { getDefaultCurrency } from '@/pages/Settings/settings-sections'
import {
  defaultChildCategory,
  getTransactionTypeFromBackendCategory,
  TRANSACTION_CHILD_CATEGORIES,
  type TransactionType,
} from '@/lib/transaction-taxonomy'
import { buildRunningBalanceSeries, getSignedAmount, isInMonth, type AccountPayment } from '@/pages/Accounts/accounts-helpers'

type BankAccount = {
  id: number
  name: string
  balance: number
  account_type: string
  bank_name?: string | null
  account_number_last4?: string | null
  currency?: string
  color?: string | null
}

type PaymentRow = AccountPayment & {
  payment_id?: number
  occurrence_id?: number
  payment_type?: string | null
  status?: string | null
  notes?: string | null
  category_id?: number | null
  tag_ids?: number[] | null
}

type StatementRow =
  | { type: 'group'; key: string; date: string; closingBalance: number }
  | { type: 'carry'; key: string }
  | { type: 'payment'; key: string; payment: PaymentRow }

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const USER_ID = 1
const EFFECTIVE_STATUSES = new Set(['processed', 'reconciled'])
const PENDING_STATUSES = new Set(['pending', 'scheduled'])
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
const normalizeDateKey = (value?: string | null) => (value ?? '').slice(0, 10)
const toYmd = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`

export function AccountsPage() {
  const { currentMonth } = useMonthContext()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US'
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'older' | 'newer'>('older')
  const [notice, setNotice] = useState<string | null>(null)
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null)
  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    transactionType: 'expense' as TransactionType,
    categoryChild: defaultChildCategory('expense'),
    due_date: '',
    status: 'pending',
    notes: '',
  })

  const [transferToId, setTransferToId] = useState<number | null>(null)
  const [transferAmount, setTransferAmount] = useState('0')
  const [transferReceivedAmount, setTransferReceivedAmount] = useState('')
  const [transferDescription, setTransferDescription] = useState('Transfer between accounts')
  const [categories, setCategories] = useState<Array<{ id: number; transaction_type: TransactionType; name: string; icon?: string; color?: string }>>([])
  const [tags, setTags] = useState<Array<{ id: number; name: string }>>([])
  const [editTagIds, setEditTagIds] = useState<number[]>([])
  const [recurringScope, setRecurringScope] = useState<'only_event' | 'from_event_forward' | 'all_events'>('only_event')
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null)
  const [editBankForm, setEditBankForm] = useState({
    name: '',
    account_type: 'checking' as 'checking' | 'savings' | 'money_market' | 'other',
    bank_name: '',
    account_number_last4: '',
    balance: '0',
    currency: 'USD',
    color: '#6366F1',
  })

  const fetchAllPayments = async () => {
    const pageSize = 500
    let skip = 0
    const all: Array<{
      id: number
      description: string
      amount: unknown
      category?: string
      category_id?: number
      due_date?: string
      start_date?: string
      payment_type?: string
      status?: string
      notes?: string
      from_account_type?: string
      from_account_id?: number
      to_account_type?: string
      to_account_id?: number
      tag_ids?: number[]
    }> = []

    while (true) {
      const response = await fetch(`${API_BASE_URL}/payments?user_id=${USER_ID}&skip=${skip}&limit=${pageSize}`)
      if (!response.ok) throw new Error('Failed to load account statement data.')
      const chunk = (await response.json()) as Array<{
        id: number
        description: string
        amount: unknown
        category?: string
        category_id?: number
        due_date?: string
        start_date?: string
        payment_type?: string
        status?: string
        notes?: string
        from_account_type?: string
        from_account_id?: number
        to_account_type?: string
        to_account_id?: number
        tag_ids?: number[]
      }>
      all.push(...chunk)
      if (chunk.length < pageSize) break
      skip += pageSize
    }

    // Defensive dedupe in case backend pagination order changes.
    const byId = new Map<number, (typeof all)[number]>()
    for (const payment of all) {
      byId.set(payment.id, payment)
    }
    return [...byId.values()]
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const [accountsRes, rawPayments, categoriesRes, tagsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/bank-accounts?user_id=${USER_ID}`),
        fetchAllPayments(),
        fetch(`${API_BASE_URL}/transaction-metadata/categories?user_id=${USER_ID}`),
        fetch(`${API_BASE_URL}/transaction-metadata/tags?user_id=${USER_ID}`),
      ])

      if (!accountsRes.ok || !categoriesRes.ok || !tagsRes.ok) {
        throw new Error('Failed to load account statement data.')
      }

      const rawAccounts = (await accountsRes.json()) as Array<{
        id: number
        name: string
        balance: unknown
        account_type: string
        bank_name?: string
        account_number_last4?: string | null
        currency?: string
        color?: string | null
      }>
      const accountData: BankAccount[] = rawAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        balance: Number(account.balance),
        account_type: account.account_type,
        bank_name: account.bank_name,
        account_number_last4: account.account_number_last4 ?? null,
        currency: account.currency ?? 'USD',
        color: account.color ?? undefined,
      }))
      setAccounts(accountData)
      setSelectedAccountId((current) => current ?? accountData[0]?.id ?? null)

      const recurringPayments = rawPayments.filter((payment) => payment.payment_type === 'recurring')
      const occurrenceResponses = await Promise.all(
        recurringPayments.map(async (payment) => {
          const response = await fetch(`${API_BASE_URL}/payments/${payment.id}/occurrences?user_id=${USER_ID}&limit=500`)
          if (!response.ok) return { paymentId: payment.id, occurrences: [] as Array<{ id: number; scheduled_date: string; amount: unknown; status?: string; notes?: string }> }
          const occurrences = (await response.json()) as Array<{ id: number; scheduled_date: string; amount: unknown; status?: string; notes?: string }>
          return { paymentId: payment.id, occurrences }
        }),
      )
      const recurringByPaymentId = new Map(occurrenceResponses.map((entry) => [entry.paymentId, entry.occurrences]))

      const flattenedPayments: PaymentRow[] = []
      for (const payment of rawPayments) {
        if (payment.payment_type !== 'recurring') {
          flattenedPayments.push({
            id: payment.id,
            payment_id: payment.id,
            occurrence_id: undefined,
            payment_type: payment.payment_type,
            description: payment.description,
            amount: Number(payment.amount),
            category: payment.category,
            category_id: payment.category_id != null ? Number(payment.category_id) : undefined,
            due_date: payment.due_date,
            status: payment.status,
            notes: payment.notes,
            from_account_type: payment.from_account_type,
            from_account_id: payment.from_account_id,
            to_account_type: payment.to_account_type,
            to_account_id: payment.to_account_id,
            tag_ids: payment.tag_ids ?? [],
          })
          continue
        }
        const occurrences = recurringByPaymentId.get(payment.id) ?? []
        for (const occurrence of occurrences) {
          flattenedPayments.push({
            // Evita colisões do tipo payment=12/occ=34 vs payment=123/occ=4.
            id: payment.id * 1_000_000 + occurrence.id,
            payment_id: payment.id,
            occurrence_id: occurrence.id,
            payment_type: payment.payment_type,
            description: payment.description,
            amount: Number(occurrence.amount),
            category: payment.category,
            category_id: payment.category_id != null ? Number(payment.category_id) : undefined,
            due_date: occurrence.scheduled_date,
            status: occurrence.status ?? payment.status,
            notes: occurrence.notes ?? payment.notes,
            from_account_type: payment.from_account_type,
            from_account_id: payment.from_account_id,
            to_account_type: payment.to_account_type,
            to_account_id: payment.to_account_id,
            tag_ids: payment.tag_ids ?? [],
          })
        }
      }
      setPayments(flattenedPayments)
      const rawCategories = (await categoriesRes.json()) as Array<{ id: number; transaction_type: string; name: string; icon?: string; color?: string }>
      setCategories(
        rawCategories.map((item) => ({
          id: item.id,
          transaction_type: getTransactionTypeFromBackendCategory(item.transaction_type),
          name: item.name,
          icon: item.icon ?? 'wallet',
          color: item.color,
        })),
      )
      const rawTags = (await tagsRes.json()) as Array<{ id: number; name: string }>
      setTags(rawTags)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const handler = () => {
      void loadData()
    }
    window.addEventListener('of:transactions-changed', handler)
    return () => window.removeEventListener('of:transactions-changed', handler)
  }, [])

  useEffect(() => {
    if (selectedAccountId) localStorage.setItem('of_default_account_id', String(selectedAccountId))
  }, [selectedAccountId])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  )
  const destinationAccount = useMemo(
    () => accounts.find((account) => account.id === transferToId) ?? null,
    [accounts, transferToId],
  )
  const selectedCurrencyCode = (selectedAccount?.currency ?? getDefaultCurrency()).toUpperCase()
  const destinationCurrencyCode = (destinationAccount?.currency ?? selectedCurrencyCode).toUpperCase()
  const isCrossCurrencyTransfer = Boolean(destinationAccount && selectedCurrencyCode !== destinationCurrencyCode)
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: selectedCurrencyCode }),
    [locale, selectedCurrencyCode],
  )

  const monthlyPayments = useMemo(
    () => payments.filter((payment) => payment.due_date && isInMonth(payment.due_date, currentMonth)),
    [payments, currentMonth],
  )

  const touchesSelectedBankAccount = (payment: PaymentRow) =>
    (payment.from_account_type === 'bank_account' && payment.from_account_id === selectedAccountId) ||
    (payment.to_account_type === 'bank_account' && payment.to_account_id === selectedAccountId)

  const statementPayments = useMemo(
    () =>
      monthlyPayments.filter(
        (payment) => touchesSelectedBankAccount(payment),
      ),
    [monthlyPayments, selectedAccountId],
  )
  const hasUnassignedTransactions = monthlyPayments.some((payment) => !payment.from_account_id && !payment.to_account_id)

  const allAccountPayments = useMemo(
    () =>
      payments.filter(
        (payment) => touchesSelectedBankAccount(payment),
      ),
    [payments, selectedAccountId],
  )

  const monthStart = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), [currentMonth])
  const monthEnd = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0), [currentMonth])
  const monthStartKey = useMemo(() => toYmd(monthStart), [monthStart])
  const monthEndKey = useMemo(() => toYmd(monthEnd), [monthEnd])
  const carryOverBalance = useMemo(() => {
    if (!selectedAccountId) return 0
    // Saldo de abertura do mês baseado apenas no ledger até o último dia do mês anterior.
    // Isso evita drift visual quando o balance persistido diverge do histórico exibido.
    let rolling = 0
    for (const payment of allAccountPayments) {
      const dueDateKey = normalizeDateKey(payment.due_date)
      if (!dueDateKey) continue
      const status = (payment.status ?? 'pending').toLowerCase()
      if (!EFFECTIVE_STATUSES.has(status)) continue
      if (dueDateKey >= monthStartKey) continue
      rolling += getSignedAmount(payment, selectedAccountId, false)
    }
    return rolling
  }, [allAccountPayments, monthStartKey, selectedAccountId])

  const statementGroupedByDate = useMemo(() => {
    if (!selectedAccount || !selectedAccountId || statementPayments.length === 0) return []
    const asc = [...statementPayments].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    let running = carryOverBalance

    const grouped = new Map<string, { date: string; closingBalance: number; items: PaymentRow[] }>()
    for (const payment of asc) {
      const dateKey = payment.due_date ?? 'No date'
      const current = grouped.get(dateKey) ?? { date: dateKey, closingBalance: running, items: [] }
      const status = (payment.status ?? 'pending').toLowerCase()
      if (EFFECTIVE_STATUSES.has(status)) {
        running += getSignedAmount(payment, selectedAccountId)
      }
      current.items.push(payment)
      current.closingBalance = running
      grouped.set(dateKey, current)
    }

    const carryKey = monthStartKey
    const groups = [
      {
        date: carryKey,
        closingBalance: carryOverBalance,
        items: [] as PaymentRow[],
      },
      ...grouped.values(),
    ]
    groups.sort((a, b) => a.date.localeCompare(b.date))
    return sortOrder === 'older' ? groups : groups.reverse()
  }, [statementPayments, selectedAccount, selectedAccountId, sortOrder, carryOverBalance, monthStartKey])

  const statementRows = useMemo<StatementRow[]>(
    () =>
      statementGroupedByDate.flatMap((group) => {
        const headerRow: StatementRow = {
          type: 'group',
          key: `group-${group.date}`,
          date: group.date,
          closingBalance: group.closingBalance,
        }
        if (group.items.length === 0) {
          return [headerRow, { type: 'carry', key: `carry-${group.date}` }]
        }
        return [
          headerRow,
          ...group.items.map(
            (payment): StatementRow => ({
              type: 'payment',
              key: `payment-${payment.id}`,
              payment,
            }),
          ),
        ]
      }),
    [statementGroupedByDate],
  )
  const statementListRef = useRef<HTMLDivElement | null>(null)
  const statementVirtualizer = useVirtualizer({
    count: statementRows.length,
    getScrollElement: () => statementListRef.current,
    estimateSize: (index) => {
      const row = statementRows[index]
      if (!row) return 48
      if (row.type === 'group') return 40
      if (row.type === 'carry') return 32
      return 52
    },
    overscan: 12,
  })

  const totals = useMemo(() => {
    if (!selectedAccountId) return { inflow: 0, outflow: 0, net: 0 }
    return statementPayments.reduce(
      (acc, payment) => {
        const signed = getSignedAmount(payment, selectedAccountId)
        const status = (payment.status ?? 'pending').toLowerCase()
        if (EFFECTIVE_STATUSES.has(status)) {
          if (signed >= 0) acc.inflow += signed
          if (signed < 0) acc.outflow += Math.abs(signed)
          acc.net += signed
        }
        return acc
      },
      { inflow: 0, outflow: 0, net: 0 },
    )
  }, [statementPayments, selectedAccountId])

  const expectedEndOfMonthBalance = useMemo(() => {
    if (!selectedAccountId) return carryOverBalance
    let running = carryOverBalance
    for (const payment of statementPayments) {
      const status = (payment.status ?? 'pending').toLowerCase()
      if (EFFECTIVE_STATUSES.has(status) || PENDING_STATUSES.has(status)) {
        running += getSignedAmount(payment, selectedAccountId)
      }
    }
    return running
  }, [carryOverBalance, selectedAccountId, statementPayments])

  const displayedCurrentBalance = useMemo(() => {
    if (!selectedAccountId) return carryOverBalance
    const nowKey = toYmd(new Date())
    const cutoffKey = monthEndKey < nowKey ? monthEndKey : nowKey
    let running = carryOverBalance
    for (const payment of statementPayments) {
      const dueKey = normalizeDateKey(payment.due_date)
      if (!dueKey) continue
      const status = (payment.status ?? 'pending').toLowerCase()
      if (!EFFECTIVE_STATUSES.has(status)) continue
      if (dueKey > cutoffKey) continue
      running += getSignedAmount(payment, selectedAccountId)
    }
    return running
  }, [carryOverBalance, monthEndKey, selectedAccountId, statementPayments])

  const runningBalanceSeries = useMemo(() => {
    if (!selectedAccountId || !selectedAccount) return []
    const effectivePayments = statementPayments.filter((payment) =>
      EFFECTIVE_STATUSES.has((payment.status ?? 'pending').toLowerCase()),
    )
    return buildRunningBalanceSeries(carryOverBalance, effectivePayments, selectedAccountId)
  }, [selectedAccountId, selectedAccount, statementPayments, carryOverBalance])

  const cashflowSeries = useMemo(() => {
    const byDay = new Map<string, { inflow: number; outflow: number }>()
    if (!selectedAccountId) return []
    for (const payment of statementPayments) {
      const status = (payment.status ?? 'pending').toLowerCase()
      if (!EFFECTIVE_STATUSES.has(status)) continue
      const key = payment.due_date ?? 'unknown'
      const signed = getSignedAmount(payment, selectedAccountId)
      const current = byDay.get(key) ?? { inflow: 0, outflow: 0 }
      if (signed >= 0) current.inflow += signed
      if (signed < 0) current.outflow += Math.abs(signed)
      byDay.set(key, current)
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, data]) => ({ day: day.slice(5, 10), ...data }))
  }, [statementPayments, selectedAccountId])

  const balanceHistory12Mo = useMemo(() => {
    if (!selectedAccountId || !selectedAccount) return []
    const now = new Date()
    const months: { label: string; balance: number; year: number; month: number }[] = []
    let running = displayedCurrentBalance
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const monthStart = toYmd(new Date(y, m, 1))
      const monthEnd = toYmd(new Date(y, m + 1, 0))
      let net = 0
      for (const p of payments) {
        const status = (p.status ?? 'pending').toLowerCase()
        if (!EFFECTIVE_STATUSES.has(status)) continue
        const key = normalizeDateKey(p.due_date)
        if (!key || key < monthStart || key > monthEnd) continue
        if (touchesSelectedBankAccount(p)) net += getSignedAmount(p, selectedAccountId)
      }
      running -= net
      months.push({ label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), balance: running, year: y, month: m })
    }
    return months.reverse()
  }, [selectedAccountId, selectedAccount, payments, displayedCurrentBalance])

  const updatePayment = async (paymentId: number, payload: Record<string, unknown>, successMessage: string) => {
    const target = payments.find((payment) => payment.id === paymentId)
    if (!target) throw new Error('Transaction not found.')
    const isOccurrence = Boolean(target.occurrence_id)
    const endpoint = isOccurrence
      ? `${API_BASE_URL}/payments/occurrences/${target.occurrence_id}?user_id=${USER_ID}`
      : `${API_BASE_URL}/payments/${target.payment_id ?? paymentId}?user_id=${USER_ID}`
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error('Transaction update failed.')
    if (isOccurrence) {
      const updated = (await response.json()) as { id: number; amount: unknown; status?: string; notes?: string; scheduled_date?: string }
      setPayments((current) =>
        current.map((payment) =>
          payment.id === paymentId
            ? {
                ...payment,
                amount: Number(updated.amount),
                status: updated.status ?? payment.status,
                notes: updated.notes ?? payment.notes,
                due_date: updated.scheduled_date ?? payment.due_date,
              }
            : payment,
        ),
      )
    } else {
      const updated = (await response.json()) as PaymentRow
      setPayments((current) => current.map((payment) => (payment.id === paymentId ? { ...payment, ...updated, amount: Number(updated.amount) } : payment)))
    }
    window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    setNotice(successMessage)
  }

  const toDate = (value: string) => new Date(`${normalizeDateKey(value)}T00:00:00`)
  const toIsoDate = (value: Date) => value.toISOString().slice(0, 10)
  const shiftIsoDate = (value: string, deltaDays: number) => {
    const date = toDate(value)
    date.setDate(date.getDate() + deltaDays)
    return toIsoDate(date)
  }

  const listOccurrences = async (paymentId: number) => {
    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/occurrences?user_id=${USER_ID}&limit=1000`)
    if (!response.ok) throw new Error('Could not load recurring occurrences.')
    const data = (await response.json()) as Array<{ id: number; scheduled_date: string }>
    return data
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

  const confirmPayment = async (paymentId: number) => {
    try {
      const current = payments.find((payment) => payment.id === paymentId)
      const currentlyReconciled = (current?.status ?? '').toLowerCase() === 'reconciled'
      await updatePayment(
        paymentId,
        {
          status: currentlyReconciled ? 'pending' : 'reconciled',
          reconciled_date: currentlyReconciled ? null : new Date().toISOString().slice(0, 10),
        },
        currentlyReconciled ? 'Transaction moved back to pending.' : 'Transaction confirmed and reconciled.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm action failed.')
    }
  }

  const openEditModal = (payment: PaymentRow) => {
    const transactionType = getTransactionTypeFromBackendCategory(payment.category)
    setEditingPayment(payment)
    setEditForm({
      description: payment.description,
      amount: payment.amount.toString(),
      transactionType,
      categoryChild:
        categories.find((item) => item.id === payment.category_id)?.name ?? defaultChildCategory(transactionType),
      due_date: payment.due_date ?? '',
      status: (payment.status ?? 'pending').toLowerCase(),
      notes: payment.notes ?? '',
    })
    setEditTagIds(payment.tag_ids ?? [])
    setRecurringScope('only_event')
  }

  const saveEdit = async () => {
    if (!editingPayment) return
    try {
      const categoryId =
        categories.find((item) => item.transaction_type === editForm.transactionType && item.name === editForm.categoryChild)?.id ?? null

      if (editingPayment.occurrence_id && editingPayment.payment_id && editingPayment.payment_type === 'recurring') {
        if (recurringScope === 'only_event') {
          await updatePayment(
            editingPayment.id,
            {
              scheduled_date: editForm.due_date,
              amount: Number(editForm.amount),
              status: editForm.status,
              notes: editForm.notes,
            },
            'Recurring event updated.',
          )
        } else {
          const occurrences = await listOccurrences(editingPayment.payment_id)
          const currentDate = normalizeDateKey(editingPayment.due_date)
          const newDate = normalizeDateKey(editForm.due_date)
          const dayMs = 24 * 60 * 60 * 1000
          const deltaDays = Math.round((toDate(newDate).getTime() - toDate(currentDate).getTime()) / dayMs)
          const selected = occurrences.filter((occurrence) =>
            recurringScope === 'all_events'
              ? true
              : normalizeDateKey(occurrence.scheduled_date) >= currentDate,
          )

          await Promise.all(
            selected.map((occurrence) =>
              updateOccurrence(occurrence.id, {
                scheduled_date: shiftIsoDate(occurrence.scheduled_date, deltaDays),
                amount: Number(editForm.amount),
                status: editForm.status,
                notes: editForm.notes,
              }),
            ),
          )

          const paymentPayload: Record<string, unknown> = {
            description: editForm.description,
            amount: Number(editForm.amount),
            category: editForm.transactionType,
            category_id: categoryId,
            tag_ids: editTagIds,
            notes: editForm.notes,
          }
          if (recurringScope === 'all_events' && deltaDays !== 0) {
            paymentPayload.start_date = shiftIsoDate(editingPayment.due_date ?? newDate, deltaDays)
          }

          const paymentResponse = await fetch(`${API_BASE_URL}/payments/${editingPayment.payment_id}?user_id=${USER_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentPayload),
          })
          if (!paymentResponse.ok) throw new Error('Failed to update recurring series.')
          setNotice(recurringScope === 'all_events' ? 'All recurring events updated.' : 'Recurring events updated from this event forward.')
          await loadData()
          window.dispatchEvent(new CustomEvent('of:transactions-changed'))
        }
      } else {
        await updatePayment(
          editingPayment.id,
          {
            description: editForm.description,
            amount: Number(editForm.amount),
            due_date: editForm.due_date,
            category: editForm.transactionType,
            category_id: categoryId,
            tag_ids: editTagIds,
            status: editForm.status,
            notes: editForm.notes,
          },
          'Transaction updated successfully.',
        )
      }
      setEditingPayment(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit action failed.')
    }
  }

  const deletePayment = async (paymentId: number) => {
    try {
      const target = payments.find((payment) => payment.id === paymentId)
      if (!target) throw new Error('Transaction not found.')

      if (target.occurrence_id && target.payment_id && target.payment_type === 'recurring') {
        const currentDate = normalizeDateKey(target.due_date)
        if (recurringScope === 'only_event') {
          await deleteOccurrence(target.occurrence_id)
        } else if (recurringScope === 'all_events') {
          const response = await fetch(`${API_BASE_URL}/payments/${target.payment_id}?user_id=${USER_ID}`, { method: 'DELETE' })
          if (!response.ok) throw new Error('Delete action failed.')
        } else {
          const occurrences = await listOccurrences(target.payment_id)
          const toDelete = occurrences.filter((occurrence) => normalizeDateKey(occurrence.scheduled_date) >= currentDate)
          await Promise.all(toDelete.map((occurrence) => deleteOccurrence(occurrence.id)))

          if (toDelete.length === occurrences.length) {
            const response = await fetch(`${API_BASE_URL}/payments/${target.payment_id}?user_id=${USER_ID}`, { method: 'DELETE' })
            if (!response.ok) throw new Error('Delete action failed.')
          } else {
            const previousDay = shiftIsoDate(currentDate, -1)
            const response = await fetch(`${API_BASE_URL}/payments/${target.payment_id}?user_id=${USER_ID}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ end_date: previousDay }),
            })
            if (!response.ok) throw new Error('Delete action failed.')
          }
        }
      } else {
        const endpoint = target.occurrence_id
          ? `${API_BASE_URL}/payments/occurrences/${target.occurrence_id}?user_id=${USER_ID}`
          : `${API_BASE_URL}/payments/${target.payment_id ?? paymentId}?user_id=${USER_ID}`
        const response = await fetch(endpoint, { method: 'DELETE' })
        if (!response.ok) throw new Error('Delete action failed.')
      }

      setPayments((current) => current.filter((payment) => payment.id !== paymentId))
      setNotice('Transaction deleted.')
      setEditingPayment(null)
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete action failed.')
    }
  }

  const createTransfer = async () => {
    if (!selectedAccountId || !transferToId || transferToId === selectedAccountId) {
      setError('Select a different destination account for transfer.')
      return
    }
    const outgoingAmount = Number(transferAmount)
    if (Number.isNaN(outgoingAmount) || outgoingAmount <= 0) {
      setError('Transfer amount must be greater than zero.')
      return
    }
    const incomingAmount = isCrossCurrencyTransfer ? Number(transferReceivedAmount) : outgoingAmount
    if (Number.isNaN(incomingAmount) || incomingAmount <= 0) {
      setError('Destination amount must be greater than zero.')
      return
    }
    try {
      const dueDate = new Date().toISOString().slice(0, 10)
      const baseDescription = transferDescription.trim() || 'Transfer between accounts'

      if (!isCrossCurrencyTransfer) {
        const response = await fetch(`${API_BASE_URL}/payments/one-time?user_id=${USER_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: baseDescription,
            amount: outgoingAmount,
            currency: selectedCurrencyCode,
            category: 'transfer',
            from_account_type: 'bank_account',
            from_account_id: selectedAccountId,
            to_account_type: 'bank_account',
            to_account_id: transferToId,
            due_date: dueDate,
            notes: '',
          }),
        })
        if (!response.ok) throw new Error('Transfer creation failed.')
        const created = (await response.json()) as PaymentRow
        setPayments((current) => [{ ...created, amount: Number(created.amount) }, ...current])
      } else {
        const outboundRes = await fetch(`${API_BASE_URL}/payments/one-time?user_id=${USER_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: `${baseDescription} (${selectedCurrencyCode} → ${destinationCurrencyCode})`,
            amount: outgoingAmount,
            currency: selectedCurrencyCode,
            category: 'transfer',
            from_account_type: 'bank_account',
            from_account_id: selectedAccountId,
            to_account_type: null,
            to_account_id: null,
            due_date: dueDate,
            notes: `cross_currency_out to_account_id=${transferToId}`,
          }),
        })
        if (!outboundRes.ok) throw new Error('Transfer creation failed.')
        const inboundRes = await fetch(`${API_BASE_URL}/payments/one-time?user_id=${USER_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: `${baseDescription} (${selectedCurrencyCode} → ${destinationCurrencyCode})`,
            amount: incomingAmount,
            currency: destinationCurrencyCode,
            category: 'transfer',
            from_account_type: null,
            from_account_id: null,
            to_account_type: 'bank_account',
            to_account_id: transferToId,
            due_date: dueDate,
            notes: `cross_currency_in from_account_id=${selectedAccountId}`,
          }),
        })
        if (!inboundRes.ok) throw new Error('Transfer creation failed.')
      }
      setNotice('Transfer created successfully.')
      setTransferReceivedAmount('')
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer action failed.')
    }
  }

  const openBankEditModal = (account: BankAccount) => {
    const rawType = (account.account_type ?? 'checking').toLowerCase()
    const accountType: 'checking' | 'savings' | 'money_market' | 'other' =
      rawType === 'savings' || rawType === 'money_market' || rawType === 'other' ? rawType : 'checking'
    setEditingBankAccount(account)
    setEditBankForm({
      name: account.name ?? '',
      account_type: accountType,
      bank_name: account.bank_name ?? '',
      account_number_last4: account.account_number_last4 ?? '',
      balance: String(account.balance ?? 0),
      currency: account.currency ?? 'USD',
      color: account.color ?? '#6366F1',
    })
  }

  const saveBankEdit = async () => {
    if (!editingBankAccount) return
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/bank-accounts/${editingBankAccount.id}?user_id=${USER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editBankForm.name,
          account_type: editBankForm.account_type,
          bank_name: editBankForm.bank_name || null,
          account_number_last4: editBankForm.account_number_last4 || null,
          balance: Number(editBankForm.balance),
          currency: editBankForm.currency || 'USD',
          color: editBankForm.color || null,
        }),
      })
      if (!response.ok) throw new Error('Failed to update bank account.')
      setEditingBankAccount(null)
      setNotice('Bank account updated.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bank account update failed.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeader
          title={t('accounts.title')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="account-select">
                {t('accounts.account')}
              </label>
              <select
                id="account-select"
                value={selectedAccountId ?? ''}
                onChange={(event) => setSelectedAccountId(Number(event.target.value))}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <MonthNavigator />
              <Button variant="outline" size="sm" onClick={() => void loadData()}>
                {t('common.refresh')}
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:col-span-2">
          {balanceHistory12Mo.length > 0 && (
            <div className="absolute inset-0 opacity-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceHistory12Mo} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="bank-card-bg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={selectedAccount?.color ?? CHART_THEME.series.balance} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={selectedAccount?.color ?? CHART_THEME.series.balance} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="balance" fill="url(#bank-card-bg)" stroke="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="relative flex items-start justify-between gap-4 p-5">
            <div>
              <h3 className="text-xl font-semibold">{selectedAccount?.bank_name ?? selectedAccount?.name ?? 'Bank account'}</h3>
              <p className="mt-0.5 text-sm capitalize text-muted-foreground">{selectedAccount?.account_type ?? '—'}</p>
              {hasUnassignedTransactions ? (
                <p className="mt-2 text-xs text-amber-700">Statement includes unassigned transactions.</p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => selectedAccount && openBankEditModal(selectedAccount)}
              aria-label="Edit bank account"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-xl border-0 bg-gradient-to-br from-blue-800 via-blue-900 to-indigo-950 p-5 text-blue-50 shadow-lg shadow-blue-900/25 dark:from-blue-900 dark:via-indigo-950 dark:to-slate-950 dark:text-white">
          <p className="text-xs uppercase tracking-wide text-blue-100/90">{t('dashboard.currentBalance')}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{currencyFormatter.format(displayedCurrentBalance)}</p>
          <p className="mt-2 text-xs text-blue-100/90">
            {t('common.netThisMonth')}:{' '}
            <span className={totals.net >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
              {currencyFormatter.format(totals.net)}
            </span>
          </p>
          <p className="mt-1 text-xs text-blue-100/90">
            {t('common.expectedEndOfMonth')}: <span className="font-semibold text-white">{currencyFormatter.format(expectedEndOfMonthBalance)}</span>
          </p>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{t('accounts.loadingStatement')}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title={t('common.accountBalanceHealth')} subtitle={t('common.runningBalanceAndDailyExpenses')}>
          {runningBalanceSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.noTransactionsInMonth')}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={runningBalanceSeries}>
                  <defs>
                    <linearGradient id="account-balance-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_THEME.series.balance} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={CHART_THEME.series.balance} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="account-expenses-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_THEME.series.expenses} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_THEME.series.expenses} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number | string, name: string) => [
                      currencyFormatter.format(Number(value)),
                      name === 'balance' ? t('common.balance') : t('common.dailyExpenses'),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke={CHART_THEME.series.balance}
                    fill="url(#account-balance-gradient)"
                    name={t('common.balance')}
                  />
                  <Area
                    type="monotone"
                    dataKey="dailyExpenses"
                    stroke={CHART_THEME.series.expenses}
                    fill="url(#account-expenses-gradient)"
                    strokeWidth={3}
                    name={t('common.dailyExpenses')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title={t('common.inflowVsOutflow')} subtitle={`${t('common.inflow')} ${currencyFormatter.format(totals.inflow)} • ${t('common.outflow')} ${currencyFormatter.format(totals.outflow)}`}>
          {cashflowSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.noCashflowPoints')}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflowSeries}>
                  <defs>
                    <linearGradient id="account-inflow-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_THEME.series.inflow} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={CHART_THEME.series.inflow} stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="account-outflow-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_THEME.series.outflow} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={CHART_THEME.series.outflow} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(Number(value))} />
                  <Area
                    type="monotone"
                    dataKey="inflow"
                    stroke={CHART_THEME.series.inflow}
                    fill="url(#account-inflow-gradient)"
                    strokeWidth={3}
                  />
                  <Area
                    type="monotone"
                    dataKey="outflow"
                    stroke={CHART_THEME.series.outflow}
                    fill="url(#account-outflow-gradient)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title={t('common.transferBetweenAccounts')} subtitle={t('common.createOneTimeTransfer')}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            {t('common.destination')}
            <select
              value={transferToId ?? ''}
              onChange={(event) => setTransferToId(event.target.value ? Number(event.target.value) : null)}
              className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('common.selectAccount')}</option>
              {accounts
                .filter((account) => account.id !== selectedAccountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            {t('common.amount')} ({selectedCurrencyCode})
            <input
              type="number"
              min="0"
              step="0.01"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
              className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          {isCrossCurrencyTransfer ? (
            <label className="text-sm">
              Destination receives ({destinationCurrencyCode})
              <input
                type="number"
                min="0"
                step="0.01"
                value={transferReceivedAmount}
                onChange={(event) => setTransferReceivedAmount(event.target.value)}
                className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          <label className="text-sm">
            {t('common.description')}
            <input
              type="text"
              value={transferDescription}
              onChange={(event) => setTransferDescription(event.target.value)}
              className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <Button onClick={() => void createTransfer()}>{t('common.createTransfer')}</Button>
        </div>
      </ChartCard>

      <ChartCard
        title={t('common.accountStatement')}
        subtitle={t('common.transactionsCount', { count: statementPayments.length })}
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
        {statementGroupedByDate.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common.noTransactionsForPeriod')}</p>
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
                    {row.type === 'carry' ? (
                      <div className="px-4 py-1 text-xs text-muted-foreground">{t('common.carriedOver')}</div>
                    ) : null}
                    {row.type === 'payment' ? (
                      (() => {
                        const payment = row.payment
                        const signed = selectedAccountId ? getSignedAmount(payment, selectedAccountId) : payment.amount
                        const isReconciled = (payment.status ?? '').toLowerCase() === 'reconciled'
                        const StatusIcon = getStatusIcon(payment.status)
                        const category = categories.find((item) => item.id === Number(payment.category_id))
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
                              onClick={() => openEditModal(payment)}
                              className="truncate text-left font-medium underline-offset-2 hover:underline"
                            >
                              {payment.description}
                            </button>
                            <div className={`text-right ${signed >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {currencyFormatter.format(Math.abs(signed))}
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                aria-label={isReconciled ? t('common.moveToPending') : t('common.confirmTransaction')}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${getStatusButtonClass(payment.status)}`}
                                onClick={() => void confirmPayment(payment.id)}
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

      {editingBankAccount ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Edit bank account</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                Name
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editBankForm.name}
                  onChange={(e) => setEditBankForm((c) => ({ ...c, name: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Type
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editBankForm.account_type}
                  onChange={(e) =>
                    setEditBankForm((c) => ({ ...c, account_type: e.target.value as 'checking' | 'savings' | 'money_market' | 'other' }))
                  }
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="money_market">Money market</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-sm">
                Bank name
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editBankForm.bank_name}
                  onChange={(e) => setEditBankForm((c) => ({ ...c, bank_name: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Last 4 digits
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editBankForm.account_number_last4}
                  onChange={(e) => setEditBankForm((c) => ({ ...c, account_number_last4: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Balance
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editBankForm.balance}
                  onChange={(e) => setEditBankForm((c) => ({ ...c, balance: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Currency
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editBankForm.currency}
                  onChange={(e) => setEditBankForm((c) => ({ ...c, currency: e.target.value }))}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Color
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-14 cursor-pointer rounded border bg-background"
                    value={editBankForm.color}
                    onChange={(e) => setEditBankForm((c) => ({ ...c, color: e.target.value }))}
                  />
                  <input
                    className="w-24 rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={editBankForm.color}
                    onChange={(e) => setEditBankForm((c) => ({ ...c, color: e.target.value }))}
                  />
                </div>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingBankAccount(null)}>
                Cancel
              </Button>
              <Button onClick={() => void saveBankEdit()}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}

      {editingPayment ? (
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
              {editingPayment.occurrence_id && editingPayment.payment_type === 'recurring' ? (
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
                  value={editForm.due_date}
                  onChange={(event) => setEditForm((current) => ({ ...current, due_date: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
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
                  onChange={(event) =>
                    setEditForm((current) => {
                      const transactionType = event.target.value as TransactionType
                      return { ...current, transactionType, categoryChild: defaultChildCategory(transactionType) }
                    })
                  }
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
                  value={editForm.categoryChild}
                  onChange={(event) => setEditForm((current) => ({ ...current, categoryChild: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  {(categories.filter((item) => item.transaction_type === editForm.transactionType).map((item) => item.name).length > 0
                    ? categories.filter((item) => item.transaction_type === editForm.transactionType).map((item) => item.name)
                    : TRANSACTION_CHILD_CATEGORIES[editForm.transactionType]
                  ).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                {t('common.tags')}
                <select
                  multiple
                  value={editTagIds.map(String)}
                  onChange={(event) => {
                    const ids = Array.from(event.target.selectedOptions).map((option) => Number(option.value))
                    setEditTagIds(ids)
                  }}
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
                onClick={() => void deletePayment(editingPayment.id)}
              >
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingPayment(null)}>
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
