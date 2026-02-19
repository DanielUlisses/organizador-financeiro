import { useEffect, useMemo, useState } from 'react'
import { Calculator, Plus, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  attachChildCategoryToNotes,
  defaultChildCategory,
  TRANSACTION_CHILD_CATEGORIES,
  type TransactionType,
} from '@/lib/transaction-taxonomy'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const USER_ID = 1

type TransactionKind = 'one_time' | 'recurring' | 'investment'

const getDefaultsByPath = (path: string) => {
  if (path.startsWith('/credit-cards')) return { kind: 'one_time' as TransactionKind, fromType: 'credit_card' as const }
  if (path.startsWith('/investments')) return { kind: 'investment' as TransactionKind, fromType: 'investment' as const }
  return { kind: 'one_time' as TransactionKind, fromType: 'bank_account' as const }
}

export function GlobalTransactionFab() {
  const { pathname } = useLocation()
  const defaults = useMemo(() => getDefaultsByPath(pathname), [pathname])

  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [calcInput, setCalcInput] = useState('')
  const [calcTerms, setCalcTerms] = useState<number[]>([])

  const [kind, setKind] = useState<TransactionKind>(defaults.kind)
  const [description, setDescription] = useState('New transaction')
  const [amount, setAmount] = useState('0')
  const [transactionType, setTransactionType] = useState<TransactionType>('expense')
  const [categoryChild, setCategoryChild] = useState(defaultChildCategory('expense'))
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [fromAccountType, setFromAccountType] = useState<'bank_account' | 'credit_card'>(
    defaults.fromType === 'credit_card' ? 'credit_card' : 'bank_account',
  )
  const [fromAccountId, setFromAccountId] = useState<string>(
    localStorage.getItem('of_default_account_id') ?? '',
  )
  const [toAccountId, setToAccountId] = useState<string>('')
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: number; name: string }>>([])
  const [creditCards, setCreditCards] = useState<Array<{ id: number; name: string }>>([])
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('monthly')
  const [occurrenceCount, setOccurrenceCount] = useState('12')
  const [recurrenceAmountMode, setRecurrenceAmountMode] = useState<'total_split' | 'per_item'>('per_item')

  const calcTotal = calcTerms.reduce((sum, term) => sum + term, 0)

  useEffect(() => {
    const loadReferences = async () => {
      try {
        const [accountsRes, cardsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/bank-accounts?user_id=${USER_ID}`),
          fetch(`${API_BASE_URL}/credit-cards?user_id=${USER_ID}`),
        ])
        if (accountsRes.ok) {
          const data = (await accountsRes.json()) as Array<{ id: number; name: string }>
          setBankAccounts(data)
        }
        if (cardsRes.ok) {
          const data = (await cardsRes.json()) as Array<{ id: number; name: string }>
          setCreditCards(data)
        }
      } catch {
        // Keep modal functional even if lookup load fails.
      }
    }
    void loadReferences()
  }, [])

  const openModal = () => {
    setKind(defaults.kind)
    setFromAccountType(defaults.fromType === 'credit_card' ? 'credit_card' : 'bank_account')
    setFromAccountId(localStorage.getItem('of_default_account_id') ?? '')
    setToAccountId('')
    setDescription(defaults.fromType === 'credit_card' ? 'New card transaction' : 'New transaction')
    const defaultType: TransactionType = defaults.fromType === 'credit_card' ? 'expense' : 'expense'
    setTransactionType(defaultType)
    setCategoryChild(defaultChildCategory(defaultType))
    setNotes('')
    setAmount('0')
    setError(null)
    setNotice(null)
    setOpen(true)
  }

  const submit = async () => {
    setError(null)
    setNotice(null)

    if (kind === 'investment') {
      setNotice('Investment quick-add will be connected in the investments phase API flow.')
      return
    }

    const numericAmount = Number(amount)
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError('Amount must be greater than zero.')
      return
    }

    try {
      if (kind === 'one_time') {
        const isIncome = transactionType === 'income'
        const sourceId = fromAccountId ? Number(fromAccountId) : null
        const destinationId = toAccountId ? Number(toAccountId) : null
        const finalFromId = isIncome ? null : sourceId
        const finalToId = isIncome ? sourceId : destinationId
        const response = await fetch(`${API_BASE_URL}/payments/one-time?user_id=${USER_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description,
            amount: numericAmount,
            category: transactionType,
            currency: 'USD',
            due_date: dueDate,
            from_account_type: finalFromId ? fromAccountType : null,
            from_account_id: finalFromId,
            to_account_type: finalToId ? 'bank_account' : null,
            to_account_id: finalToId,
            notes: attachChildCategoryToNotes(notes, categoryChild),
          }),
        })
        if (!response.ok) throw new Error('Failed to create transaction.')
        setNotice('Transaction created.')
        return
      }

      const count = Math.max(1, Number(occurrenceCount))
      const recurringAmount = recurrenceAmountMode === 'total_split' ? numericAmount / count : numericAmount
      const response = await fetch(`${API_BASE_URL}/payments/recurring?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: recurringAmount,
          category: transactionType,
          currency: 'USD',
          frequency: recurrenceFrequency,
          start_date: dueDate,
          end_date: null,
          from_account_type: fromAccountType,
          from_account_id: fromAccountId ? Number(fromAccountId) : null,
          notes: attachChildCategoryToNotes(
            recurrenceAmountMode === 'total_split'
              ? `Created from total ${numericAmount.toFixed(2)} split into ${count} recurrences.`
              : notes,
            categoryChild,
          ),
        }),
      })
      if (!response.ok) throw new Error('Failed to create recurring transaction.')
      setNotice('Recurring transaction created.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create action failed.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        aria-label="Add transaction"
      >
        <Plus className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-xl rounded-xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add new transaction</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Type
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as TransactionKind)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="one_time">Regular transaction</option>
                  <option value="recurring">Recurring transaction</option>
                  <option value="investment">Investment entry</option>
                </select>
              </label>
              <label className="text-sm">
                Date
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Description
                <input
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Transaction type
                <select
                  value={transactionType}
                  onChange={(event) => {
                    const next = event.target.value as TransactionType
                    setTransactionType(next)
                    setCategoryChild(defaultChildCategory(next))
                  }}
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
                  value={categoryChild}
                  onChange={(event) => setCategoryChild(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  {TRANSACTION_CHILD_CATEGORIES[transactionType].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Amount
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2"
                  />
                  <Button type="button" variant="outline" onClick={() => setCalculatorOpen((current) => !current)}>
                    <Calculator className="h-4 w-4" />
                  </Button>
                </div>
              </label>
              <label className="text-sm">
                Source account type
                <select
                  value={fromAccountType}
                  onChange={(event) => setFromAccountType(event.target.value as 'bank_account' | 'credit_card')}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="bank_account">bank account</option>
                  <option value="credit_card">credit card</option>
                </select>
              </label>
              <label className="text-sm">
                Account
                <select
                  value={fromAccountId}
                  onChange={(event) => setFromAccountId(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="">Select source</option>
                  {(fromAccountType === 'bank_account' ? bankAccounts : creditCards).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Destination account (optional)
                <select
                  value={toAccountId}
                  onChange={(event) => setToAccountId(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="">None</option>
                  {bankAccounts
                    .filter((item) => String(item.id) !== fromAccountId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                Notes
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>

              {kind === 'recurring' ? (
                <>
                  <label className="text-sm">
                    Frequency
                    <select
                      value={recurrenceFrequency}
                      onChange={(event) => setRecurrenceFrequency(event.target.value)}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    >
                      <option value="monthly">monthly</option>
                      <option value="weekly">weekly</option>
                      <option value="daily">daily</option>
                      <option value="quarterly">quarterly</option>
                      <option value="yearly">yearly</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    Recurrence count
                    <input
                      type="number"
                      min="1"
                      value={occurrenceCount}
                      onChange={(event) => setOccurrenceCount(event.target.value)}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Recurring value mode
                    <select
                      value={recurrenceAmountMode}
                      onChange={(event) => setRecurrenceAmountMode(event.target.value as 'total_split' | 'per_item')}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    >
                      <option value="per_item">Amount is value for each recurrence item</option>
                      <option value="total_split">Amount is total to split across recurrence count</option>
                    </select>
                  </label>
                </>
              ) : null}
            </div>

            {calculatorOpen ? (
              <div className="mt-4 rounded-md border bg-background p-3">
                <p className="text-sm font-medium">Quick sum calculator</p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={calcInput}
                    onChange={(event) => setCalcInput(event.target.value)}
                    className="w-full rounded-md border bg-card px-3 py-2"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const term = Number(calcInput)
                      if (!Number.isNaN(term)) {
                        setCalcTerms((current) => [...current, term])
                        setCalcInput('')
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Terms: {calcTerms.length > 0 ? calcTerms.join(' + ') : 'none'}</p>
                <p className="mt-1 text-sm font-semibold">Total: {calcTotal.toFixed(2)}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAmount(calcTotal.toFixed(2))
                      setCalculatorOpen(false)
                    }}
                  >
                    Use total
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setCalcTerms([])}>
                    Clear
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
            {notice ? <p className="mt-3 text-sm text-emerald-600">{notice}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button onClick={() => void submit()}>Create</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
