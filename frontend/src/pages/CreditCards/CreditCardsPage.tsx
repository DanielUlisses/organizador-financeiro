import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMonthContext } from '@/app/providers/MonthContextProvider'
import { ChartCard } from '@/components/common/ChartCard'
import { MonthNavigator } from '@/components/common/MonthNavigator'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'
import { CHART_THEME } from '@/lib/chart-colors'
import { getTransactionTypeFromBackendCategory, type TransactionType } from '@/lib/transaction-taxonomy'

type CreditCard = {
  id: number
  name: string
  issuer?: string | null
  current_balance: number
  credit_limit: number
  available_credit: number
  utilization_percentage: number
  default_payment_account_id?: number | null
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

type EditForm = {
  description: string
  amount: string
  transactionType: TransactionType
  categoryId: string
  dueDate: string
  status: string
  notes: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const USER_ID = 1
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10)
const normalizeDate = (value?: string | null) => (value ?? '').slice(0, 10)
const shiftIsoDate = (value: string, deltaDays: number) => {
  const date = new Date(`${normalizeDate(value)}T00:00:00`)
  date.setDate(date.getDate() + deltaDays)
  return toIsoDate(date)
}

export function CreditCardsPage() {
  const { currentMonth } = useMonthContext()
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
  const [categories, setCategories] = useState<Array<{ id: number; transaction_type: TransactionType; name: string }>>([])
  const [tags, setTags] = useState<Array<{ id: number; name: string }>>([])
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: number; name: string }>>([])
  const [paymentAccountId, setPaymentAccountId] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(referenceDate)
  const [paymentDescription, setPaymentDescription] = useState('Credit card payment')

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  )

  const loadCards = async () => {
    const response = await fetch(`${API_BASE_URL}/credit-cards?user_id=${USER_ID}&limit=200`)
    if (!response.ok) throw new Error('Failed to load credit cards.')
    const raw = (await response.json()) as Array<{
      id: number
      name: string
      issuer?: string
      current_balance: unknown
      credit_limit: unknown
      available_credit: unknown
      utilization_percentage: unknown
      default_payment_account_id?: number | null
    }>
    const mapped: CreditCard[] = raw.map((card) => ({
      id: card.id,
      name: card.name,
      issuer: card.issuer,
      current_balance: Number(card.current_balance),
      credit_limit: Number(card.credit_limit),
      available_credit: Number(card.available_credit),
      utilization_percentage: Number(card.utilization_percentage),
      default_payment_account_id: card.default_payment_account_id,
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
      category_id?: number
      notes?: string
      tag_ids?: number[]
      from_account_id?: number
    }>
    const paymentMap = new Map(paymentsRaw.map((payment) => [payment.id, payment]))

    const categoriesRaw = (await categoriesRes.json()) as Array<{ id: number; transaction_type: string; name: string }>
    setCategories(
      categoriesRaw.map((item) => ({
        id: item.id,
        transaction_type: getTransactionTypeFromBackendCategory(item.transaction_type),
        name: item.name,
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
        category_id: payment?.category_id,
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
          currency: 'USD',
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
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeader
          title="Credit Cards"
          subtitle="Invoice-cycle statement with grouped lines, reconciliation, and recurring-aware edits/deletes"
          actions={<MonthNavigator />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium" htmlFor="card-select">
              Card
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
            <label className="ml-4 text-sm font-medium" htmlFor="credit-sort-order">
              Sort
            </label>
            <select
              id="credit-sort-order"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as 'older' | 'newer')}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="older">Older first</option>
              <option value="newer">Newer first</option>
            </select>
            <Button variant="outline" onClick={() => void refreshData()}>
              Refresh
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedCard
              ? `${selectedCard.issuer ?? 'Card issuer'} • limit ${currency.format(selectedCard.credit_limit)} • utilization ${selectedCard.utilization_percentage.toFixed(1)}%`
              : 'Select a credit card'}
          </p>
          {summary ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Cycle {summary.cycle_start_date} to {summary.cycle_end_date} • closes {summary.close_date} • due {summary.due_date}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Current card balance</p>
          <p className="mt-2 text-2xl font-semibold">{currency.format(selectedCard?.current_balance ?? 0)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Available: {currency.format(selectedCard?.available_credit ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Statement balance: <span className="font-medium">{currency.format(summary?.statement_balance ?? 0)}</span>
          </p>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading credit card statement...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Invoice balance health" subtitle="Running statement balance and daily charges">
          {chartSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No card transactions in this cycle.</p>
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
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currency.format(Number(value))} />
                  <Area type="monotone" dataKey="runningBalance" stroke={CHART_THEME.series.balance} fill="url(#cc-balance-gradient)" name="Running balance" />
                  <Area type="monotone" dataKey="dailyCharges" stroke={CHART_THEME.series.expenses} fill="url(#cc-charges-gradient)" name="Daily charges" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Charges vs payments"
          subtitle={`Charges ${currency.format(summary?.charges_total ?? 0)} • Payments ${currency.format(summary?.payments_total ?? 0)}`}
        >
          {chartSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flow points in this cycle.</p>
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
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currency.format(Number(value))} />
                  <Area type="monotone" dataKey="charges" stroke={CHART_THEME.series.outflow} fill="url(#cc-charges-flow-gradient)" strokeWidth={2} />
                  <Area type="monotone" dataKey="payments" stroke={CHART_THEME.series.inflow} fill="url(#cc-payments-flow-gradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Register card payment" subtitle="Delete planned payment and create with another account when needed">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="text-sm sm:col-span-2">
            Source account
            <select
              value={paymentAccountId}
              onChange={(event) => setPaymentAccountId(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="">Select account</option>
              {bankAccounts.map((account) => (
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
              step="0.01"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Date
            <input
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-3">
            Description
            <input
              type="text"
              value={paymentDescription}
              onChange={(event) => setPaymentDescription(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <Button onClick={() => void createCardPayment()} className="w-full">
              Create payment
            </Button>
          </div>
        </div>
      </ChartCard>

      <ChartCard title="Card statement (invoice cycle)" subtitle={`${summary?.transactions.length ?? 0} transactions in cycle`}>
        {groupedStatement.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions available for selected cycle.</p>
        ) : (
          <div className="space-y-2">
            {groupedStatement.map((group, index) => (
              <div key={group.date} className={index % 2 === 1 ? 'rounded-md bg-secondary/20 px-2 py-1' : 'px-2 py-1'}>
                <div className="mb-1 flex items-center justify-between border-b pb-1 text-sm font-semibold">
                  <span>{group.date}</span>
                  <span>{currency.format(group.closingBalance)}</span>
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isReconciled = item.status === 'reconciled'
                    return (
                      <div key={`${item.payment_id}-${item.occurrence_id ?? 'base'}-${item.transaction_date}`} className="grid grid-cols-12 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-background/60">
                        <div className="col-span-4 truncate">{item.description}</div>
                        <div className="col-span-2 text-muted-foreground">{categories.find((cat) => cat.id === item.category_id)?.name ?? '-'}</div>
                        <div className="col-span-2 text-muted-foreground">{item.status}</div>
                        <div className={`col-span-2 text-right ${item.signed_amount < 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {currency.format(Math.abs(item.amount))}
                        </div>
                        <div className="col-span-2 flex justify-end gap-1">
                          <button
                            type="button"
                            aria-label={isReconciled ? 'Move to pending' : 'Confirm transaction'}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${
                              isReconciled ? 'border-emerald-500 bg-emerald-500 text-white' : 'bg-card'
                            }`}
                            onClick={() => void toggleConfirm(item)}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Edit transaction"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card"
                            onClick={() => openEditModal(item)}
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

      {editing ? (
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
              {editing.occurrence_id && editing.payment_type === 'recurring' ? (
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
                  value={editForm.dueDate}
                  onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              {editing.direction === 'payment' ? (
                <label className="text-sm">
                  Source account
                  <select
                    value={paymentAccountId}
                    onChange={(event) => setPaymentAccountId(event.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  >
                    <option value="">Select account</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
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
                  onChange={(event) => setEditForm((current) => ({ ...current, transactionType: event.target.value as TransactionType }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="expense">expense</option>
                  <option value="income">income</option>
                  <option value="transfer">transfer</option>
                </select>
              </label>
              <label className="text-sm">
                Category
                <select
                  value={editForm.categoryId}
                  onChange={(event) => setEditForm((current) => ({ ...current, categoryId: event.target.value }))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="">No category</option>
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
                Tags
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
                onClick={() => void deleteTransaction()}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
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
