import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
  getNotificationPreferences,
  setNotificationPreference,
  type NotificationPreferenceKey,
  getDefaultCurrency,
  setDefaultCurrency,
  getTransactionOrder,
  setTransactionOrder,
  type TransactionOrder,
} from '@/pages/Settings/settings-sections'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const USER_ID = 1

export function SettingsPage() {
  const [currentSection, setCurrentSection] = useState<SettingsSectionId>('general')
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
  const [bankAccounts, setBankAccounts] = useState<
    Array<{
      id: number
      name: string
      account_type?: string
      bank_name?: string | null
      account_number_last4?: string | null
      color?: string | null
      balance?: number
      currency?: string
      is_active?: boolean
    }>
  >([])
  const [creditCards, setCreditCards] = useState<
    Array<{
      id: number
      name: string
      issuer?: string | null
      card_network?: string | null
      card_number_last4?: string | null
      credit_limit: number
      current_balance: number
      default_payment_account_id?: number | null
      invoice_close_day?: number
      payment_due_day?: number
      currency?: string
      is_active?: boolean
    }>
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
    card_network: '' as '' | 'visa' | 'mastercard' | 'amex',
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
  const [newBankAccount, setNewBankAccount] = useState({
    name: '',
    account_type: 'checking' as 'checking' | 'savings' | 'money_market' | 'other',
    bank_name: '',
    account_number_last4: '',
    balance: '0',
    currency: 'USD',
    color: '#6366F1',
  })
  const [notificationPrefs, setNotificationPrefs] = useState(getNotificationPreferences)
  const [defaultCurrency, setDefaultCurrencyState] = useState(getDefaultCurrency)
  const [transactionOrder, setTransactionOrderState] = useState<TransactionOrder>(getTransactionOrder)
  const [editingBankId, setEditingBankId] = useState<number | null>(null)
  const [editBankForm, setEditBankForm] = useState({
    name: '',
    account_type: 'checking' as 'checking' | 'savings' | 'money_market' | 'other',
    bank_name: '',
    account_number_last4: '',
    balance: '0',
    currency: 'USD',
    color: '#6366F1',
  })
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [editCardForm, setEditCardForm] = useState({
    name: '',
    issuer: '',
    card_network: '' as '' | 'visa' | 'mastercard' | 'amex',
    card_number_last4: '',
    credit_limit: '',
    current_balance: '0',
    invoice_close_day: '25',
    payment_due_day: '10',
    default_payment_account_id: '',
    currency: 'USD',
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
      const rawAccounts = (await accountsRes.json()) as Array<{
        id: number
        name: string
        account_type?: string
        bank_name?: string | null
        account_number_last4?: string | null
        color?: string | null
        balance?: number | string
        currency?: string
        is_active?: boolean
      }>
      const rawCards = (await cardsRes.json()) as Array<{
        id: number
        name: string
        issuer?: string | null
        card_network?: string | null
        card_number_last4?: string | null
        credit_limit: number | string
        current_balance: number | string
        default_payment_account_id?: number | null
        invoice_close_day?: number
        payment_due_day?: number
        currency?: string
        is_active?: boolean
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
      setBankAccounts(
        rawAccounts.map((a) => ({
          ...a,
          balance: typeof a.balance === 'string' ? Number(a.balance) || 0 : (a.balance ?? 0),
        })),
      )
      setCreditCards(
        rawCards.map((c) => ({
          ...c,
          credit_limit: typeof c.credit_limit === 'string' ? Number(c.credit_limit) || 0 : c.credit_limit,
          current_balance: typeof c.current_balance === 'string' ? Number(c.current_balance) || 0 : c.current_balance,
        })),
      )
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
          card_network: newCard.card_network || null,
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
        card_network: '',
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

  const createBankAccount = async () => {
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${API_BASE_URL}/bank-accounts?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBankAccount.name,
          account_type: newBankAccount.account_type,
          bank_name: newBankAccount.bank_name || null,
          account_number_last4: newBankAccount.account_number_last4 || null,
          balance: Number(newBankAccount.balance),
          currency: newBankAccount.currency,
          color: newBankAccount.color || null,
        }),
      })
      if (!response.ok) throw new Error('Failed to create bank account.')
      setNewBankAccount({
        name: '',
        account_type: 'checking',
        bank_name: '',
        account_number_last4: '',
        balance: '0',
        currency: 'USD',
        color: '#6366F1',
      })
      setNotice('Bank account created.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create bank account failed.')
    }
  }

  const handleNotificationPrefChange = (key: NotificationPreferenceKey, enabled: boolean) => {
    setNotificationPreference(key, enabled)
    setNotificationPrefs((prev) => ({ ...prev, [key]: enabled }))
  }

  const archiveBankAccount = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/bank-accounts/${id}?user_id=${USER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      })
      if (!res.ok) throw new Error('Failed to archive.')
      setNotice('Bank account archived.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed.')
    }
  }

  const archiveCreditCard = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/credit-cards/${id}?user_id=${USER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      })
      if (!res.ok) throw new Error('Failed to archive.')
      setNotice('Credit card archived.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed.')
    }
  }

  const restoreBankAccount = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/bank-accounts/${id}?user_id=${USER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      if (!res.ok) throw new Error('Failed to restore.')
      setNotice('Bank account restored.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.')
    }
  }

  const restoreCreditCard = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/credit-cards/${id}?user_id=${USER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      if (!res.ok) throw new Error('Failed to restore.')
      setNotice('Credit card restored.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.')
    }
  }

  const openEditBankModal = (account: (typeof bankAccounts)[0]) => {
    setEditingBankId(account.id)
    const rawType = (account.account_type ?? 'checking').toString().toLowerCase()
    const accountType =
      rawType === 'savings' || rawType === 'money_market' || rawType === 'other' ? rawType : 'checking'
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

  const saveEditBank = async () => {
    if (editingBankId == null) return
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`${API_BASE_URL}/bank-accounts/${editingBankId}?user_id=${USER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editBankForm.name,
          account_type: editBankForm.account_type,
          bank_name: editBankForm.bank_name || null,
          account_number_last4: editBankForm.account_number_last4 || null,
          balance: Number(editBankForm.balance),
          currency: editBankForm.currency,
          color: editBankForm.color,
        }),
      })
      if (!res.ok) throw new Error('Failed to update.')
      setNotice('Bank account updated.')
      setEditingBankId(null)
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.')
    }
  }

  const openEditCardModal = (card: (typeof creditCards)[0]) => {
    setEditingCardId(card.id)
    const network = (card.card_network ?? '').toString().toLowerCase()
    const cardNetwork: '' | 'visa' | 'mastercard' | 'amex' =
      network === 'visa' || network === 'mastercard' || network === 'amex' ? network : ''
    setEditCardForm({
      name: card.name ?? '',
      issuer: card.issuer ?? '',
      card_network: cardNetwork,
      card_number_last4: card.card_number_last4 ?? '',
      credit_limit: String(card.credit_limit ?? 0),
      current_balance: String(card.current_balance ?? 0),
      invoice_close_day: String(card.invoice_close_day ?? 25),
      payment_due_day: String(card.payment_due_day ?? 10),
      default_payment_account_id: card.default_payment_account_id != null ? String(card.default_payment_account_id) : '',
      currency: card.currency ?? 'USD',
    })
  }

  const saveEditCard = async () => {
    if (editingCardId == null) return
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`${API_BASE_URL}/credit-cards/${editingCardId}?user_id=${USER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCardForm.name,
          issuer: editCardForm.issuer || null,
          card_network: editCardForm.card_network || null,
          card_number_last4: editCardForm.card_number_last4 || null,
          credit_limit: Number(editCardForm.credit_limit),
          current_balance: Number(editCardForm.current_balance),
          invoice_close_day: Number(editCardForm.invoice_close_day),
          payment_due_day: Number(editCardForm.payment_due_day),
          default_payment_account_id: editCardForm.default_payment_account_id ? Number(editCardForm.default_payment_account_id) : null,
          currency: editCardForm.currency,
        }),
      })
      if (!res.ok) throw new Error('Failed to update.')
      setNotice('Credit card updated.')
      setEditingCardId(null)
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.')
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
    <div className="flex flex-col gap-6 md:flex-row">
      <nav className="flex shrink-0 flex-row flex-wrap gap-1 border-b pb-4 md:w-52 md:flex-col md:border-b-0 md:border-r md:pb-0 md:pr-4">
        {SETTINGS_SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setCurrentSection(id)}
            className={`rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
              currentSection === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className="min-w-0 flex-1 space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <SectionHeader
            title="Settings"
            subtitle={
              currentSection === 'general'
                ? 'Currency, transaction order, and app preferences.'
                : currentSection === 'bank-accounts'
                  ? 'Create and manage bank accounts.'
                  : currentSection === 'credit-cards'
                    ? 'Create and manage credit cards.'
                    : currentSection === 'categories'
                      ? 'Categories used by charts and statements.'
                      : currentSection === 'tags'
                        ? 'Tags for transactions.'
                        : currentSection === 'investment-accounts'
                          ? 'Investment accounts.'
                          : currentSection === 'notifications'
                            ? 'Choose what you want to be notified about.'
                            : undefined
            }
          />
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading settings...</p> : null}
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}

        {currentSection === 'general' && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold">General</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Default currency
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={defaultCurrency}
                  onChange={(e) => {
                    const v = e.target.value
                    setDefaultCurrency(v)
                    setDefaultCurrencyState(v)
                  }}
                >
                  <option value="USD">USD</option>
                  <option value="BRL">BRL</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
              <label className="text-sm">
                Transaction order
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={transactionOrder}
                  onChange={(e) => {
                    const v = e.target.value as TransactionOrder
                    setTransactionOrder(v)
                    setTransactionOrderState(v)
                  }}
                >
                  <option value="older">Older first</option>
                  <option value="newer">Newer first</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {currentSection === 'bank-accounts' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="text-base font-semibold">Create bank account</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  Name
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    value={newBankAccount.name}
                    onChange={(e) => setNewBankAccount((c) => ({ ...c, name: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Type
                  <select
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    value={newBankAccount.account_type}
                    onChange={(e) =>
                      setNewBankAccount((c) => ({ ...c, account_type: e.target.value as 'checking' | 'savings' | 'money_market' | 'other' }))
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
                    value={newBankAccount.bank_name}
                    onChange={(e) => setNewBankAccount((c) => ({ ...c, bank_name: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Last 4 digits
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    value={newBankAccount.account_number_last4}
                    onChange={(e) => setNewBankAccount((c) => ({ ...c, account_number_last4: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Initial balance
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    value={newBankAccount.balance}
                    onChange={(e) => setNewBankAccount((c) => ({ ...c, balance: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Currency
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    value={newBankAccount.currency}
                    onChange={(e) => setNewBankAccount((c) => ({ ...c, currency: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Color
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-14 cursor-pointer rounded border bg-background"
                      value={newBankAccount.color}
                      onChange={(e) => setNewBankAccount((c) => ({ ...c, color: e.target.value }))}
                    />
                    <input
                      className="w-24 rounded-md border bg-background px-2 py-1.5 text-sm"
                      value={newBankAccount.color}
                      onChange={(e) => setNewBankAccount((c) => ({ ...c, color: e.target.value }))}
                    />
                  </div>
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => void createBankAccount()}>Create bank account</Button>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="mb-3 text-base font-semibold">Bank accounts</h3>
              <div className="space-y-2">
                {bankAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{account.name}</p>
                      {account.is_active === false && <span className="text-xs text-muted-foreground">Archived</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEditBankModal(account)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {account.is_active !== false ? (
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void archiveBankAccount(account.id)}>
                          Archive
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void restoreBankAccount(account.id)}>
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentSection === 'credit-cards' && (
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
              Card network
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCard.card_network}
                onChange={(e) => setNewCard((c) => ({ ...c, card_network: e.target.value as '' | 'visa' | 'mastercard' | 'amex' }))}
              >
                <option value="">—</option>
                <option value="visa">Visa</option>
                <option value="mastercard">Mastercard</option>
                <option value="amex">American Express</option>
              </select>
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
              <h3 className="mb-3 text-base font-semibold">Credit cards</h3>
              <div className="space-y-2">
                {creditCards.map((card) => (
                  <div key={card.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{card.name}</p>
                      <p className="text-muted-foreground">
                        limit {card.credit_limit} • balance {card.current_balance} • payment account{' '}
                        {bankAccounts.find((account) => account.id === card.default_payment_account_id)?.name ?? 'auto-checking'}
                      </p>
                      {card.is_active === false && <span className="text-xs text-muted-foreground">Archived</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEditCardModal(card)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {card.is_active !== false ? (
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void archiveCreditCard(card.id)}>
                          Archive
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void restoreCreditCard(card.id)}>
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentSection === 'categories' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void deleteCategory(category.id)} aria-label="Delete category">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentSection === 'tags' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
              <h3 className="mb-3 text-base font-semibold">Tags</h3>
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void deleteTag(tag.id)} aria-label="Delete tag">
                  <Trash2 className="h-4 w-4" />
                </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentSection === 'investment-accounts' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          </div>
        )}

        {currentSection === 'notifications' && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold">Notification preferences</h3>
            <p className="mt-1 text-sm text-muted-foreground">Choose which events you want to be notified about in the header.</p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notificationPrefs.pending_payments}
                  onChange={(e) => handleNotificationPrefChange('pending_payments', e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Pending payments</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notificationPrefs.credit_card_due}
                  onChange={(e) => handleNotificationPrefChange('credit_card_due', e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Upcoming credit card due dates</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notificationPrefs.budget_alerts}
                  onChange={(e) => handleNotificationPrefChange('budget_alerts', e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Budget threshold alerts</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notificationPrefs.reconciliation}
                  onChange={(e) => handleNotificationPrefChange('reconciliation', e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Reconciliation warnings</span>
              </label>
            </div>
          </div>
        )}
      </main>

      {editingBankId != null ? (
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
              <Button variant="outline" onClick={() => setEditingBankId(null)}>Cancel</Button>
              <Button onClick={() => void saveEditBank()}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}

      {editingCardId != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">Edit credit card</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Name
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editCardForm.name}
                  onChange={(e) => setEditCardForm((c) => ({ ...c, name: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Issuer
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editCardForm.issuer}
                  onChange={(e) => setEditCardForm((c) => ({ ...c, issuer: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Card network
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editCardForm.card_network}
                  onChange={(e) => setEditCardForm((c) => ({ ...c, card_network: e.target.value as '' | 'visa' | 'mastercard' | 'amex' }))}
                >
                  <option value="">—</option>
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">American Express</option>
                </select>
              </label>
              <label className="text-sm">
                Last 4
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editCardForm.card_number_last4}
                  onChange={(e) => setEditCardForm((c) => ({ ...c, card_number_last4: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Credit limit
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editCardForm.credit_limit}
                  onChange={(e) => setEditCardForm((c) => ({ ...c, credit_limit: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Current balance
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editCardForm.current_balance}
                  onChange={(e) => setEditCardForm((c) => ({ ...c, current_balance: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Invoice close day
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editCardForm.invoice_close_day}
                  onChange={(e) => setEditCardForm((c) => ({ ...c, invoice_close_day: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Due days after close
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editCardForm.payment_due_day}
                  onChange={(e) => setEditCardForm((c) => ({ ...c, payment_due_day: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Default payment account
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editCardForm.default_payment_account_id}
                  onChange={(e) => setEditCardForm((c) => ({ ...c, default_payment_account_id: e.target.value }))}
                >
                  <option value="">Default checking (automatic)</option>
                  {bankAccounts.filter((a) => a.is_active !== false).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Currency
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editCardForm.currency}
                  onChange={(e) => setEditCardForm((c) => ({ ...c, currency: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingCardId(null)}>Cancel</Button>
              <Button onClick={() => void saveEditCard()}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
