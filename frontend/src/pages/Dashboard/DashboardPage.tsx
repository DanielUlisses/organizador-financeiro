import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useMonthContext } from '@/app/providers/MonthContextProvider'
import { ChartCard } from '@/components/common/ChartCard'
import { KpiCard } from '@/components/common/KpiCard'
import { MonthNavigator } from '@/components/common/MonthNavigator'
import { SectionHeader } from '@/components/common/SectionHeader'
import { CHART_THEME, getCategoryColor } from '@/lib/chart-colors'
import {
  buildBalanceTrend,
  buildBudgets,
  calculateInvestedPercentage,
  calculateSpentPercentage,
  toNumber,
  type ExpenseBreakdownItem,
  type IncomeSeriesPoint,
} from '@/pages/Dashboard/dashboard-helpers'

type ExpenseBreakdownResponse = {
  items: ExpenseBreakdownItem[]
  total_expenses: number
}

type IncomeVsExpensesResponse = {
  total_income: number
  total_expenses: number
  net: number
  series: IncomeSeriesPoint[]
}

type BankAccount = {
  id: number
  name: string
  balance: number
}

type CreditCard = {
  id: number
  name: string
  current_balance: number
}

type InvestmentTotalResponse = {
  total_value: number
}

type WidgetLoadState = 'idle' | 'loading' | 'success' | 'error'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const percentFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function DashboardPage() {
  const { currentMonth } = useMonthContext()
  const userId = 1
  const [loading, setLoading] = useState(false)
  const [fatalError, setFatalError] = useState<string | null>(null)

  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownResponse | null>(null)
  const [incomeVsExpenses, setIncomeVsExpenses] = useState<IncomeVsExpensesResponse | null>(null)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [totalInvested, setTotalInvested] = useState(0)

  const [reportsState, setReportsState] = useState<WidgetLoadState>('idle')
  const [accountsState, setAccountsState] = useState<WidgetLoadState>('idle')
  const [creditCardsState, setCreditCardsState] = useState<WidgetLoadState>('idle')
  const [investmentsState, setInvestmentsState] = useState<WidgetLoadState>('idle')

  const [reportsError, setReportsError] = useState<string | null>(null)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [creditCardsError, setCreditCardsError] = useState<string | null>(null)
  const [investmentsError, setInvestmentsError] = useState<string | null>(null)

  const dateRange = useMemo(() => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
    const format = (d: Date) => d.toISOString().slice(0, 10)
    return { start: format(start), end: format(end) }
  }, [currentMonth])

  const loadReports = async () => {
    setLoading(true)
    setFatalError(null)
    setReportsState('loading')
    setAccountsState('loading')
    setCreditCardsState('loading')
    setInvestmentsState('loading')
    setReportsError(null)
    setAccountsError(null)
    setCreditCardsError(null)
    setInvestmentsError(null)

    try {
      const base = `${API_BASE_URL}/reports`
      const [expenseRes, incomeRes, accountsRes, creditCardsRes, investmentsRes] = await Promise.allSettled([
        fetch(
          `${base}/expense-breakdown?user_id=${userId}&start_date=${dateRange.start}&end_date=${dateRange.end}&breakdown_by=category`,
        ),
        fetch(
          `${base}/income-vs-expenses?user_id=${userId}&start_date=${dateRange.start}&end_date=${dateRange.end}&granularity=month`,
        ),
        fetch(`${API_BASE_URL}/bank-accounts?user_id=${userId}`),
        fetch(`${API_BASE_URL}/credit-cards?user_id=${userId}`),
        fetch(`${API_BASE_URL}/investment-accounts/${userId}/total-value`),
      ])

      if (
        expenseRes.status === 'fulfilled' &&
        incomeRes.status === 'fulfilled' &&
        expenseRes.value.ok &&
        incomeRes.value.ok
      ) {
        const rawExpenseData = await expenseRes.value.json()
        const rawIncomeData = await incomeRes.value.json()
        setExpenseBreakdown({
          total_expenses: toNumber(rawExpenseData.total_expenses),
          items: (rawExpenseData.items ?? []).map((item: { label: string; total: unknown }) => ({
            label: item.label,
            total: toNumber(item.total),
          })),
        })
        setIncomeVsExpenses({
          total_income: toNumber(rawIncomeData.total_income),
          total_expenses: toNumber(rawIncomeData.total_expenses),
          net: toNumber(rawIncomeData.net),
          series: (rawIncomeData.series ?? []).map(
            (point: { period: string; income: unknown; expenses: unknown; net: unknown }) => ({
              period: point.period,
              income: toNumber(point.income),
              expenses: toNumber(point.expenses),
              net: toNumber(point.net),
            }),
          ),
        })
        setReportsState('success')
      } else {
        setExpenseBreakdown(null)
        setIncomeVsExpenses(null)
        setReportsState('error')
        setReportsError('Unable to load reports widget data.')
      }

      if (accountsRes.status === 'fulfilled' && accountsRes.value.ok) {
        const rawAccounts = (await accountsRes.value.json()) as Array<{ id: number; name: string; balance: unknown }>
        setAccounts(rawAccounts.map((account) => ({ id: account.id, name: account.name, balance: toNumber(account.balance) })))
        setAccountsState('success')
      } else {
        setAccounts([])
        setAccountsState('error')
        setAccountsError('Unable to load account balances.')
      }

      if (creditCardsRes.status === 'fulfilled' && creditCardsRes.value.ok) {
        const rawCards = (await creditCardsRes.value.json()) as Array<{ id: number; name: string; current_balance: unknown }>
        setCreditCards(rawCards.map((card) => ({ id: card.id, name: card.name, current_balance: toNumber(card.current_balance) })))
        setCreditCardsState('success')
      } else {
        setCreditCards([])
        setCreditCardsState('error')
        setCreditCardsError('Unable to load credit card balances.')
      }

      if (investmentsRes.status === 'fulfilled' && investmentsRes.value.ok) {
        const rawInvestment = (await investmentsRes.value.json()) as InvestmentTotalResponse
        setTotalInvested(toNumber(rawInvestment.total_value))
        setInvestmentsState('success')
      } else {
        setTotalInvested(0)
        setInvestmentsState('error')
        setInvestmentsError('Unable to load investment totals.')
      }
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : 'Unknown error')
      setReportsState('error')
      setAccountsState('error')
      setCreditCardsState('error')
      setInvestmentsState('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.start, dateRange.end])

  const totalIncome = incomeVsExpenses?.total_income ?? 0
  const totalExpenses = incomeVsExpenses?.total_expenses ?? 0
  const currentBalance = incomeVsExpenses?.net ?? 0
  const spentPercentage = calculateSpentPercentage(totalIncome, totalExpenses)
  const investedPercentage = calculateInvestedPercentage(totalIncome, totalInvested)
  const expenseCategoryItems = useMemo(
    () =>
      (expenseBreakdown?.items ?? []).filter((item) => {
        const label = item.label.toLowerCase()
        return label !== 'transfer' && label !== 'income'
      }),
    [expenseBreakdown],
  )
  const budgets = buildBudgets(expenseCategoryItems)
  const balanceTrend = buildBalanceTrend(currentBalance, incomeVsExpenses?.series ?? [])
  const configuredBudgetTotal = budgets.reduce((sum, item) => sum + item.configured, 0)
  const consumedBudgetTotal = budgets.reduce((sum, item) => sum + item.consumed, 0)
  const expenseCategoryTotal = expenseCategoryItems.reduce((sum, item) => sum + item.total, 0)
  const widgetErrors = [reportsError, accountsError, creditCardsError, investmentsError].filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeader
          title="Dashboard"
          subtitle="Monthly financial overview with balances, budgets, and performance indicators"
          actions={<MonthNavigator />}
        />
      </div>

      {loading && <p className="mb-2 text-sm text-muted-foreground">Loading dashboard data...</p>}
      {fatalError && <p className="mb-4 text-sm text-red-500">{fatalError}</p>}
      {widgetErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some widgets are unavailable for this month: {widgetErrors.join(' ')}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Current balance"
          value={reportsState === 'success' ? currencyFormatter.format(currentBalance) : '--'}
          hint={`Month net (${dateRange.start} to ${dateRange.end})`}
          className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white border-0"
          labelClassName="text-indigo-100"
          hintClassName="text-indigo-100/90"
          backgroundChart={
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceTrend}>
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={CHART_THEME.layout.mutedLine}
                  fill={CHART_THEME.layout.mutedLine}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          }
        />
        <KpiCard
          label="Monthly income"
          value={reportsState === 'success' ? currencyFormatter.format(totalIncome) : '--'}
          accentClassName="text-white"
          className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-0"
          labelClassName="text-cyan-100"
          hintClassName="text-cyan-100/90"
        />
        <KpiCard
          label="Monthly expenses"
          value={reportsState === 'success' ? currencyFormatter.format(totalExpenses) : '--'}
          accentClassName="text-red-500"
        />
        <KpiCard
          label="Invested % of income"
          value={reportsState === 'success' && investmentsState === 'success' ? `${percentFormatter.format(investedPercentage)}%` : '--'}
          hint={investmentsState === 'success' ? currencyFormatter.format(totalInvested) : 'No investment data'}
        />
        <KpiCard
          label="Spent % of income"
          value={reportsState === 'success' ? `${percentFormatter.format(spentPercentage)}%` : '--'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Balance per account" subtitle="Active bank account balances">
          {accountsState === 'loading' ? <p className="text-sm text-muted-foreground">Loading account balances...</p> : null}
          {accountsState === 'error' ? <p className="text-sm text-red-500">Account balances unavailable.</p> : null}
          {accountsState === 'success' && accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active accounts available for this user.</p>
          ) : null}
          {accountsState === 'success' && accounts.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accounts} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" hide={accounts.length > 4} />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(toNumber(value))} />
                  <Bar dataKey="balance" fill={CHART_THEME.series.balance} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </ChartCard>

        <ChartCard title="Balance per credit card" subtitle="Current card balance (used amount)">
          {creditCardsState === 'loading' ? <p className="text-sm text-muted-foreground">Loading credit cards...</p> : null}
          {creditCardsState === 'error' ? <p className="text-sm text-red-500">Credit card balances unavailable.</p> : null}
          {creditCardsState === 'success' && creditCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active credit cards available for this user.</p>
          ) : null}
          {creditCardsState === 'success' && creditCards.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={creditCards} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" hide={creditCards.length > 4} />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(toNumber(value))} />
                  <Bar dataKey="current_balance" fill={CHART_THEME.series.expenses} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Budgets: configured vs consumed"
          subtitle={`Configured ${currencyFormatter.format(configuredBudgetTotal)} | Consumed ${currencyFormatter.format(consumedBudgetTotal)}`}
        >
          {reportsState === 'loading' ? <p className="text-sm text-muted-foreground">Loading budgets...</p> : null}
          {reportsState === 'error' ? <p className="text-sm text-red-500">Budget widget unavailable.</p> : null}
          {reportsState === 'success' ? (
            <div className="space-y-4">
              {budgets.map((budget) => {
                const pct = budget.configured > 0 ? Math.min(100, (budget.consumed / budget.configured) * 100) : 0
                return (
                  <div key={budget.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{budget.category}</span>
                      <span className="text-muted-foreground">
                        {currencyFormatter.format(budget.consumed)} / {currencyFormatter.format(budget.configured)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </ChartCard>

        <ChartCard
          title="Expense breakdown by category"
          subtitle={`Total expenses categories: ${currencyFormatter.format(expenseCategoryTotal)}`}
        >
          {reportsState === 'loading' ? <p className="text-sm text-muted-foreground">Loading expense categories...</p> : null}
          {reportsState === 'error' ? <p className="text-sm text-red-500">Expense breakdown unavailable.</p> : null}
          {reportsState === 'success' && expenseCategoryItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expense categories found for this month.</p>
          ) : null}
          {reportsState === 'success' && expenseCategoryItems.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryItems}
                    dataKey="total"
                    nameKey="label"
                    outerRadius={100}
                    label
                  >
                    {expenseCategoryItems.map((item, idx) => (
                      <Cell key={`cell-${item.label}`} fill={getCategoryColor(item.label, idx)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(toNumber(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Income vs expenses" subtitle="Monthly cashflow comparison">
          {reportsState === 'loading' ? <p className="text-sm text-muted-foreground">Loading income/expense trend...</p> : null}
          {reportsState === 'error' ? <p className="text-sm text-red-500">Income vs expenses unavailable.</p> : null}
          {reportsState === 'success' && (incomeVsExpenses?.series.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No monthly series available.</p>
          ) : null}
          {reportsState === 'success' && (incomeVsExpenses?.series.length ?? 0) > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeVsExpenses?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(toNumber(value))} />
                  <Bar dataKey="income" fill={CHART_THEME.series.income} />
                  <Bar dataKey="expenses" fill={CHART_THEME.series.expenses} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </ChartCard>

        <ChartCard title="Balance trend during month" subtitle="Background-style progression of estimated current balance">
          {reportsState === 'loading' ? <p className="text-sm text-muted-foreground">Loading balance trend...</p> : null}
          {reportsState === 'error' ? <p className="text-sm text-red-500">Balance trend unavailable.</p> : null}
          {reportsState === 'success' ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceTrend}>
                  <defs>
                    <linearGradient id="balance-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_THEME.series.balance} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={CHART_THEME.series.balance} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(toNumber(value))} />
                  <Area type="monotone" dataKey="balance" stroke={CHART_THEME.series.balance} fill="url(#balance-gradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </ChartCard>
      </div>
    </div>
  )
}
