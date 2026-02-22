import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SectionHeader } from '@/components/common/SectionHeader'
import { ChartCard } from '@/components/common/ChartCard'
import { Button } from '@/components/ui/button'
import { getCategoryColor } from '@/lib/chart-colors'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '/api')
const USER_ID = 1
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type InvestmentAccount = {
  id: number
  name: string
  account_type: string
  broker_name?: string | null
  current_value: number
}

type BankAccount = { id: number; name: string }

type Holding = {
  id: number
  account_id: number
  symbol: string
  name?: string | null
  asset_type: 'national_treasury' | 'cdb_rdb' | 'stock' | 'fii' | 'fund' | 'other'
  fund_cnpj?: string | null
  quantity: number
  average_cost: number
  current_price?: number | null
  current_value: number
}

type InvestmentSchedule = {
  row_id: string
  payment_id: number
  occurrence_id?: number
  payment_type?: string
  description: string
  due_date: string
  amount: number
  status: string
  direction: 'buy' | 'sell'
  bank_account_id?: number | null
  notes?: string | null
}

const ASSET_TYPE_OPTIONS: Array<{ value: Holding['asset_type']; labelKey: string }> = [
  { value: 'national_treasury', labelKey: 'investments.assetTypeNationalTreasury' },
  { value: 'cdb_rdb', labelKey: 'investments.assetTypeCdbRdb' },
  { value: 'stock', labelKey: 'investments.assetTypeStock' },
  { value: 'fii', labelKey: 'investments.assetTypeFii' },
  { value: 'fund', labelKey: 'investments.assetTypeFund' },
  { value: 'other', labelKey: 'investments.assetTypeOther' },
]

const addByFrequency = (baseDate: Date, frequency: string, steps: number) => {
  const next = new Date(baseDate)
  if (frequency === 'daily') next.setDate(next.getDate() + steps)
  else if (frequency === 'weekly') next.setDate(next.getDate() + steps * 7)
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + steps)
  else if (frequency === 'quarterly') next.setMonth(next.getMonth() + steps * 3)
  else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + steps)
  return next
}

const normalizeDate = (value?: string | null) => (value ?? '').slice(0, 10)
const toIsoDate = (value: Date) => value.toISOString().slice(0, 10)
const shiftIsoDate = (value: string, deltaDays: number) => {
  const d = new Date(`${normalizeDate(value)}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return toIsoDate(d)
}

export function InvestmentsPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [schedules, setSchedules] = useState<InvestmentSchedule[]>([])
  const [holdingEditing, setHoldingEditing] = useState<Holding | null>(null)
  const [holdingEditForm, setHoldingEditForm] = useState({
    symbol: '',
    name: '',
    asset_type: 'stock' as Holding['asset_type'],
    fund_cnpj: '',
    quantity: '0',
    average_cost: '0',
    current_price: '0',
  })
  const [sellHolding, setSellHolding] = useState<Holding | null>(null)
  const [sellForm, setSellForm] = useState({
    quantity: '0',
    unitPrice: '0',
    paidTax: '0',
    destinationAccountId: '',
    date: toIsoDate(new Date()),
    description: 'Sell investment holding',
  })
  const [newHolding, setNewHolding] = useState({
    symbol: '',
    name: '',
    asset_type: 'stock' as Holding['asset_type'],
    fund_cnpj: '',
    quantity: '0',
    average_cost: '0',
    current_price: '0',
    sourceAccountId: '',
  })
  const [scheduleForm, setScheduleForm] = useState({
    direction: 'buy' as 'buy' | 'sell',
    mode: 'one_time' as 'one_time' | 'recurring',
    description: 'Scheduled investment',
    amount: '0',
    paidTax: '0',
    date: toIsoDate(new Date()),
    bankAccountId: '',
    frequency: 'monthly',
    count: '6',
  })
  const [editingSchedule, setEditingSchedule] = useState<InvestmentSchedule | null>(null)
  const [scheduleEditForm, setScheduleEditForm] = useState({
    description: '',
    amount: '0',
    date: '',
    status: 'pending',
    bankAccountId: '',
  })
  const [recurringScope, setRecurringScope] = useState<'only_event' | 'from_event_forward' | 'all_events'>('only_event')
  const [investedRange, setInvestedRange] = useState<'all' | '5y' | '3y' | '1y' | '6m' | '3m'>('all')

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  )

  const loadAccounts = async () => {
    const [accountsRes, bankRes] = await Promise.all([
      fetch(`${API_BASE_URL}/investment-accounts?user_id=${USER_ID}&limit=200`),
      fetch(`${API_BASE_URL}/bank-accounts?user_id=${USER_ID}&limit=200`),
    ])
    if (!accountsRes.ok || !bankRes.ok) throw new Error('Failed to load account references.')
    const accountsRaw = (await accountsRes.json()) as Array<{
      id: number
      name: string
      account_type: string
      broker_name?: string
      current_value: unknown
    }>
    const bankRaw = (await bankRes.json()) as Array<{ id: number; name: string }>
    const mapped = accountsRaw.map((account) => ({
      id: account.id,
      name: account.name,
      account_type: account.account_type,
      broker_name: account.broker_name,
      current_value: Number(account.current_value),
    }))
    setAccounts(mapped)
    setBankAccounts(bankRaw)
    setSelectedAccountId((current) => current ?? mapped[0]?.id ?? null)
  }

  const loadHoldingsAndSchedules = async (accountId: number) => {
    const [holdingsRes, paymentsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/investment-accounts/${accountId}/holdings`),
      fetch(`${API_BASE_URL}/payments?user_id=${USER_ID}&limit=3000`),
    ])
    if (!holdingsRes.ok || !paymentsRes.ok) throw new Error('Failed to load investment data.')

    const holdingsRaw = (await holdingsRes.json()) as Array<{
      id: number
      account_id: number
      symbol: string
      name?: string
      asset_type: Holding['asset_type']
      fund_cnpj?: string
      quantity: unknown
      average_cost: unknown
      current_price?: unknown
      current_value: unknown
    }>
    setHoldings(
      holdingsRaw.map((item) => ({
        id: item.id,
        account_id: item.account_id,
        symbol: item.symbol,
        name: item.name,
        asset_type: item.asset_type,
        fund_cnpj: item.fund_cnpj,
        quantity: Number(item.quantity),
        average_cost: Number(item.average_cost),
        current_price: item.current_price ? Number(item.current_price) : null,
        current_value: Number(item.current_value),
      })),
    )

    const paymentsRaw = (await paymentsRes.json()) as Array<{
      id: number
      payment_type?: string
      description: string
      amount: unknown
      due_date?: string
      status?: string
      from_account_type?: string
      from_account_id?: number
      to_account_type?: string
      to_account_id?: number
      notes?: string
    }>
    const related = paymentsRaw.filter(
      (payment) =>
        (payment.to_account_type === 'investment_account' && payment.to_account_id === accountId) ||
        (payment.from_account_type === 'investment_account' && payment.from_account_id === accountId),
    )
    const recurring = related.filter((payment) => payment.payment_type === 'recurring')
    const occurrences = await Promise.all(
      recurring.map(async (payment) => {
        const response = await fetch(`${API_BASE_URL}/payments/${payment.id}/occurrences?user_id=${USER_ID}&limit=1000`)
        if (!response.ok) return { paymentId: payment.id, items: [] as Array<{ id: number; scheduled_date: string; amount: unknown; status?: string }> }
        const items = (await response.json()) as Array<{ id: number; scheduled_date: string; amount: unknown; status?: string }>
        return { paymentId: payment.id, items }
      }),
    )
    const occMap = new Map(occurrences.map((item) => [item.paymentId, item.items]))
    const rows: InvestmentSchedule[] = []
    for (const payment of related) {
      const direction: 'buy' | 'sell' =
        payment.to_account_type === 'investment_account' ? 'buy' : 'sell'
      const bankAccountId =
        direction === 'buy' ? payment.from_account_id : payment.to_account_id
      if (payment.payment_type !== 'recurring') {
        rows.push({
          row_id: `p-${payment.id}`,
          payment_id: payment.id,
          payment_type: payment.payment_type,
          description: payment.description,
          due_date: normalizeDate(payment.due_date),
          amount: Number(payment.amount),
          status: (payment.status ?? 'pending').toLowerCase(),
          direction,
          bank_account_id: bankAccountId,
          notes: payment.notes,
        })
        continue
      }
      const occs = occMap.get(payment.id) ?? []
      for (const occ of occs) {
        rows.push({
          row_id: `o-${payment.id}-${occ.id}`,
          payment_id: payment.id,
          occurrence_id: occ.id,
          payment_type: payment.payment_type,
          description: payment.description,
          due_date: normalizeDate(occ.scheduled_date),
          amount: Number(occ.amount),
          status: (occ.status ?? payment.status ?? 'pending').toLowerCase(),
          direction,
          bank_account_id: bankAccountId,
          notes: payment.notes,
        })
      }
    }
    rows.sort((a, b) => a.due_date.localeCompare(b.due_date))
    setSchedules(rows)
  }

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    if (!selectedAccountId) return
    setLoading(true)
    void loadHoldingsAndSchedules(selectedAccountId)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [selectedAccountId])

  const createMovementPayment = async (
    direction: 'buy' | 'sell',
    bankAccountId: number,
    amount: number,
    dueDate: string,
    description: string,
    mode: 'one_time' | 'recurring',
    frequency?: string,
    count?: number,
    notes?: string,
  ) => {
    if (!selectedAccountId) throw new Error('No account selected.')
    const common = {
      description,
      amount,
      currency: 'BRL',
      category: 'transfer',
      from_account_type: direction === 'buy' ? 'bank_account' : 'investment_account',
      from_account_id: direction === 'buy' ? bankAccountId : selectedAccountId,
      to_account_type: direction === 'buy' ? 'investment_account' : 'bank_account',
      to_account_id: direction === 'buy' ? selectedAccountId : bankAccountId,
      notes: notes ?? 'investment_schedule',
    }
    if (mode === 'one_time') {
      const response = await fetch(`${API_BASE_URL}/payments/one-time?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...common, due_date: dueDate }),
      })
      if (!response.ok) throw new Error('Failed to create investment payment.')
      return
    }
    const recurrenceCount = Math.max(1, count ?? 1)
    const start = new Date(`${dueDate}T00:00:00`)
    const end = addByFrequency(start, frequency ?? 'monthly', recurrenceCount - 1)
    const response = await fetch(`${API_BASE_URL}/payments/recurring?user_id=${USER_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...common,
        frequency: frequency ?? 'monthly',
        start_date: dueDate,
        end_date: toIsoDate(end),
      }),
    })
    if (!response.ok) throw new Error('Failed to create recurring investment payment.')
    const created = (await response.json()) as { id: number }
    const genResponse = await fetch(
      `${API_BASE_URL}/payments/${created.id}/generate-occurrences?user_id=${USER_ID}&up_to_date=${toIsoDate(end)}`,
      { method: 'POST' },
    )
    if (!genResponse.ok) throw new Error('Failed to generate recurring occurrences.')
  }

  const createHolding = async () => {
    if (!selectedAccountId) {
      setError('Select an investment account first.')
      return
    }
    if (!newHolding.sourceAccountId) {
      setError('Select source bank account.')
      return
    }
    if (newHolding.asset_type === 'fund' && !newHolding.fund_cnpj.trim()) {
      setError('Fund CNPJ is required for funds.')
      return
    }
    setError(null)
    setNotice(null)
    try {
      const quantity = Number(newHolding.quantity)
      const averageCost = Number(newHolding.average_cost)
      const currentPrice = Number(newHolding.current_price)
      const currentValue = quantity * (Number.isNaN(currentPrice) || currentPrice <= 0 ? averageCost : currentPrice)
      const response = await fetch(`${API_BASE_URL}/investment-accounts/${selectedAccountId}/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newHolding.symbol,
          name: newHolding.name || null,
          asset_type: newHolding.asset_type,
          fund_cnpj: newHolding.asset_type === 'fund' ? newHolding.fund_cnpj : null,
          quantity,
          average_cost: averageCost,
          current_price: Number.isNaN(currentPrice) ? null : currentPrice,
          current_value: currentValue,
          currency: 'BRL',
        }),
      })
      if (!response.ok) throw new Error('Failed to create holding.')
      await createMovementPayment(
        'buy',
        Number(newHolding.sourceAccountId),
        currentValue,
        toIsoDate(new Date()),
        `Buy ${newHolding.symbol}`,
        'one_time',
      )
      setNotice('Holding created and bank account debited.')
      setNewHolding({
        symbol: '',
        name: '',
        asset_type: 'stock',
        fund_cnpj: '',
        quantity: '0',
        average_cost: '0',
        current_price: '0',
        sourceAccountId: '',
      })
      await loadHoldingsAndSchedules(selectedAccountId)
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('investments.createHoldingFailed'))
    }
  }

  const openHoldingEdit = (holding: Holding) => {
    setHoldingEditing(holding)
    setHoldingEditForm({
      symbol: holding.symbol,
      name: holding.name ?? '',
      asset_type: holding.asset_type,
      fund_cnpj: holding.fund_cnpj ?? '',
      quantity: holding.quantity.toString(),
      average_cost: holding.average_cost.toString(),
      current_price: holding.current_price?.toString() ?? '0',
    })
  }

  const saveHoldingEdit = async () => {
    if (!holdingEditing || !selectedAccountId) return
    try {
      const quantity = Number(holdingEditForm.quantity)
      const averageCost = Number(holdingEditForm.average_cost)
      const currentPrice = Number(holdingEditForm.current_price)
      const currentValue = quantity * (Number.isNaN(currentPrice) || currentPrice <= 0 ? averageCost : currentPrice)
      const response = await fetch(
        `${API_BASE_URL}/investment-accounts/${selectedAccountId}/holdings/${holdingEditing.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: holdingEditForm.symbol,
            name: holdingEditForm.name || null,
            asset_type: holdingEditForm.asset_type,
            fund_cnpj: holdingEditForm.asset_type === 'fund' ? holdingEditForm.fund_cnpj : null,
            quantity,
            average_cost: averageCost,
            current_price: Number.isNaN(currentPrice) ? null : currentPrice,
            current_value: currentValue,
          }),
        },
      )
      if (!response.ok) throw new Error('Failed to update holding.')
      setHoldingEditing(null)
      setNotice('Holding updated.')
      await loadHoldingsAndSchedules(selectedAccountId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit holding failed.')
    }
  }

  const deleteHolding = async (holding: Holding) => {
    if (!selectedAccountId) return
    try {
      const response = await fetch(
        `${API_BASE_URL}/investment-accounts/${selectedAccountId}/holdings/${holding.id}`,
        { method: 'DELETE' },
      )
      if (!response.ok) throw new Error('Delete holding failed.')
      setNotice('Holding deleted.')
      await loadHoldingsAndSchedules(selectedAccountId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete holding failed.')
    }
  }

  const openSellModal = (holding: Holding) => {
    setSellHolding(holding)
    setSellForm({
      quantity: holding.quantity.toString(),
      unitPrice: holding.current_price?.toString() ?? holding.average_cost.toString(),
      paidTax: '0',
      destinationAccountId: '',
      date: toIsoDate(new Date()),
      description: `Sell ${holding.symbol}`,
    })
  }

  const confirmSell = async () => {
    if (!sellHolding || !selectedAccountId) return
    if (!sellForm.destinationAccountId) {
      setError('Select destination bank account for the sale.')
      return
    }
    const sellQty = Number(sellForm.quantity)
    const unitPrice = Number(sellForm.unitPrice)
    const paidTax = Number(sellForm.paidTax)
    if (Number.isNaN(sellQty) || sellQty <= 0 || sellQty > sellHolding.quantity) {
      setError('Invalid sell quantity.')
      return
    }
    if (Number.isNaN(unitPrice) || unitPrice <= 0) {
      setError('Invalid unit price.')
      return
    }
    if (Number.isNaN(paidTax) || paidTax < 0) {
      setError('Invalid paid tax value.')
      return
    }
    try {
      const remainingQty = sellHolding.quantity - sellQty
      const grossProceeds = sellQty * unitPrice
      const principal = sellQty * sellHolding.average_cost
      const profit = grossProceeds - principal - paidTax
      const netProceeds = Math.max(0, grossProceeds - paidTax)
      const sellNotes = [
        'investment_schedule',
        `investment_sell_meta:symbol=${sellHolding.symbol}`,
        `asset_type=${sellHolding.asset_type}`,
        `quantity=${sellQty.toFixed(6)}`,
        `principal=${principal.toFixed(2)}`,
        `gross=${grossProceeds.toFixed(2)}`,
        `tax=${paidTax.toFixed(2)}`,
        `profit=${profit.toFixed(2)}`,
      ].join(';')
      if (remainingQty <= 0) {
        await deleteHolding(sellHolding)
      } else {
        const remainingValue = remainingQty * unitPrice
        const response = await fetch(
          `${API_BASE_URL}/investment-accounts/${selectedAccountId}/holdings/${sellHolding.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quantity: remainingQty,
              current_price: unitPrice,
              current_value: remainingValue,
            }),
          },
        )
        if (!response.ok) throw new Error('Failed to update holding after sell.')
      }
      await createMovementPayment(
        'sell',
        Number(sellForm.destinationAccountId),
        netProceeds,
        sellForm.date,
        sellForm.description,
        'one_time',
        undefined,
        undefined,
        sellNotes,
      )
      setSellHolding(null)
      setNotice('Holding sold and bank account credited.')
      await loadHoldingsAndSchedules(selectedAccountId)
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sell flow failed.')
    }
  }

  const createSchedule = async () => {
    if (!scheduleForm.bankAccountId) {
      setError('Select bank account for schedule.')
      return
    }
    try {
      const paidTax = Number(scheduleForm.paidTax)
      if (Number.isNaN(paidTax) || paidTax < 0) {
        setError('Invalid paid tax value.')
        return
      }
      await createMovementPayment(
        scheduleForm.direction,
        Number(scheduleForm.bankAccountId),
        scheduleForm.direction === 'sell' ? Math.max(0, Number(scheduleForm.amount) - paidTax) : Number(scheduleForm.amount),
        scheduleForm.date,
        scheduleForm.description,
        scheduleForm.mode,
        scheduleForm.frequency,
        Number(scheduleForm.count),
        scheduleForm.direction === 'sell' ? `investment_schedule;sell_tax=${paidTax.toFixed(2)}` : undefined,
      )
      setNotice('Investment schedule created.')
      if (selectedAccountId) await loadHoldingsAndSchedules(selectedAccountId)
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create schedule failed.')
    }
  }

  const listOccurrences = async (paymentId: number) => {
    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/occurrences?user_id=${USER_ID}&limit=2000`)
    if (!response.ok) throw new Error('Failed to load occurrences.')
    return (await response.json()) as Array<{ id: number; scheduled_date: string }>
  }

  const updateOccurrence = async (occurrenceId: number, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/payments/occurrences/${occurrenceId}?user_id=${USER_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error('Failed to update occurrence.')
  }

  const deleteOccurrence = async (occurrenceId: number) => {
    const response = await fetch(`${API_BASE_URL}/payments/occurrences/${occurrenceId}?user_id=${USER_ID}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Failed to delete occurrence.')
  }

  const openScheduleEdit = (row: InvestmentSchedule) => {
    setEditingSchedule(row)
    setScheduleEditForm({
      description: row.description,
      amount: row.amount.toString(),
      date: row.due_date,
      status: row.status,
      bankAccountId: row.bank_account_id ? String(row.bank_account_id) : '',
    })
    setRecurringScope('only_event')
  }

  const saveScheduleEdit = async () => {
    if (!editingSchedule || !selectedAccountId) return
    const amount = Number(scheduleEditForm.amount)
    const bankAccountId = Number(scheduleEditForm.bankAccountId)
    const basePaymentPayload = {
      description: scheduleEditForm.description,
      amount,
      status: scheduleEditForm.status,
      from_account_type: editingSchedule.direction === 'buy' ? 'bank_account' : 'investment_account',
      from_account_id: editingSchedule.direction === 'buy' ? bankAccountId : selectedAccountId,
      to_account_type: editingSchedule.direction === 'buy' ? 'investment_account' : 'bank_account',
      to_account_id: editingSchedule.direction === 'buy' ? selectedAccountId : bankAccountId,
      notes: 'investment_schedule',
    }
    try {
      if (editingSchedule.occurrence_id && editingSchedule.payment_type === 'recurring') {
        if (recurringScope === 'only_event') {
          await updateOccurrence(editingSchedule.occurrence_id, {
            scheduled_date: scheduleEditForm.date,
            amount,
            status: scheduleEditForm.status,
          })
        } else {
          const occurrences = await listOccurrences(editingSchedule.payment_id)
          const currentDate = editingSchedule.due_date
          const dayMs = 24 * 60 * 60 * 1000
          const deltaDays = Math.round(
            (new Date(`${scheduleEditForm.date}T00:00:00`).getTime() - new Date(`${currentDate}T00:00:00`).getTime()) / dayMs,
          )
          const affected = occurrences.filter((occ) =>
            recurringScope === 'all_events' ? true : normalizeDate(occ.scheduled_date) >= currentDate,
          )
          await Promise.all(
            affected.map((occ) =>
              updateOccurrence(occ.id, {
                scheduled_date: shiftIsoDate(occ.scheduled_date, deltaDays),
                amount,
                status: scheduleEditForm.status,
              }),
            ),
          )
        }
        const response = await fetch(`${API_BASE_URL}/payments/${editingSchedule.payment_id}?user_id=${USER_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basePaymentPayload),
        })
        if (!response.ok) throw new Error('Failed to update recurring base.')
      } else {
        const response = await fetch(`${API_BASE_URL}/payments/${editingSchedule.payment_id}?user_id=${USER_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...basePaymentPayload, due_date: scheduleEditForm.date }),
        })
        if (!response.ok) throw new Error('Failed to update schedule.')
      }
      setEditingSchedule(null)
      setNotice('Schedule updated.')
      await loadHoldingsAndSchedules(selectedAccountId)
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update schedule failed.')
    }
  }

  const deleteSchedule = async (row: InvestmentSchedule) => {
    if (!selectedAccountId) return
    try {
      if (row.occurrence_id && row.payment_type === 'recurring') {
        if (recurringScope === 'only_event') {
          await deleteOccurrence(row.occurrence_id)
        } else if (recurringScope === 'all_events') {
          const response = await fetch(`${API_BASE_URL}/payments/${row.payment_id}?user_id=${USER_ID}`, { method: 'DELETE' })
          if (!response.ok) throw new Error('Delete failed.')
        } else {
          const occurrences = await listOccurrences(row.payment_id)
          const toDelete = occurrences.filter((occ) => normalizeDate(occ.scheduled_date) >= row.due_date)
          await Promise.all(toDelete.map((occ) => deleteOccurrence(occ.id)))
          if (toDelete.length === occurrences.length) {
            const response = await fetch(`${API_BASE_URL}/payments/${row.payment_id}?user_id=${USER_ID}`, { method: 'DELETE' })
            if (!response.ok) throw new Error('Delete failed.')
          } else {
            const response = await fetch(`${API_BASE_URL}/payments/${row.payment_id}?user_id=${USER_ID}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ end_date: shiftIsoDate(row.due_date, -1) }),
            })
            if (!response.ok) throw new Error('Delete failed.')
          }
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/payments/${row.payment_id}?user_id=${USER_ID}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('Delete failed.')
      }
      setEditingSchedule(null)
      setNotice('Schedule deleted.')
      await loadHoldingsAndSchedules(selectedAccountId)
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete schedule failed.')
    }
  }

  const parseSellMeta = (notes?: string | null) => {
    if (!notes?.includes('investment_sell_meta')) return null
    const fields = notes.split(';')
    const readNumber = (key: string) => {
      const raw = fields.find((field) => field.startsWith(`${key}=`))?.split('=')[1]
      return raw ? Number(raw) : 0
    }
    const symbol = fields.find((field) => field.startsWith('investment_sell_meta:symbol='))?.split('=')[1] ?? ''
    const assetType = fields.find((field) => field.startsWith('asset_type='))?.split('=')[1] ?? 'other'
    return {
      symbol,
      assetType,
      principal: readNumber('principal'),
      gross: readNumber('gross'),
      tax: readNumber('tax'),
      profit: readNumber('profit'),
    }
  }

  const allocationByType = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of holdings) {
      map.set(item.asset_type, (map.get(item.asset_type) ?? 0) + item.current_value)
    }
    return [...map.entries()].map(([assetType, total]) => {
      const option = ASSET_TYPE_OPTIONS.find((item) => item.value === assetType)
      return {
        label: option ? t(option.labelKey) : assetType,
        total,
      }
    })
  }, [holdings, t])
  const totalCurrentValue = holdings.reduce((sum, item) => sum + item.current_value, 0)

  const investedAreaSeries = useMemo(() => {
    const today = new Date()
    const monthsBack =
      investedRange === 'all'
        ? null
        : investedRange === '5y'
          ? 60
          : investedRange === '3y'
            ? 36
            : investedRange === '1y'
              ? 12
              : investedRange === '6m'
                ? 6
                : 3
    const cutoff = monthsBack === null ? null : new Date(today.getFullYear(), today.getMonth() - monthsBack + 1, 1)
    const monthlyNet = new Map<string, number>()
    for (const row of schedules) {
      if (!['processed', 'reconciled', 'pending'].includes(row.status.toLowerCase())) continue
      const date = new Date(`${row.due_date}T00:00:00`)
      if (cutoff && date < cutoff) continue
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const meta = parseSellMeta(row.notes)
      const signed = row.direction === 'buy' ? row.amount : -(meta?.principal ?? row.amount)
      monthlyNet.set(key, (monthlyNet.get(key) ?? 0) + signed)
    }
    const keys = [...monthlyNet.keys()].sort()
    let running = 0
    return keys.map((key) => {
      running += monthlyNet.get(key) ?? 0
      return { month: key, invested: running }
    })
  }, [schedules, investedRange])

  const pnlByAssetClassSeries = useMemo(() => {
    const grouped = new Map<string, Map<string, number>>()
    for (const row of schedules) {
      if (row.direction !== 'sell') continue
      if (!['processed', 'reconciled'].includes(row.status.toLowerCase())) continue
      const meta = parseSellMeta(row.notes)
      if (!meta) continue
      const month = row.due_date.slice(0, 7)
      const option = ASSET_TYPE_OPTIONS.find((item) => item.value === meta.assetType)
      const label = option ? t(option.labelKey) : meta.assetType
      if (!grouped.has(month)) grouped.set(month, new Map<string, number>())
      const byAsset = grouped.get(month)!
      byAsset.set(label, (byAsset.get(label) ?? 0) + meta.profit)
    }
    const months = [...grouped.keys()].sort()
    const allAssets = new Set<string>()
    grouped.forEach((value) => value.forEach((_, key) => allAssets.add(key)))
    return {
      rows: months.map((month) => {
        const row: Record<string, string | number> = { month }
        for (const asset of allAssets) row[asset] = grouped.get(month)?.get(asset) ?? 0
        return row
      }),
      keys: [...allAssets],
    }
  }, [schedules, t])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeader title={t('investments.title')} subtitle="Tesouro, CDB/RDB, Acoes, FIIs e Fundos (CNPJ), com compra, venda e agendamentos" />
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading investments...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}

      <ChartCard title={t('investments.totalInvestedOverTime')} subtitle={t('investments.selectTimeframeCumulative')}>
        <div className="mb-4 flex justify-end">
          <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/30 p-1" role="group" aria-label={t('investments.timeRange')}>
            {(
              [
                { value: 'all' as const, labelKey: 'investments.all' },
                { value: '5y' as const, labelKey: '5Y' },
                { value: '3y' as const, labelKey: '3Y' },
                { value: '1y' as const, labelKey: '1Y' },
                { value: '6m' as const, labelKey: '6M' },
                { value: '3m' as const, labelKey: '3M' },
              ] as const
            ).map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => setInvestedRange(value)}
                className={`flex h-8 min-w-10 items-center justify-center rounded-full px-2 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  investedRange === value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                {labelKey.startsWith('investments.') ? t(labelKey) : labelKey}
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={investedAreaSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number | string) => currency.format(Number(value))} />
              <Area type="monotone" dataKey="invested" stroke="#5B8DEF" fill="#5B8DEF33" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title={t('investments.realizedPnLByAssetClass')} subtitle={t('investments.basedOnProcessedReconciledSells')}>
          {pnlByAssetClassSeries.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t('investments.noRealizedPnLYet')}</p> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlByAssetClassSeries.rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currency.format(Number(value))} />
                  {pnlByAssetClassSeries.keys.map((key, index) => (
                    <Bar key={key} dataKey={key} stackId="pnl" fill={getCategoryColor(key, index)} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title={t('investments.portfolioAllocationByClass')} subtitle={`${t('common.total')} ${currency.format(totalCurrentValue)}`}>
          {allocationByType.length === 0 ? <p className="text-sm text-muted-foreground">{t('investments.noHoldingsYet')}</p> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocationByType} dataKey="total" nameKey="label" outerRadius={100} label>
                    {allocationByType.map((item, index) => <Cell key={item.label} fill={getCategoryColor(item.label, index)} />)}
                  </Pie>
                  <Tooltip formatter={(value: number | string) => currency.format(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title={t('investments.holdings')}>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <label className="text-sm sm:col-span-2">{t('investments.investmentAccountLabel')}
            <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={selectedAccountId ?? ''} onChange={(e)=>setSelectedAccountId(Number(e.target.value))}>
              <option value="">{t('common.selectAccount')}</option>
              {accounts.map((account)=><option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          <div className="sm:col-span-3 flex items-end text-sm text-muted-foreground">
            {selectedAccount ? `${selectedAccount.name} • ${selectedAccount.broker_name ?? t('investments.noBroker')} • ${currency.format(selectedAccount.current_value)}` : t('common.selectAccount')}
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="text-sm">{t('investments.assetClass')}
            <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={newHolding.asset_type} onChange={(e)=>setNewHolding(c=>({...c,asset_type:e.target.value as Holding['asset_type'],fund_cnpj:e.target.value==='fund'?c.fund_cnpj:''}))}>
              {ASSET_TYPE_OPTIONS.map((option)=><option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
            </select>
          </label>
          <label className="text-sm">{t('investments.symbolTicker')}
            <input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={newHolding.symbol} onChange={(e)=>setNewHolding(c=>({...c,symbol:e.target.value.toUpperCase()}))}/>
          </label>
          <label className="text-sm">{t('common.name')}
            <input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={newHolding.name} onChange={(e)=>setNewHolding(c=>({...c,name:e.target.value}))}/>
          </label>
          <label className="text-sm">{t('investments.sourceAccountBuy')}
            <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={newHolding.sourceAccountId} onChange={(e)=>setNewHolding(c=>({...c,sourceAccountId:e.target.value}))}>
              <option value="">{t('common.selectAccount')}</option>
              {bankAccounts.map((acc)=><option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
          </label>
          {newHolding.asset_type === 'fund' ? (
            <label className="text-sm">{t('investments.fundCnpj')}
              <input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={newHolding.fund_cnpj} onChange={(e)=>setNewHolding(c=>({...c,fund_cnpj:e.target.value}))} />
            </label>
          ) : null}
          <label className="text-sm">{t('investments.quantity')}
            <input type="number" step="0.000001" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={newHolding.quantity} onChange={(e)=>setNewHolding(c=>({...c,quantity:e.target.value}))}/>
          </label>
          <label className="text-sm">{t('investments.averageCost')}
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={newHolding.average_cost} onChange={(e)=>setNewHolding(c=>({...c,average_cost:e.target.value}))}/>
          </label>
          <label className="text-sm">{t('investments.currentPrice')}
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={newHolding.current_price} onChange={(e)=>setNewHolding(c=>({...c,current_price:e.target.value}))}/>
          </label>
          <div className="flex items-end"><Button className="w-full" onClick={()=>void createHolding()}>{t('investments.addHolding')}</Button></div>
        </div>

        {holdings.length === 0 ? <p className="text-sm text-muted-foreground">{t('investments.noHoldingsRegistered')}</p> : (
          <div className="space-y-2">
            {holdings.map((holding, index) => (
              <div key={holding.id} className={index % 2 === 1 ? 'rounded-md bg-secondary/20 px-3 py-2 text-sm' : 'px-3 py-2 text-sm'}>
                <div className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-2 font-medium">{holding.symbol}</div>
                  <div className="col-span-2 text-muted-foreground">{ASSET_TYPE_OPTIONS.find((o)=>o.value===holding.asset_type) ? t(ASSET_TYPE_OPTIONS.find((o)=>o.value===holding.asset_type)!.labelKey) : '-'}</div>
                  <div className="col-span-2 text-muted-foreground">{holding.fund_cnpj || '-'}</div>
                  <div className="col-span-2 text-right">{holding.quantity}</div>
                  <div className="col-span-2 text-right">{currency.format(holding.current_value)}</div>
                  <div className="col-span-2 flex justify-end gap-1">
                    <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border" onClick={()=>openHoldingEdit(holding)}><Pencil className="h-4 w-4"/></button>
                    <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border" onClick={()=>openSellModal(holding)}>{t('investments.sell')}</button>
                    <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border" onClick={()=>void deleteHolding(holding)}><Trash2 className="h-4 w-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      <ChartCard title={t('investments.investmentSchedules')} subtitle={t('investments.investmentSchedulesSubtitle')}>
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="text-sm">{t('investments.direction')}
            <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleForm.direction} onChange={(e)=>setScheduleForm(c=>({...c,direction:e.target.value as 'buy'|'sell'}))}>
              <option value="buy">{t('investments.buyDebitBank')}</option>
              <option value="sell">{t('investments.sellCreditBank')}</option>
            </select>
          </label>
          <label className="text-sm">{t('investments.mode')}
            <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleForm.mode} onChange={(e)=>setScheduleForm(c=>({...c,mode:e.target.value as 'one_time'|'recurring'}))}>
              <option value="one_time">{t('investments.oneTime')}</option>
              <option value="recurring">{t('investments.recurring')}</option>
            </select>
          </label>
          <label className="text-sm">{t('common.bankAccount')}
            <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleForm.bankAccountId} onChange={(e)=>setScheduleForm(c=>({...c,bankAccountId:e.target.value}))}>
              <option value="">{t('common.selectAccount')}</option>
              {bankAccounts.map((acc)=><option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
          </label>
          <label className="text-sm">{t('common.amount')}
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleForm.amount} onChange={(e)=>setScheduleForm(c=>({...c,amount:e.target.value}))}/>
          </label>
          {scheduleForm.direction === 'sell' ? (
            <label className="text-sm">{t('investments.paidTaxes')}
              <input type="number" step="0.01" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleForm.paidTax} onChange={(e)=>setScheduleForm(c=>({...c,paidTax:e.target.value}))}/>
            </label>
          ) : null}
          <label className="text-sm sm:col-span-2">{t('common.description')}
            <input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleForm.description} onChange={(e)=>setScheduleForm(c=>({...c,description:e.target.value}))}/>
          </label>
          <label className="text-sm">{t('common.date')}
            <input type="date" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleForm.date} onChange={(e)=>setScheduleForm(c=>({...c,date:e.target.value}))}/>
          </label>
          {scheduleForm.mode === 'recurring' ? (
            <>
              <label className="text-sm">{t('fab.frequency')}
                <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleForm.frequency} onChange={(e)=>setScheduleForm(c=>({...c,frequency:e.target.value}))}>
                  <option value="monthly">{t('fab.monthly')}</option>
                  <option value="weekly">{t('fab.weekly')}</option>
                  <option value="daily">{t('fab.daily')}</option>
                  <option value="quarterly">{t('fab.quarterly')}</option>
                  <option value="yearly">{t('fab.yearly')}</option>
                </select>
              </label>
              <label className="text-sm">{t('investments.count')}
                <input type="number" min="1" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleForm.count} onChange={(e)=>setScheduleForm(c=>({...c,count:e.target.value}))}/>
              </label>
            </>
          ) : null}
          <div className="flex items-end"><Button className="w-full" onClick={()=>void createSchedule()}>{t('investments.createSchedule')}</Button></div>
        </div>
        {schedules.length === 0 ? <p className="text-sm text-muted-foreground">{t('investments.noSchedulesForAccount')}</p> : (
          <div className="space-y-2">
            {schedules.map((row, index) => (
              <div key={row.row_id} className={index % 2 === 1 ? 'rounded-md bg-secondary/20 px-3 py-2 text-sm' : 'px-3 py-2 text-sm'}>
                <div className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-3">{row.description}</div>
                  <div className="col-span-2 text-muted-foreground">{row.due_date}</div>
                  <div className="col-span-2 text-muted-foreground">{row.direction === 'buy' ? t('investments.buy') : t('investments.sellDirection')}</div>
                  <div className="col-span-2 text-muted-foreground">{(row.status ?? '') ? t(`status.${(row.status ?? '').toLowerCase()}`, (row.status ?? '')) : '-'}</div>
                  <div className="col-span-2 text-right">{currency.format(row.amount)}</div>
                  <div className="col-span-1 flex justify-end">
                    <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border" onClick={()=>openScheduleEdit(row)}><Pencil className="h-4 w-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {holdingEditing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{t('investments.editHolding')}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">{t('investments.symbol')}<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={holdingEditForm.symbol} onChange={(e)=>setHoldingEditForm(c=>({...c,symbol:e.target.value.toUpperCase()}))}/></label>
              <label className="text-sm">{t('common.name')}<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={holdingEditForm.name} onChange={(e)=>setHoldingEditForm(c=>({...c,name:e.target.value}))}/></label>
              <label className="text-sm">{t('investments.assetClass')}
                <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={holdingEditForm.asset_type} onChange={(e)=>setHoldingEditForm(c=>({...c,asset_type:e.target.value as Holding['asset_type']}))}>
                  {ASSET_TYPE_OPTIONS.map((opt)=><option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
                </select>
              </label>
              {holdingEditForm.asset_type === 'fund' ? (
                <label className="text-sm">{t('investments.fundCnpj')}<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={holdingEditForm.fund_cnpj} onChange={(e)=>setHoldingEditForm(c=>({...c,fund_cnpj:e.target.value}))}/></label>
              ) : null}
              <label className="text-sm">{t('investments.quantity')}<input type="number" step="0.000001" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={holdingEditForm.quantity} onChange={(e)=>setHoldingEditForm(c=>({...c,quantity:e.target.value}))}/></label>
              <label className="text-sm">{t('investments.averageCost')}<input type="number" step="0.01" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={holdingEditForm.average_cost} onChange={(e)=>setHoldingEditForm(c=>({...c,average_cost:e.target.value}))}/></label>
              <label className="text-sm">{t('investments.currentPrice')}<input type="number" step="0.01" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={holdingEditForm.current_price} onChange={(e)=>setHoldingEditForm(c=>({...c,current_price:e.target.value}))}/></label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setHoldingEditing(null)}>{t('common.cancel')}</Button>
              <Button onClick={()=>void saveHoldingEdit()}>{t('common.save')}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {sellHolding ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Sell {sellHolding.symbol}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">{t('investments.quantity')}<input type="number" step="0.000001" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={sellForm.quantity} onChange={(e)=>setSellForm(c=>({...c,quantity:e.target.value}))}/></label>
              <label className="text-sm">{t('investments.unitPrice')}<input type="number" step="0.01" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={sellForm.unitPrice} onChange={(e)=>setSellForm(c=>({...c,unitPrice:e.target.value}))}/></label>
              <label className="text-sm">{t('investments.paidTaxes')}<input type="number" step="0.01" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={sellForm.paidTax} onChange={(e)=>setSellForm(c=>({...c,paidTax:e.target.value}))}/></label>
              <label className="text-sm">{t('investments.destinationBankAccount')}
                <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={sellForm.destinationAccountId} onChange={(e)=>setSellForm(c=>({...c,destinationAccountId:e.target.value}))}>
                  <option value="">{t('common.selectAccount')}</option>
                  {bankAccounts.map((acc)=><option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </label>
              <label className="text-sm">{t('common.date')}<input type="date" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={sellForm.date} onChange={(e)=>setSellForm(c=>({...c,date:e.target.value}))}/></label>
              <label className="text-sm sm:col-span-2">{t('common.description')}<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={sellForm.description} onChange={(e)=>setSellForm(c=>({...c,description:e.target.value}))}/></label>
              <p className="text-xs text-muted-foreground sm:col-span-2">Sell note stores principal, gross proceeds, tax, and realized profit for tax reporting.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setSellHolding(null)}>{t('common.cancel')}</Button>
              <Button onClick={()=>void confirmSell()}>{t('investments.confirmSell')}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {editingSchedule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Edit investment schedule</h3>
            {editingSchedule.occurrence_id && editingSchedule.payment_type === 'recurring' ? (
              <label className="mt-3 block text-sm">Recurring scope
                <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={recurringScope} onChange={(e)=>setRecurringScope(e.target.value as 'only_event'|'from_event_forward'|'all_events')}>
                  <option value="only_event">Only this event</option>
                  <option value="from_event_forward">From this event forward</option>
                  <option value="all_events">All events</option>
                </select>
              </label>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">{t('common.description')}<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleEditForm.description} onChange={(e)=>setScheduleEditForm(c=>({...c,description:e.target.value}))}/></label>
              <label className="text-sm">{t('common.amount')}<input type="number" step="0.01" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleEditForm.amount} onChange={(e)=>setScheduleEditForm(c=>({...c,amount:e.target.value}))}/></label>
              <label className="text-sm">{t('common.date')}<input type="date" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleEditForm.date} onChange={(e)=>setScheduleEditForm(c=>({...c,date:e.target.value}))}/></label>
              <label className="text-sm">{t('common.statusLabel')}
                <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleEditForm.status} onChange={(e)=>setScheduleEditForm(c=>({...c,status:e.target.value}))}>
                  <option value="pending">{t('status.pending')}</option>
                  <option value="processed">{t('status.processed')}</option>
                  <option value="reconciled">{t('status.reconciled')}</option>
                  <option value="scheduled">{t('status.scheduled')}</option>
                  <option value="cancelled">{t('status.cancelled')}</option>
                </select>
              </label>
              <label className="text-sm">{t('common.bankAccount')}
                <select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={scheduleEditForm.bankAccountId} onChange={(e)=>setScheduleEditForm(c=>({...c,bankAccountId:e.target.value}))}>
                  <option value="">{t('common.selectAccount')}</option>
                  {bankAccounts.map((acc)=><option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button type="button" className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-2 text-red-600 hover:bg-red-50" onClick={()=>void deleteSchedule(editingSchedule)}>
                <Trash2 className="h-4 w-4"/>{t('common.delete')}
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={()=>setEditingSchedule(null)}>{t('common.cancel')}</Button>
                <Button onClick={()=>void saveScheduleEdit()}>{t('common.save')}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
