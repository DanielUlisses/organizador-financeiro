import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMonthContext } from '@/app/providers/MonthContextProvider'
import { ChartCard } from '@/components/common/ChartCard'
import { MonthNavigator } from '@/components/common/MonthNavigator'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'
import { CHART_THEME } from '@/lib/chart-colors'
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

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const USER_ID = 1
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const EFFECTIVE_STATUSES = new Set(['processed', 'reconciled'])
const PENDING_STATUSES = new Set(['pending', 'scheduled'])

export function AccountsPage() {
  const { currentMonth } = useMonthContext()
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
  const [transferDescription, setTransferDescription] = useState('Transfer between accounts')
  const [categories, setCategories] = useState<Array<{ id: number; transaction_type: TransactionType; name: string }>>([])
  const [tags, setTags] = useState<Array<{ id: number; name: string }>>([])
  const [editTagIds, setEditTagIds] = useState<number[]>([])
  const [recurringScope, setRecurringScope] = useState<'only_event' | 'from_event_forward' | 'all_events'>('only_event')

  const loadData = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const [accountsRes, paymentsRes, categoriesRes, tagsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/bank-accounts?user_id=${USER_ID}`),
        fetch(`${API_BASE_URL}/payments?user_id=${USER_ID}&limit=500`),
        fetch(`${API_BASE_URL}/transaction-metadata/categories?user_id=${USER_ID}`),
        fetch(`${API_BASE_URL}/transaction-metadata/tags?user_id=${USER_ID}`),
      ])

      if (!accountsRes.ok || !paymentsRes.ok || !categoriesRes.ok || !tagsRes.ok) {
        throw new Error('Failed to load account statement data.')
      }

      const rawAccounts = (await accountsRes.json()) as Array<{
        id: number
        name: string
        balance: unknown
        account_type: string
        bank_name?: string
      }>
      const accountData: BankAccount[] = rawAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        balance: Number(account.balance),
        account_type: account.account_type,
        bank_name: account.bank_name,
      }))
      setAccounts(accountData)
      setSelectedAccountId((current) => current ?? accountData[0]?.id ?? null)

      const rawPayments = (await paymentsRes.json()) as Array<{
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
        from_account_id?: number
        to_account_id?: number
        tag_ids?: number[]
      }>
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
            category_id: payment.category_id,
            due_date: payment.due_date,
            status: payment.status,
            notes: payment.notes,
            from_account_id: payment.from_account_id,
            to_account_id: payment.to_account_id,
            tag_ids: payment.tag_ids ?? [],
          })
          continue
        }
        const occurrences = recurringByPaymentId.get(payment.id) ?? []
        for (const occurrence of occurrences) {
          flattenedPayments.push({
            id: Number(`${payment.id}${occurrence.id}`),
            payment_id: payment.id,
            occurrence_id: occurrence.id,
            payment_type: payment.payment_type,
            description: payment.description,
            amount: Number(occurrence.amount),
            category: payment.category,
            category_id: payment.category_id,
            due_date: occurrence.scheduled_date,
            status: occurrence.status ?? payment.status,
            notes: occurrence.notes ?? payment.notes,
            from_account_id: payment.from_account_id,
            to_account_id: payment.to_account_id,
            tag_ids: payment.tag_ids ?? [],
          })
        }
      }
      setPayments(flattenedPayments)
      const rawCategories = (await categoriesRes.json()) as Array<{ id: number; transaction_type: string; name: string }>
      setCategories(
        rawCategories.map((item) => ({
          id: item.id,
          transaction_type: getTransactionTypeFromBackendCategory(item.transaction_type),
          name: item.name,
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

  const monthlyPayments = useMemo(
    () => payments.filter((payment) => payment.due_date && isInMonth(payment.due_date, currentMonth)),
    [payments, currentMonth],
  )

  const statementPayments = useMemo(
    () =>
      monthlyPayments.filter(
        (payment) =>
          payment.from_account_id === selectedAccountId ||
          payment.to_account_id === selectedAccountId,
      ),
    [monthlyPayments, selectedAccountId],
  )
  const hasUnassignedTransactions = monthlyPayments.some((payment) => !payment.from_account_id && !payment.to_account_id)

  const allAccountPayments = useMemo(
    () =>
      payments.filter(
        (payment) =>
          payment.from_account_id === selectedAccountId ||
          payment.to_account_id === selectedAccountId,
      ),
    [payments, selectedAccountId],
  )

  const monthStart = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
    [currentMonth],
  )
  const monthEnd = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0),
    [currentMonth],
  )
  const carryOverBalance = useMemo(() => {
    if (!selectedAccount || !selectedAccountId) return 0
    let rolling = selectedAccount.balance
    for (const payment of allAccountPayments) {
      if (!payment.due_date) continue
      const status = (payment.status ?? 'pending').toLowerCase()
      if (!EFFECTIVE_STATUSES.has(status)) continue
      const dueDate = new Date(payment.due_date)
      if (dueDate < monthStart) continue
      rolling -= getSignedAmount(payment, selectedAccountId, false)
    }
    return rolling
  }, [allAccountPayments, monthStart, selectedAccount, selectedAccountId])

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

    const carryKey = monthStart.toISOString().slice(0, 10)
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
  }, [statementPayments, selectedAccount, selectedAccountId, sortOrder, carryOverBalance, monthStart])

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
    const now = new Date()
    const cutoff = monthEnd < now ? monthEnd : now
    let running = carryOverBalance
    for (const payment of statementPayments) {
      if (!payment.due_date) continue
      const status = (payment.status ?? 'pending').toLowerCase()
      if (!EFFECTIVE_STATUSES.has(status)) continue
      const due = new Date(payment.due_date)
      if (due > cutoff) continue
      running += getSignedAmount(payment, selectedAccountId)
    }
    return running
  }, [carryOverBalance, monthEnd, selectedAccountId, statementPayments])

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

  const normalizeDateKey = (value?: string | null) => (value ?? '').slice(0, 10)
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
    try {
      const response = await fetch(`${API_BASE_URL}/payments/one-time?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: transferDescription,
          amount: Number(transferAmount),
          currency: 'USD',
          category: 'transfer',
          from_account_type: 'bank_account',
          from_account_id: selectedAccountId,
          to_account_type: 'bank_account',
          to_account_id: transferToId,
          due_date: new Date().toISOString().slice(0, 10),
          notes: '',
        }),
      })
      if (!response.ok) throw new Error('Transfer creation failed.')
      const created = (await response.json()) as PaymentRow
      setPayments((current) => [{ ...created, amount: Number(created.amount) }, ...current])
      setNotice('Transfer created successfully.')
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer action failed.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeader
          title="Accounts"
          subtitle="Monthly account statement with transaction consolidation, edits, deletes, and transfers"
          actions={<MonthNavigator />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium" htmlFor="account-select">
              Account
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

            <label className="ml-4 text-sm font-medium" htmlFor="sort-order">
              Sort
            </label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as 'older' | 'newer')}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="newer">Newer first</option>
              <option value="older">Older first</option>
            </select>

            <Button variant="outline" onClick={() => void loadData()}>
              Refresh
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedAccount
              ? `${selectedAccount.bank_name ?? 'Bank'} • ${selectedAccount.account_type}`
              : 'Select an account'}
          </p>
          {hasUnassignedTransactions ? (
            <p className="mt-2 text-xs text-amber-700">Statement includes unassigned transactions. Link accounts for strict statements.</p>
          ) : null}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Current balance</p>
          <p className="mt-2 text-2xl font-semibold">{currency.format(displayedCurrentBalance)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Net this month: <span className={totals.net >= 0 ? 'text-green-600' : 'text-red-500'}>{currency.format(totals.net)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Expected end of month: <span className="font-medium">{currency.format(expectedEndOfMonthBalance)}</span>
          </p>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading account statement...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Account balance health" subtitle="Running balance and cumulative expenses">
          {runningBalanceSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions in this month for selected account.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={runningBalanceSeries}>
                  <defs>
                    <linearGradient id="account-balance-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_THEME.series.balance} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={CHART_THEME.series.balance} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currency.format(Number(value))} />
                  <Area type="monotone" dataKey="balance" stroke={CHART_THEME.series.balance} fill="url(#account-balance-gradient)" />
                  <Line type="monotone" dataKey="cumulativeExpenses" stroke={CHART_THEME.series.expenses} strokeWidth={2} dot={false} name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Inflow vs outflow" subtitle={`Inflow ${currency.format(totals.inflow)} • Outflow ${currency.format(totals.outflow)}`}>
          {cashflowSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cashflow points in selected month.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashflowSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currency.format(Number(value))} />
                  <Bar dataKey="inflow" fill={CHART_THEME.series.inflow} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="outflow" fill={CHART_THEME.series.outflow} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Transfer between accounts" subtitle="Create a one-time transfer transaction">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Destination
            <select
              value={transferToId ?? ''}
              onChange={(event) => setTransferToId(Number(event.target.value))}
              className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select account</option>
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
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
              className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            Description
            <input
              type="text"
              value={transferDescription}
              onChange={(event) => setTransferDescription(event.target.value)}
              className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <Button onClick={() => void createTransfer()}>Create transfer</Button>
        </div>
      </ChartCard>

      <ChartCard title="Account statement" subtitle={`${statementPayments.length} transactions in selected month`}>
        {statementGroupedByDate.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions available for selected period.</p>
        ) : (
          <div className="space-y-2">
            {statementGroupedByDate.map((group, groupIndex) => (
              <div key={group.date} className={groupIndex % 2 === 1 ? 'rounded-md bg-secondary/20 px-2 py-1' : 'px-2 py-1'}>
                <div className="mb-1 flex items-center justify-between border-b pb-1 text-sm font-semibold">
                  <span>{group.date}</span>
                  <span>{currency.format(group.closingBalance)}</span>
                </div>
                <div className="space-y-1">
                  {group.items.length === 0 ? (
                    <div className="px-2 py-1 text-xs text-muted-foreground">Carried over from previous month.</div>
                  ) : null}
                  {group.items.map((payment) => {
                    const signed = selectedAccountId ? getSignedAmount(payment, selectedAccountId) : payment.amount
                    const isReconciled = (payment.status ?? '').toLowerCase() === 'reconciled'
                    return (
                      <div key={payment.id} className="grid grid-cols-12 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-background/60">
                        <div className="col-span-4 truncate">{payment.description}</div>
                        <div className="col-span-2 text-muted-foreground">{categories.find((item) => item.id === payment.category_id)?.name ?? '-'}</div>
                        <div className="col-span-2 text-muted-foreground">{payment.status ?? '-'}</div>
                        <div className={`col-span-2 text-right ${signed >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {currency.format(Math.abs(signed))}
                        </div>
                        <div className="col-span-2 flex justify-end gap-1">
                          <button
                            type="button"
                            aria-label={isReconciled ? 'Move to pending' : 'Confirm transaction'}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${isReconciled ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-card'}`}
                            onClick={() => void confirmPayment(payment.id)}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Edit transaction"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card"
                            onClick={() => openEditModal(payment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {editingPayment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Edit transaction</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                Description
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              {editingPayment.occurrence_id && editingPayment.payment_type === 'recurring' ? (
                <label className="text-sm sm:col-span-2">
                  Recurring scope
                  <select
                    value={recurringScope}
                    onChange={(event) =>
                      setRecurringScope(event.target.value as 'only_event' | 'from_event_forward' | 'all_events')
                    }
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  >
                    <option value="only_event">Only this event</option>
                    <option value="from_event_forward">From this event forward</option>
                    <option value="all_events">All events</option>
                  </select>
                </label>
              ) : null}
              <label className="text-sm">
                Date
                <input
                  type="date"
                  value={editForm.due_date}
                  onChange={(event) => setEditForm((current) => ({ ...current, due_date: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Value
                <input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Transaction type
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
                  {(['expense', 'income', 'transfer'] as TransactionType[]).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Category
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
                Tags
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
                Status
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="pending">pending</option>
                  <option value="processed">processed</option>
                  <option value="reconciled">reconciled</option>
                  <option value="scheduled">scheduled</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                Notes
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
                Delete
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingPayment(null)}>
                  Cancel
                </Button>
                <Button onClick={() => void saveEdit()}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
