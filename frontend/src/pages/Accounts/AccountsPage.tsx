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
  attachChildCategoryToNotes,
  defaultChildCategory,
  getDisplayCategory,
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
  status?: string | null
  notes?: string | null
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

  const loadData = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const [accountsRes, paymentsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/bank-accounts?user_id=${USER_ID}`),
        fetch(`${API_BASE_URL}/payments?user_id=${USER_ID}&limit=500`),
      ])

      if (!accountsRes.ok || !paymentsRes.ok) throw new Error('Failed to load account statement data.')

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
        due_date?: string
        status?: string
        notes?: string
        from_account_id?: number
        to_account_id?: number
      }>
      setPayments(
        rawPayments.map((payment) => ({
          id: payment.id,
          description: payment.description,
          amount: Number(payment.amount),
          category: payment.category,
          due_date: payment.due_date,
          status: payment.status,
          notes: payment.notes,
          from_account_id: payment.from_account_id,
          to_account_id: payment.to_account_id,
        })),
      )
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
      if (new Date(payment.due_date) >= monthStart) continue
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
      running += getSignedAmount(payment, selectedAccountId)
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
    return buildRunningBalanceSeries(selectedAccount.balance, statementPayments, selectedAccountId)
  }, [selectedAccountId, selectedAccount, statementPayments])

  const cashflowSeries = useMemo(() => {
    const byDay = new Map<string, { inflow: number; outflow: number }>()
    if (!selectedAccountId) return []
    for (const payment of statementPayments) {
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
    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}?user_id=${USER_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error('Transaction update failed.')
    const updated = (await response.json()) as PaymentRow
    setPayments((current) => current.map((payment) => (payment.id === paymentId ? { ...payment, ...updated, amount: Number(updated.amount) } : payment)))
    setNotice(successMessage)
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
      categoryChild: getDisplayCategory(payment.category, payment.notes),
      due_date: payment.due_date ?? '',
      status: (payment.status ?? 'pending').toLowerCase(),
      notes: payment.notes ?? '',
    })
  }

  const saveEdit = async () => {
    if (!editingPayment) return
    try {
      await updatePayment(
        editingPayment.id,
        {
          description: editForm.description,
          amount: Number(editForm.amount),
          due_date: editForm.due_date,
          category: editForm.transactionType,
          status: editForm.status,
          notes: attachChildCategoryToNotes(editForm.notes, editForm.categoryChild),
        },
        'Transaction updated successfully.',
      )
      setEditingPayment(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit action failed.')
    }
  }

  const deletePayment = async (paymentId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/payments/${paymentId}?user_id=${USER_ID}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete action failed.')
      setPayments((current) => current.filter((payment) => payment.id !== paymentId))
      setNotice('Transaction deleted.')
      setEditingPayment(null)
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
          notes: attachChildCategoryToNotes('', 'savings'),
        }),
      })
      if (!response.ok) throw new Error('Transfer creation failed.')
      const created = (await response.json()) as PaymentRow
      setPayments((current) => [{ ...created, amount: Number(created.amount) }, ...current])
      setNotice('Transfer created successfully.')
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
            <p className="mt-2 text-xs text-amber-700">
              Statement includes unassigned transactions (without linked account). Assign `from/to account` for strict account-only statements.
            </p>
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
                        <div className="col-span-2 text-muted-foreground">{getDisplayCategory(payment.category, payment.notes)}</div>
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
                  {TRANSACTION_CHILD_CATEGORIES[editForm.transactionType].map((option) => (
                    <option key={option} value={option}>
                      {option}
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
