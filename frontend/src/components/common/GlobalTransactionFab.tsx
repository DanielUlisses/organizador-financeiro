import { useEffect, useMemo, useState } from 'react'
import { Calculator, Plus, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useReducedVisualEffects } from '@/hooks/useReducedVisualEffects'
import {
  defaultChildCategory,
  getTransactionTypeFromBackendCategory,
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

const addByFrequency = (baseDate: Date, frequency: string, steps: number) => {
  const next = new Date(baseDate)
  if (frequency === 'daily') next.setDate(next.getDate() + steps)
  else if (frequency === 'weekly') next.setDate(next.getDate() + 7 * steps)
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + steps)
  else if (frequency === 'quarterly') next.setMonth(next.getMonth() + 3 * steps)
  else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + steps)
  return next
}

export function GlobalTransactionFab() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const defaults = useMemo(() => getDefaultsByPath(pathname), [pathname])
  const reducedVisualEffects = useReducedVisualEffects()

  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [calcInput, setCalcInput] = useState('')
  const [calcTerms, setCalcTerms] = useState<number[]>([])

  const [kind, setKind] = useState<TransactionKind>(defaults.kind)
  const [description, setDescription] = useState('')
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
  const [transferReceivedAmount, setTransferReceivedAmount] = useState('')
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: number; name: string; currency?: string }>>([])
  const [creditCards, setCreditCards] = useState<Array<{ id: number; name: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: number; transaction_type: TransactionType; name: string }>>([])
  const [tags, setTags] = useState<Array<{ id: number; name: string }>>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('monthly')
  const [occurrenceCount, setOccurrenceCount] = useState('12')
  const [recurrenceAmountMode, setRecurrenceAmountMode] = useState<'total_split' | 'per_item'>('per_item')
  const selectedSourceBankAccount = bankAccounts.find((account) => String(account.id) === fromAccountId)
  const selectedDestinationBankAccount = bankAccounts.find((account) => String(account.id) === toAccountId)
  const isCrossCurrencyTransfer =
    transactionType === 'transfer' &&
    fromAccountType === 'bank_account' &&
    Boolean(selectedSourceBankAccount && selectedDestinationBankAccount) &&
    (selectedSourceBankAccount?.currency ?? 'USD').toUpperCase() !== (selectedDestinationBankAccount?.currency ?? 'USD').toUpperCase()

  const calcTotal = calcTerms.reduce((sum, term) => sum + term, 0)

  useEffect(() => {
    const loadReferences = async () => {
      try {
        const [accountsRes, cardsRes, categoriesRes, tagsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/bank-accounts?user_id=${USER_ID}`),
          fetch(`${API_BASE_URL}/credit-cards?user_id=${USER_ID}`),
          fetch(`${API_BASE_URL}/transaction-metadata/categories?user_id=${USER_ID}`),
          fetch(`${API_BASE_URL}/transaction-metadata/tags?user_id=${USER_ID}`),
        ])
        if (accountsRes.ok) {
          const data = (await accountsRes.json()) as Array<{ id: number; name: string; currency?: string }>
          setBankAccounts(data)
        }
        if (cardsRes.ok) {
          const data = (await cardsRes.json()) as Array<{ id: number; name: string }>
          setCreditCards(data)
        }
        if (categoriesRes.ok) {
          const data = (await categoriesRes.json()) as Array<{ id: number; transaction_type: string; name: string }>
          setCategories(
            data.map((item) => ({
              id: item.id,
              transaction_type: getTransactionTypeFromBackendCategory(item.transaction_type),
              name: item.name,
            })),
          )
        }
        if (tagsRes.ok) {
          const data = (await tagsRes.json()) as Array<{ id: number; name: string }>
          setTags(data)
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
    setTransferReceivedAmount('')
    setDescription(defaults.fromType === 'credit_card' ? t('fab.newCardTransaction') : t('fab.newTransaction'))
    const defaultType: TransactionType = defaults.fromType === 'credit_card' ? 'expense' : 'expense'
    setTransactionType(defaultType)
    setCategoryChild(defaultChildCategory(defaultType))
    setNotes('')
    setSelectedTagIds([])
    setAmount('0')
    setError(null)
    setNotice(null)
    setOpen(true)
  }

  const submit = async () => {
    setError(null)
    setNotice(null)

    if (kind === 'investment') {
      setNotice(t('fab.investmentQuickAddNote'))
      return
    }

    const numericAmount = Number(amount)
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError(t('fab.amountGreaterZero'))
      return
    }

    try {
      if (!fromAccountId) {
        setError(t('fab.selectAccount'))
        return
      }

      const selectedCategory = categories.find((item) => item.transaction_type === transactionType && item.name === categoryChild)

      if (kind === 'one_time') {
        const isIncome = transactionType === 'income'
        const sourceId = fromAccountId ? Number(fromAccountId) : null
        const destinationId = toAccountId ? Number(toAccountId) : null
        const isTransfer = transactionType === 'transfer'
        const sourceCurrency = (selectedSourceBankAccount?.currency ?? 'USD').toUpperCase()
        const destinationCurrency = (selectedDestinationBankAccount?.currency ?? 'USD').toUpperCase()
        const finalFromId = isIncome ? null : sourceId
        const finalToId = isIncome ? sourceId : destinationId

        if (isTransfer && isCrossCurrencyTransfer && sourceId && destinationId) {
          const receivedAmount = Number(transferReceivedAmount)
          if (Number.isNaN(receivedAmount) || receivedAmount <= 0) {
            setError('Destination amount must be greater than zero.')
            return
          }
          const baseDescription = description.trim() || 'Transfer between accounts'

          const outboundResponse = await fetch(`${API_BASE_URL}/payments/one-time?user_id=${USER_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: `${baseDescription} (${sourceCurrency} -> ${destinationCurrency})`,
              amount: numericAmount,
              category: 'transfer',
              category_id: selectedCategory?.id ?? null,
              tag_ids: selectedTagIds,
              currency: sourceCurrency,
              due_date: dueDate,
              from_account_type: 'bank_account',
              from_account_id: sourceId,
              to_account_type: null,
              to_account_id: null,
              notes: `cross_currency_out to_account_id=${destinationId} ${notes}`.trim(),
            }),
          })
          if (!outboundResponse.ok) throw new Error('Failed to create transaction.')

          const inboundResponse = await fetch(`${API_BASE_URL}/payments/one-time?user_id=${USER_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: `${baseDescription} (${sourceCurrency} -> ${destinationCurrency})`,
              amount: receivedAmount,
              category: 'transfer',
              category_id: selectedCategory?.id ?? null,
              tag_ids: selectedTagIds,
              currency: destinationCurrency,
              due_date: dueDate,
              from_account_type: null,
              from_account_id: null,
              to_account_type: 'bank_account',
              to_account_id: destinationId,
              notes: `cross_currency_in from_account_id=${sourceId} ${notes}`.trim(),
            }),
          })
          if (!inboundResponse.ok) throw new Error('Failed to create transaction.')
        } else {
          const response = await fetch(`${API_BASE_URL}/payments/one-time?user_id=${USER_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description,
              amount: numericAmount,
              category: transactionType,
              category_id: selectedCategory?.id ?? null,
              tag_ids: selectedTagIds,
              currency: sourceCurrency,
              due_date: dueDate,
              from_account_type: finalFromId ? fromAccountType : null,
              from_account_id: finalFromId,
              to_account_type: finalToId ? 'bank_account' : null,
              to_account_id: finalToId,
              notes,
            }),
          })
          if (!response.ok) throw new Error('Failed to create transaction.')
        }
        setNotice(t('fab.transactionCreated'))
        window.dispatchEvent(new CustomEvent('of:transactions-changed'))
        setOpen(false)
        return
      }

      const count = Math.max(1, Number(occurrenceCount))
      const recurringAmount = recurrenceAmountMode === 'total_split' ? numericAmount / count : numericAmount
      const startDateObj = new Date(`${dueDate}T00:00:00`)
      const computedEndDate = addByFrequency(startDateObj, recurrenceFrequency, Math.max(0, count - 1))
      const computedEndDateIso = computedEndDate.toISOString().slice(0, 10)
      const response = await fetch(`${API_BASE_URL}/payments/recurring?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: recurringAmount,
          category: transactionType,
          category_id: selectedCategory?.id ?? null,
          tag_ids: selectedTagIds,
          currency: 'USD',
          frequency: recurrenceFrequency,
          start_date: dueDate,
          end_date: computedEndDateIso,
          from_account_type: fromAccountType,
          from_account_id: fromAccountId ? Number(fromAccountId) : null,
          notes:
            recurrenceAmountMode === 'total_split'
              ? `Created from total ${numericAmount.toFixed(2)} split into ${count} recurrences. ${notes}`.trim()
              : notes,
        }),
      })
      if (!response.ok) throw new Error('Failed to create recurring transaction.')
      const created = (await response.json()) as { id: number }
      const generateResponse = await fetch(
        `${API_BASE_URL}/payments/${created.id}/generate-occurrences?user_id=${USER_ID}&up_to_date=${computedEndDateIso}`,
        { method: 'POST' },
      )
      if (!generateResponse.ok) throw new Error('Recurring created but failed to generate future items.')
      setNotice(t('fab.recurringCreated'))
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fab.createActionFailed'))
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30 transition-transform hover:-translate-y-0.5"
        aria-label={t('fab.addTransaction')}
      >
        <Plus className="h-6 w-6" />
      </button>

      {open ? (
        <div
          className={`fixed inset-0 z-50 flex items-end justify-end bg-slate-950/45 p-4 sm:items-center sm:justify-center ${
            reducedVisualEffects ? '' : 'backdrop-blur-sm'
          }`}
        >
          <div
            className={`w-full max-w-xl rounded-3xl p-5 shadow-xl ${
              reducedVisualEffects ? 'border bg-card' : 'of-surface'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('fab.addNewTransaction')}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-300/70 text-red-500 transition-colors hover:bg-red-50 dark:border-red-800/60 dark:hover:bg-red-900/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                {t('common.type')}
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as TransactionKind)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="one_time">{t('fab.regularTransaction')}</option>
                  <option value="recurring">{t('fab.recurringTransaction')}</option>
                  <option value="investment">{t('fab.investmentEntry')}</option>
                </select>
              </label>
              <label className="text-sm">
                {t('common.date')}
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                {t('common.description')}
                <input
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                {t('fab.transactionType')}
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
                {t('common.category')}
                <select
                  value={categoryChild}
                  onChange={(event) => setCategoryChild(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  {(categories.filter((item) => item.transaction_type === transactionType).map((item) => item.name).length > 0
                    ? categories.filter((item) => item.transaction_type === transactionType).map((item) => item.name)
                    : TRANSACTION_CHILD_CATEGORIES[transactionType]
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
                  value={selectedTagIds.map(String)}
                  onChange={(event) => {
                    const ids = Array.from(event.target.selectedOptions).map((option) => Number(option.value))
                    setSelectedTagIds(ids)
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
                {t('common.amount')}
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
                {t('fab.sourceAccountType')}
                <select
                  value={fromAccountType}
                  onChange={(event) => setFromAccountType(event.target.value as 'bank_account' | 'credit_card')}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="bank_account">{t('fab.bankAccountOption')}</option>
                  <option value="credit_card">{t('fab.creditCardOption')}</option>
                </select>
              </label>
              <label className="text-sm">
                {t('common.account')}
                <select
                  value={fromAccountId}
                  onChange={(event) => setFromAccountId(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="">{t('common.selectSource')}</option>
                  {(fromAccountType === 'bank_account' ? bankAccounts : creditCards).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {t('fab.destinationAccountOptional')}
                <select
                  value={toAccountId}
                  onChange={(event) => setToAccountId(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="">{t('common.none')}</option>
                  {bankAccounts
                    .filter((item) => String(item.id) !== fromAccountId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              {isCrossCurrencyTransfer ? (
                <label className="text-sm">
                  Destination receives ({(selectedDestinationBankAccount?.currency ?? 'USD').toUpperCase()})
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferReceivedAmount}
                    onChange={(event) => setTransferReceivedAmount(event.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  />
                </label>
              ) : null}
              <label className="text-sm sm:col-span-2">
                {t('common.notes')}
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
                    {t('fab.frequency')}
                    <select
                      value={recurrenceFrequency}
                      onChange={(event) => setRecurrenceFrequency(event.target.value)}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    >
                      <option value="monthly">{t('fab.monthly')}</option>
                      <option value="weekly">{t('fab.weekly')}</option>
                      <option value="daily">{t('fab.daily')}</option>
                      <option value="quarterly">{t('fab.quarterly')}</option>
                      <option value="yearly">{t('fab.yearly')}</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    {t('fab.recurrenceCount')}
                    <input
                      type="number"
                      min="1"
                      value={occurrenceCount}
                      onChange={(event) => setOccurrenceCount(event.target.value)}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    {t('fab.recurringValueMode')}
                    <select
                      value={recurrenceAmountMode}
                      onChange={(event) => setRecurrenceAmountMode(event.target.value as 'total_split' | 'per_item')}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    >
                      <option value="per_item">{t('fab.amountPerRecurrence')}</option>
                      <option value="total_split">{t('fab.amountTotalSplit')}</option>
                    </select>
                  </label>
                </>
              ) : null}
            </div>

            {calculatorOpen ? (
              <div className="mt-4 rounded-md border bg-background p-3">
                <p className="text-sm font-medium">{t('common.quickSumCalculator')}</p>
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
                    {t('common.add')}
                  </Button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t('common.terms')}: {calcTerms.length > 0 ? calcTerms.join(' + ') : 'none'}</p>
                <p className="mt-1 text-sm font-semibold">{t('common.total')}: {calcTotal.toFixed(2)}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAmount(calcTotal.toFixed(2))
                      setCalculatorOpen(false)
                    }}
                  >
                    {t('common.useTotal')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setCalcTerms([])}>
                    {t('common.clear')}
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
            {notice ? <p className="mt-3 text-sm text-emerald-600">{notice}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" className="border-red-300/80 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setOpen(false)}>
                {t('common.close')}
              </Button>
              <Button onClick={() => void submit()}>{t('common.create')}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
