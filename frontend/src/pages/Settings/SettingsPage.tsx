import { useEffect, useMemo, useState } from 'react'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const USER_ID = 1

export function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [categories, setCategories] = useState<
    Array<{
      id: number
      transaction_type: 'expense' | 'income' | 'transfer'
      name: string
      color: string
      budget: number | null
      budget_scope: 'all_months' | 'current_month'
      budget_month: string | null
    }>
  >([])
  const [tags, setTags] = useState<Array<{ id: number; name: string; color: string }>>([])
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: number; name: string }>>([])
  const [creditCards, setCreditCards] = useState<
    Array<{ id: number; name: string; credit_limit: number; current_balance: number; default_payment_account_id?: number | null }>
  >([])
  const [investmentAccounts, setInvestmentAccounts] = useState<
    Array<{ id: number; name: string; account_type: string; broker_name?: string | null; current_value: number }>
  >([])

  const [newCategory, setNewCategory] = useState({
    transaction_type: 'expense' as 'expense' | 'income' | 'transfer',
    name: '',
    color: '#5B8DEF',
    budget: '',
    budget_scope: 'all_months' as 'all_months' | 'current_month',
    budget_month: '',
  })
  const [newTag, setNewTag] = useState({ name: '', color: '#8B5CF6' })
  const [newCard, setNewCard] = useState({
    name: '',
    issuer: '',
    card_number_last4: '',
    credit_limit: '',
    current_balance: '0',
    invoice_close_day: '25',
    payment_due_day: '10',
    default_payment_account_id: '',
    currency: 'USD',
  })
  const [newInvestmentAccount, setNewInvestmentAccount] = useState({
    name: '',
    account_type: 'brokerage',
    broker_name: '',
    current_value: '0',
  })

  const groupedCategories = useMemo(
    () => ({
      expense: categories.filter((category) => category.transaction_type === 'expense'),
      income: categories.filter((category) => category.transaction_type === 'income'),
      transfer: categories.filter((category) => category.transaction_type === 'transfer'),
    }),
    [categories],
  )

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [categoriesRes, tagsRes, accountsRes, cardsRes, investmentAccountsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/transaction-metadata/categories?user_id=${USER_ID}`),
        fetch(`${API_BASE_URL}/transaction-metadata/tags?user_id=${USER_ID}`),
        fetch(`${API_BASE_URL}/bank-accounts?user_id=${USER_ID}`),
        fetch(`${API_BASE_URL}/credit-cards?user_id=${USER_ID}`),
        fetch(`${API_BASE_URL}/investment-accounts?user_id=${USER_ID}&limit=200`),
      ])
      if (!categoriesRes.ok || !tagsRes.ok || !accountsRes.ok || !cardsRes.ok || !investmentAccountsRes.ok) {
        throw new Error('Failed to load settings data.')
      }
      const rawCategories = (await categoriesRes.json()) as Array<{
        id: number
        transaction_type: 'expense' | 'income' | 'transfer'
        name: string
        color: string
        budget: number | null
        budget_scope: 'all_months' | 'current_month'
        budget_month: string | null
      }>
      const rawTags = (await tagsRes.json()) as Array<{ id: number; name: string; color: string }>
      const rawAccounts = (await accountsRes.json()) as Array<{ id: number; name: string }>
      const rawCards = (await cardsRes.json()) as Array<{
        id: number
        name: string
        credit_limit: number
        current_balance: number
        default_payment_account_id?: number | null
      }>
      const rawInvestmentAccounts = (await investmentAccountsRes.json()) as Array<{
        id: number
        name: string
        account_type: string
        broker_name?: string | null
        current_value: number
      }>
      setCategories(rawCategories)
      setTags(rawTags)
      setBankAccounts(rawAccounts)
      setCreditCards(rawCards)
      setInvestmentAccounts(rawInvestmentAccounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const createCategory = async () => {
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${API_BASE_URL}/transaction-metadata/categories?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: newCategory.transaction_type,
          name: newCategory.name,
          color: newCategory.color,
          budget: newCategory.budget ? Number(newCategory.budget) : null,
          budget_scope: newCategory.budget_scope,
          budget_month: newCategory.budget_scope === 'current_month' ? newCategory.budget_month || null : null,
        }),
      })
      if (!response.ok) throw new Error('Failed to create category.')
      setNewCategory({
        transaction_type: 'expense',
        name: '',
        color: '#5B8DEF',
        budget: '',
        budget_scope: 'all_months',
        budget_month: '',
      })
      setNotice('Category created.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create category failed.')
    }
  }

  const createTag = async () => {
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${API_BASE_URL}/transaction-metadata/tags?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTag),
      })
      if (!response.ok) throw new Error('Failed to create tag.')
      setNewTag({ name: '', color: '#8B5CF6' })
      setNotice('Tag created.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create tag failed.')
    }
  }

  const createCreditCard = async () => {
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${API_BASE_URL}/credit-cards?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCard.name,
          issuer: newCard.issuer || null,
          card_number_last4: newCard.card_number_last4 || null,
          credit_limit: Number(newCard.credit_limit),
          current_balance: Number(newCard.current_balance),
          invoice_close_day: Number(newCard.invoice_close_day),
          payment_due_day: Number(newCard.payment_due_day),
          default_payment_account_id: newCard.default_payment_account_id ? Number(newCard.default_payment_account_id) : null,
          currency: newCard.currency,
        }),
      })
      if (!response.ok) throw new Error('Failed to create credit card.')
      setNewCard({
        name: '',
        issuer: '',
        card_number_last4: '',
        credit_limit: '',
        current_balance: '0',
        invoice_close_day: '25',
        payment_due_day: '10',
        default_payment_account_id: '',
        currency: 'USD',
      })
      setNotice('Credit card created with planned future payments.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create credit card failed.')
    }
  }

  const createInvestmentAccount = async () => {
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${API_BASE_URL}/investment-accounts?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newInvestmentAccount.name,
          account_type: newInvestmentAccount.account_type,
          broker_name: newInvestmentAccount.broker_name || null,
          current_value: Number(newInvestmentAccount.current_value),
          currency: 'BRL',
        }),
      })
      if (!response.ok) throw new Error('Failed to create investment account.')
      setNewInvestmentAccount({ name: '', account_type: 'brokerage', broker_name: '', current_value: '0' })
      setNotice('Investment account created.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create investment account failed.')
    }
  }

  const deleteCategory = async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/transaction-metadata/categories/${id}?user_id=${USER_ID}`, { method: 'DELETE' })
    if (response.ok) {
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    }
  }

  const deleteTag = async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/transaction-metadata/tags/${id}?user_id=${USER_ID}`, { method: 'DELETE' })
    if (response.ok) {
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeader title="Settings" subtitle="Manage categories, monthly budgets, and tags used by charts and statements." />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading settings...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold">Create credit card</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Name
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCard.name}
                onChange={(event) => setNewCard((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Issuer
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCard.issuer}
                onChange={(event) => setNewCard((current) => ({ ...current, issuer: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Last 4
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCard.card_number_last4}
                onChange={(event) => setNewCard((current) => ({ ...current, card_number_last4: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Credit limit
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCard.credit_limit}
                onChange={(event) => setNewCard((current) => ({ ...current, credit_limit: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Current balance
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCard.current_balance}
                onChange={(event) => setNewCard((current) => ({ ...current, current_balance: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Invoice close day
              <input
                type="number"
                min="1"
                max="31"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCard.invoice_close_day}
                onChange={(event) => setNewCard((current) => ({ ...current, invoice_close_day: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Due days after close
              <input
                type="number"
                min="1"
                max="31"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCard.payment_due_day}
                onChange={(event) => setNewCard((current) => ({ ...current, payment_due_day: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Default payment account
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCard.default_payment_account_id}
                onChange={(event) => setNewCard((current) => ({ ...current, default_payment_account_id: event.target.value }))}
              >
                <option value="">Default checking (automatic)</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void createCreditCard()}>Create credit card</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold">Create category</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Type
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCategory.transaction_type}
                onChange={(event) =>
                  setNewCategory((current) => ({ ...current, transaction_type: event.target.value as 'expense' | 'income' | 'transfer' }))
                }
              >
                <option value="expense">expense</option>
                <option value="income">income</option>
                <option value="transfer">transfer</option>
              </select>
            </label>
            <label className="text-sm">
              Name
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCategory.name}
                onChange={(event) => setNewCategory((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Color
              <input
                type="color"
                className="mt-1 h-10 w-full rounded-md border bg-background px-2"
                value={newCategory.color}
                onChange={(event) => setNewCategory((current) => ({ ...current, color: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Budget
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCategory.budget}
                onChange={(event) => setNewCategory((current) => ({ ...current, budget: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Budget scope
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCategory.budget_scope}
                onChange={(event) =>
                  setNewCategory((current) => ({ ...current, budget_scope: event.target.value as 'all_months' | 'current_month' }))
                }
              >
                <option value="all_months">all_months</option>
                <option value="current_month">current_month</option>
              </select>
            </label>
            <label className="text-sm">
              Budget month
              <input
                type="date"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCategory.budget_month}
                onChange={(event) => setNewCategory((current) => ({ ...current, budget_month: event.target.value }))}
                disabled={newCategory.budget_scope !== 'current_month'}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void createCategory()}>Create category</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold">Create tag</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Name
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newTag.name}
                onChange={(event) => setNewTag((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Color
              <input
                type="color"
                className="mt-1 h-10 w-full rounded-md border bg-background px-2"
                value={newTag.color}
                onChange={(event) => setNewTag((current) => ({ ...current, color: event.target.value }))}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void createTag()}>Create tag</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold">Create investment account</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Name
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newInvestmentAccount.name}
                onChange={(event) => setNewInvestmentAccount((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Type
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newInvestmentAccount.account_type}
                onChange={(event) => setNewInvestmentAccount((current) => ({ ...current, account_type: event.target.value }))}
              >
                <option value="brokerage">brokerage</option>
                <option value="other">other</option>
              </select>
            </label>
            <label className="text-sm">
              Broker
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newInvestmentAccount.broker_name}
                onChange={(event) => setNewInvestmentAccount((current) => ({ ...current, broker_name: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Current value
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newInvestmentAccount.current_value}
                onChange={(event) => setNewInvestmentAccount((current) => ({ ...current, current_value: event.target.value }))}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void createInvestmentAccount()}>Create investment account</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Credit cards</h3>
          <div className="space-y-2">
            {creditCards.map((card) => (
              <div key={card.id} className="rounded-md border px-3 py-2 text-sm">
                <p className="font-medium">{card.name}</p>
                <p className="text-muted-foreground">
                  limit {card.credit_limit} • balance {card.current_balance} • payment account{' '}
                  {bankAccounts.find((account) => account.id === card.default_payment_account_id)?.name ?? 'auto-checking'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Investment accounts</h3>
          <div className="space-y-2">
            {investmentAccounts.map((account) => (
              <div key={account.id} className="rounded-md border px-3 py-2 text-sm">
                <p className="font-medium">{account.name}</p>
                <p className="text-muted-foreground">
                  {account.account_type} • {account.broker_name ?? 'no broker'} • value {account.current_value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Categories</h3>
          {(['expense', 'income', 'transfer'] as const).map((type) => (
            <div key={type} className="mb-4">
              <p className="mb-2 text-sm font-medium uppercase text-muted-foreground">{type}</p>
              <div className="space-y-2">
                {groupedCategories[type].map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name} {category.budget ? `• ${category.budget}` : ''}
                    </span>
                    <Button variant="outline" onClick={() => void deleteCategory(category.id)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Tags</h3>
          <div className="space-y-2">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
                <Button variant="outline" onClick={() => void deleteTag(tag.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
