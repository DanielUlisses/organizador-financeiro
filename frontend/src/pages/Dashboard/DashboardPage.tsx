import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

type MetadataCategory = {
  id: number
  transaction_type: string
  name: string
  color: string
  budget?: number | null
}

type WidgetLoadState = 'idle' | 'loading' | 'success' | 'error'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export function DashboardPage() {
  const { currentMonth } = useMonthContext()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US'
  const currencyCode = i18n.language === 'pt-BR' ? 'BRL' : 'USD'
  const currencyFormatter = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode })
  const percentFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const userId = 1
  const [loading, setLoading] = useState(false)
  const [fatalError, setFatalError] = useState<string | null>(null)

  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownResponse | null>(null)
  const [incomeVsExpensesMonthly, setIncomeVsExpensesMonthly] = useState<IncomeVsExpensesResponse | null>(null)
  const [incomeVsExpensesDaily, setIncomeVsExpensesDaily] = useState<IncomeVsExpensesResponse | null>(null)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [totalInvested, setTotalInvested] = useState(0)
  const [categories, setCategories] = useState<MetadataCategory[]>([])

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
  const rolling12Range = useMemo(() => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 11, 1)
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
    const format = (d: Date) => d.toISOString().slice(0, 10)
    return { start: format(start), end: format(end) }
  }, [currentMonth])

  const loadReports = useCallback(async () => {
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
      const [expenseRes, incomeMonthRes, incomeDayRes, categoriesRes, accountsRes, creditCardsRes, investmentsRes] = await Promise.allSettled([
        fetch(
          `${base}/expense-breakdown?user_id=${userId}&start_date=${dateRange.start}&end_date=${dateRange.end}&breakdown_by=category`,
        ),
        fetch(
          `${base}/income-vs-expenses?user_id=${userId}&start_date=${rolling12Range.start}&end_date=${rolling12Range.end}&granularity=month`,
        ),
        fetch(
          `${base}/income-vs-expenses?user_id=${userId}&start_date=${dateRange.start}&end_date=${dateRange.end}&granularity=day`,
        ),
        fetch(`${API_BASE_URL}/transaction-metadata/categories?user_id=${userId}`),
        fetch(`${API_BASE_URL}/bank-accounts?user_id=${userId}`),
        fetch(`${API_BASE_URL}/credit-cards?user_id=${userId}`),
        fetch(`${API_BASE_URL}/investment-accounts/${userId}/total-value`),
      ])

      if (
        expenseRes.status === 'fulfilled' &&
        incomeMonthRes.status === 'fulfilled' &&
        incomeDayRes.status === 'fulfilled' &&
        categoriesRes.status === 'fulfilled' &&
        expenseRes.value.ok &&
        incomeMonthRes.value.ok &&
        incomeDayRes.value.ok &&
        categoriesRes.value.ok
      ) {
        const rawExpenseData = await expenseRes.value.json()
        const rawIncomeMonthData = await incomeMonthRes.value.json()
        const rawIncomeDayData = await incomeDayRes.value.json()
        const rawCategories = (await categoriesRes.value.json()) as unknown
        setExpenseBreakdown({
          total_expenses: toNumber(rawExpenseData.total_expenses),
          items: (rawExpenseData.items ?? []).map((item: { label: string; total: unknown }) => ({
            label: item.label,
            total: toNumber(item.total),
          })),
        })
        setIncomeVsExpensesMonthly({
          total_income: toNumber(rawIncomeMonthData.total_income),
          total_expenses: toNumber(rawIncomeMonthData.total_expenses),
          net: toNumber(rawIncomeMonthData.net),
          series: (rawIncomeMonthData.series ?? []).map(
            (point: { period: string; income: unknown; expenses: unknown; net: unknown }) => ({
              period: point.period,
              income: toNumber(point.income),
              expenses: toNumber(point.expenses),
              net: toNumber(point.net),
            }),
          ),
        })
        setIncomeVsExpensesDaily({
          total_income: toNumber(rawIncomeDayData.total_income),
          total_expenses: toNumber(rawIncomeDayData.total_expenses),
          net: toNumber(rawIncomeDayData.net),
          series: (rawIncomeDayData.series ?? []).map(
            (point: { period: string; income: unknown; expenses: unknown; net: unknown }) => ({
              period: point.period,
              income: toNumber(point.income),
              expenses: toNumber(point.expenses),
              net: toNumber(point.net),
            }),
          ),
        })
        setCategories(Array.isArray(rawCategories) ? (rawCategories as MetadataCategory[]) : [])
        setReportsState('success')
      } else {
        setExpenseBreakdown(null)
        setIncomeVsExpensesMonthly(null)
        setIncomeVsExpensesDaily(null)
        setCategories([])
        setReportsState('error')
        setReportsError(t('dashboard.reportsError'))
      }

      if (accountsRes.status === 'fulfilled' && accountsRes.value.ok) {
        const rawAccounts = (await accountsRes.value.json()) as Array<{ id: number; name: string; balance: unknown }>
        setAccounts(rawAccounts.map((account) => ({ id: account.id, name: account.name, balance: toNumber(account.balance) })))
        setAccountsState('success')
      } else {
        setAccounts([])
        setAccountsState('error')
        setAccountsError(t('dashboard.accountsError'))
      }

      if (creditCardsRes.status === 'fulfilled' && creditCardsRes.value.ok) {
        const rawCards = (await creditCardsRes.value.json()) as Array<{ id: number; name: string; current_balance: unknown }>
        setCreditCards(rawCards.map((card) => ({ id: card.id, name: card.name, current_balance: toNumber(card.current_balance) })))
        setCreditCardsState('success')
      } else {
        setCreditCards([])
        setCreditCardsState('error')
        setCreditCardsError(t('dashboard.creditCardsError'))
      }

      if (investmentsRes.status === 'fulfilled' && investmentsRes.value.ok) {
        const rawInvestment = (await investmentsRes.value.json()) as InvestmentTotalResponse
        setTotalInvested(toNumber(rawInvestment.total_value))
        setInvestmentsState('success')
      } else {
        setTotalInvested(0)
        setInvestmentsState('error')
        setInvestmentsError(t('dashboard.investmentsError'))
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
  }, [dateRange.end, dateRange.start, rolling12Range.end, rolling12Range.start, t])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  useEffect(() => {
    const handler = () => {
      void loadReports()
    }
    window.addEventListener('of:transactions-changed', handler)
    return () => window.removeEventListener('of:transactions-changed', handler)
  }, [loadReports])

  const totalIncome = incomeVsExpensesDaily?.total_income ?? 0
  const totalExpenses = incomeVsExpensesDaily?.total_expenses ?? 0
  const currentBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
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
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const now = new Date()
  const projectedEntriesAfterMonthStart = (incomeVsExpensesDaily?.series ?? []).reduce((sum, point) => {
    const pointDate = new Date(point.period)
    if (pointDate >= monthStart && pointDate <= now) return sum + point.net
    return sum
  }, 0)
  const openingBalance = currentBalance - projectedEntriesAfterMonthStart
  let rollingBalance = openingBalance
  const balanceTrend = (incomeVsExpensesDaily?.series ?? [])
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((point) => {
      rollingBalance += point.net
      return { label: point.period.slice(5, 10), balance: rollingBalance }
    })
  const income12 = (incomeVsExpensesMonthly?.series ?? []).map((point) => ({ label: point.period, value: point.income }))
  const expenses12 = (incomeVsExpensesMonthly?.series ?? []).map((point) => ({ label: point.period, value: point.expenses }))
  const spentPct12 = (incomeVsExpensesMonthly?.series ?? []).map((point) => ({
    label: point.period,
    value: calculateSpentPercentage(point.income, point.expenses),
  }))
  const investedPct12 = (incomeVsExpensesMonthly?.series ?? []).map((point) => ({
    label: point.period,
    value: calculateInvestedPercentage(point.income, Math.max(point.net, 0)),
  }))
  const categoryByName = new Map(categories.map((category) => [category.name.toLowerCase(), category]))
  const budgets = expenseCategoryItems.map((item) => {
    const metadata = categoryByName.get(item.label.toLowerCase())
    const configured = metadata?.budget ? toNumber(metadata.budget) : Math.max(item.total * 1.15, item.total + 50)
    return { category: item.label, configured, consumed: item.total }
  })
  const configuredBudgetTotal = budgets.reduce((sum, item) => sum + item.configured, 0)
  const consumedBudgetTotal = budgets.reduce((sum, item) => sum + item.consumed, 0)
  const expenseCategoryTotal = expenseCategoryItems.reduce((sum, item) => sum + item.total, 0)
  const widgetErrors = [reportsError, accountsError, creditCardsError, investmentsError].filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeader
          title={t('dashboard.title')}
          subtitle={t('dashboard.subtitle')}
          actions={<MonthNavigator />}
        />
      </div>

      {loading && <p className="mb-2 text-sm text-muted-foreground">{t('dashboard.loadingData')}</p>}
      {fatalError && <p className="mb-4 text-sm text-red-500">{fatalError}</p>}
      {widgetErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('dashboard.widgetsUnavailable')} {widgetErrors.join(' ')}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label={t('dashboard.currentBalance')}
          value={reportsState === 'success' ? currencyFormatter.format(currentBalance) : '--'}
          hint={t('common.monthNet', { start: dateRange.start, end: dateRange.end })}
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
          label={t('dashboard.monthlyIncome')}
          value={reportsState === 'success' ? currencyFormatter.format(totalIncome) : '--'}
          accentClassName="text-white"
          className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-0"
          labelClassName="text-cyan-100"
          hintClassName="text-cyan-100/90"
          backgroundChart={
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={income12}>
                <Area type="monotone" dataKey="value" stroke="#dbeafe" fill="#dbeafe" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          }
        />
        <KpiCard
          label={t('dashboard.monthlyExpenses')}
          value={reportsState === 'success' ? currencyFormatter.format(totalExpenses) : '--'}
          accentClassName="text-red-500"
          backgroundChart={
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={expenses12}>
                <Area type="monotone" dataKey="value" stroke={CHART_THEME.series.expenses} fill={CHART_THEME.series.expenses} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          }
        />
        <KpiCard
          label={t('dashboard.investedPctIncome')}
          value={reportsState === 'success' && investmentsState === 'success' ? `${percentFormatter.format(investedPercentage)}%` : '--'}
          hint={investmentsState === 'success' ? currencyFormatter.format(totalInvested) : t('common.noInvestmentData')}
          backgroundChart={
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={investedPct12}>
                <Area type="monotone" dataKey="value" stroke={CHART_THEME.series.income} fill={CHART_THEME.series.income} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          }
        />
        <KpiCard
          label={t('dashboard.spentPctIncome')}
          value={reportsState === 'success' ? `${percentFormatter.format(spentPercentage)}%` : '--'}
          backgroundChart={
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spentPct12}>
                <Area type="monotone" dataKey="value" stroke={CHART_THEME.series.outflow} fill={CHART_THEME.series.outflow} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title={t('dashboard.balancePerAccount')} subtitle={t('dashboard.activeBankBalances')}>
          {accountsState === 'loading' ? <p className="text-sm text-muted-foreground">{t('dashboard.loadingAccountBalances')}</p> : null}
          {accountsState === 'error' ? <p className="text-sm text-red-500">{t('dashboard.accountBalancesUnavailable')}</p> : null}
          {accountsState === 'success' && accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noActiveAccounts')}</p>
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

        <ChartCard title={t('dashboard.balancePerCreditCard')} subtitle={t('dashboard.currentCardBalance')}>
          {creditCardsState === 'loading' ? <p className="text-sm text-muted-foreground">{t('dashboard.loadingCreditCards')}</p> : null}
          {creditCardsState === 'error' ? <p className="text-sm text-red-500">{t('dashboard.creditCardBalancesUnavailable')}</p> : null}
          {creditCardsState === 'success' && creditCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noActiveCreditCards')}</p>
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
          title={t('dashboard.budgetsConfiguredVsConsumed')}
          subtitle={`${t('common.configured')} ${currencyFormatter.format(configuredBudgetTotal)} | ${t('common.consumed')} ${currencyFormatter.format(consumedBudgetTotal)}`}
        >
          {reportsState === 'loading' ? <p className="text-sm text-muted-foreground">{t('dashboard.loadingBudgets')}</p> : null}
          {reportsState === 'error' ? <p className="text-sm text-red-500">{t('dashboard.budgetWidgetUnavailable')}</p> : null}
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
          title={t('dashboard.expenseBreakdownByCategory')}
          subtitle={`${t('dashboard.totalExpensesCategories')} ${currencyFormatter.format(expenseCategoryTotal)}`}
        >
          {reportsState === 'loading' ? <p className="text-sm text-muted-foreground">{t('dashboard.loadingExpenseCategories')}</p> : null}
          {reportsState === 'error' ? <p className="text-sm text-red-500">{t('dashboard.expenseBreakdownUnavailable')}</p> : null}
          {reportsState === 'success' && expenseCategoryItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noExpenseCategories')}</p>
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
                      <Cell key={`cell-${item.label}`} fill={categoryByName.get(item.label.toLowerCase())?.color ?? getCategoryColor(item.label, idx)} />
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
        <ChartCard title={t('dashboard.inflowVsOutflowChart')} subtitle={t('dashboard.areaRelationship12Months')}>
          {reportsState === 'loading' ? <p className="text-sm text-muted-foreground">{t('dashboard.loadingIncomeExpenseTrend')}</p> : null}
          {reportsState === 'error' ? <p className="text-sm text-red-500">{t('dashboard.incomeVsExpensesUnavailable')}</p> : null}
          {reportsState === 'success' && (incomeVsExpensesMonthly?.series.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noMonthlySeries')}</p>
          ) : null}
          {reportsState === 'success' && (incomeVsExpensesMonthly?.series.length ?? 0) > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incomeVsExpensesMonthly?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(toNumber(value))} />
                  <Area type="monotone" dataKey="income" stroke={CHART_THEME.series.income} fill={CHART_THEME.series.income} fillOpacity={0.2} />
                  <Area type="monotone" dataKey="expenses" stroke={CHART_THEME.series.expenses} fill={CHART_THEME.series.expenses} fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </ChartCard>

        <ChartCard title={t('dashboard.balanceTrendDuringMonth')} subtitle={t('dashboard.dailyProgressionMonth')}>
          {reportsState === 'loading' ? <p className="text-sm text-muted-foreground">{t('dashboard.loadingBalanceTrend')}</p> : null}
          {reportsState === 'error' ? <p className="text-sm text-red-500">{t('dashboard.balanceTrendUnavailable')}</p> : null}
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
