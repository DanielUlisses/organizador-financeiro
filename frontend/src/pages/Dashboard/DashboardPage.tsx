import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeDollarSign, CreditCard, PiggyBank } from 'lucide-react'
import {
  Area,
  AreaChart,
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
import { LazyMount } from '@/components/common/LazyMount'
import { MonthNavigator } from '@/components/common/MonthNavigator'
import { CHART_THEME, getCategoryColor } from '@/lib/chart-colors'
import { getCategoryIconFromMetadata } from '@/lib/category-icons'
import { getDefaultCurrency } from '@/pages/Settings/settings-sections'
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
  currency?: string
}

type CreditCard = {
  id: number
  name: string
  current_balance: number
  currency?: string
}

type InvestmentTotalResponse = {
  total_value: number
}

type MetadataCategory = {
  id: number
  transaction_type: string
  name: string
  color: string
  icon?: string
  budget?: number | null
}

type WidgetLoadState = 'idle' | 'loading' | 'success' | 'error'
type CurrencyMetrics = Record<string, { income: number; expenses: number }>

const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '/api')
const DASHBOARD_SELECTED_ACCOUNTS_STORAGE_KEY = 'of_dashboard_selected_account_ids'
const CURRENCY_FLAGS: Record<string, string> = {
  USD: '/flags/us.png',
  BRL: '/flags/br.svg',
  EUR: '/flags/eu.svg',
  GBP: '/flags/eu.svg',
}

function getCurrencyFlag(currency: string): string {
  return CURRENCY_FLAGS[currency] ?? '/flags/eu.svg'
}

function makeCurrencyFormatter(locale: string, currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { style: 'currency', currency })
}

function getCurrencySymbol(locale: string, currency: string): string {
  const parts = makeCurrencyFormatter(locale, currency).formatToParts(0)
  return parts.find((part) => part.type === 'currency')?.value ?? currency
}

function readStoredAccountSelection(): { ids: number[]; hasStored: boolean } {
  if (typeof window === 'undefined') return { ids: [], hasStored: false }
  const saved = window.localStorage.getItem(DASHBOARD_SELECTED_ACCOUNTS_STORAGE_KEY)
  if (!saved) return { ids: [], hasStored: false }
  try {
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(DASHBOARD_SELECTED_ACCOUNTS_STORAGE_KEY)
      return { ids: [], hasStored: false }
    }
    const ids = parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
    return { ids, hasStored: true }
  } catch {
    window.localStorage.removeItem(DASHBOARD_SELECTED_ACCOUNTS_STORAGE_KEY)
    return { ids: [], hasStored: false }
  }
}

export function DashboardPage() {
  const { currentMonth } = useMonthContext()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US'
  const currencyCode = getDefaultCurrency().toUpperCase()
  const currencyFormatter = makeCurrencyFormatter(locale, currencyCode)
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
  const [currencyMetrics, setCurrencyMetrics] = useState<CurrencyMetrics>({})
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>(() => readStoredAccountSelection().ids)
  const [hasStoredAccountSelection] = useState<boolean>(() => readStoredAccountSelection().hasStored)

  const [reportsState, setReportsState] = useState<WidgetLoadState>('idle')
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
    setInvestmentsState('loading')
    setReportsError(null)
    setAccountsError(null)
    setCreditCardsError(null)
    setInvestmentsError(null)

    try {
      const base = `${API_BASE_URL}/reports`
      const [expenseRes, incomeMonthRes, incomeDayRes, categoriesRes, accountsRes, creditCardsRes, investmentsRes, currencyMetricsRes] = await Promise.allSettled([
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
        fetch(`${base}/currency-metrics?user_id=${userId}&start_date=${dateRange.start}&end_date=${dateRange.end}`),
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
        const rawAccounts = (await accountsRes.value.json()) as Array<{ id: number; name: string; balance: unknown; currency?: string }>
        setAccounts(
          rawAccounts.map((account) => ({
            id: account.id,
            name: account.name,
            balance: toNumber(account.balance),
            currency: (account.currency ?? currencyCode).toUpperCase(),
          })),
        )
      } else {
        setAccounts([])
        setAccountsError(t('dashboard.accountsError'))
      }

      if (creditCardsRes.status === 'fulfilled' && creditCardsRes.value.ok) {
        const rawCards = (await creditCardsRes.value.json()) as Array<{ id: number; name: string; current_balance: unknown; currency?: string }>
        setCreditCards(
          rawCards.map((card) => ({
            id: card.id,
            name: card.name,
            current_balance: toNumber(card.current_balance),
            currency: (card.currency ?? currencyCode).toUpperCase(),
          })),
        )
      } else {
        setCreditCards([])
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

      if (currencyMetricsRes.status === 'fulfilled' && currencyMetricsRes.value.ok) {
        const rawMetrics = (await currencyMetricsRes.value.json()) as {
          metrics?: Array<{ currency: string; income: unknown; expenses: unknown }>
        }
        const metrics: CurrencyMetrics = {}
        for (const item of rawMetrics.metrics ?? []) {
          const currency = (item.currency ?? currencyCode).toUpperCase()
          metrics[currency] = {
            income: toNumber(item.income),
            expenses: toNumber(item.expenses),
          }
        }
        setCurrencyMetrics(metrics)
      } else {
        setCurrencyMetrics({})
      }
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : 'Unknown error')
      setReportsState('error')
      setInvestmentsState('error')
    } finally {
      setLoading(false)
    }
  }, [currencyCode, dateRange.end, dateRange.start, rolling12Range.end, rolling12Range.start, t])

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

  useEffect(() => {
    if (accounts.length === 0) return
    setSelectedAccountIds((current) => {
      const valid = current.filter((id) => accounts.some((account) => account.id === id))
      if (valid.length > 0) return valid
      if (hasStoredAccountSelection) return valid
      return accounts.map((account) => account.id)
    })
  }, [accounts, hasStoredAccountSelection])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (accounts.length === 0) return
    window.localStorage.setItem(DASHBOARD_SELECTED_ACCOUNTS_STORAGE_KEY, JSON.stringify(selectedAccountIds))
  }, [accounts.length, selectedAccountIds])

  const totalIncome = incomeVsExpensesDaily?.total_income ?? 0
  const totalExpenses = incomeVsExpensesDaily?.total_expenses ?? 0
  const currentBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
  const balancesByCurrency = accounts.reduce<Record<string, number>>((acc, account) => {
    const currency = (account.currency ?? currencyCode).toUpperCase()
    acc[currency] = (acc[currency] ?? 0) + account.balance
    return acc
  }, {})
  const defaultCurrencyBalance = balancesByCurrency[currencyCode] ?? 0
  const secondaryCurrencies = Object.entries(balancesByCurrency).filter(([currency]) => currency !== currencyCode)
  const secondaryCurrencyEntry =
    secondaryCurrencies.length > 0
      ? secondaryCurrencies.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]
      : null
  const secondaryCurrencyCode = secondaryCurrencyEntry?.[0] ?? null
  const secondaryCurrencyBalance = secondaryCurrencyEntry?.[1] ?? 0
  const additionalSecondaryCount = Math.max(0, secondaryCurrencies.length - 1)
  const defaultCurrencyFormatter = makeCurrencyFormatter(locale, currencyCode)
  const secondaryCurrencyFormatter = secondaryCurrencyCode ? makeCurrencyFormatter(locale, secondaryCurrencyCode) : null
  const defaultIncome = currencyMetrics[currencyCode]?.income ?? 0
  const defaultExpenses = currencyMetrics[currencyCode]?.expenses ?? 0
  const secondaryIncome = secondaryCurrencyCode ? (currencyMetrics[secondaryCurrencyCode]?.income ?? 0) : 0
  const secondaryExpenses = secondaryCurrencyCode ? (currencyMetrics[secondaryCurrencyCode]?.expenses ?? 0) : 0
  const balanceCardsGridClass = secondaryCurrencyCode ? 'grid grid-cols-1 gap-4 sm:grid-cols-2' : 'grid grid-cols-1 gap-4'
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
  const selectedValueAccounts = accounts.filter((account) => selectedAccountIds.includes(account.id))

  const toggleAccountSelection = (accountId: number) => {
    setSelectedAccountIds((current) =>
      current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId],
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">

      {loading && <p className="mb-2 text-sm text-muted-foreground">{t('dashboard.loadingData')}</p>}
      {fatalError && <p className="mb-4 text-sm text-red-500">{fatalError}</p>}
      {widgetErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('dashboard.widgetsUnavailable')} {widgetErrors.join(' ')}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className={balanceCardsGridClass}>
          <div className="sm:col-span-1">
            <KpiCard
              label={`${t('dashboard.currentBalance')} (${currencyCode} ${getCurrencySymbol(locale, currencyCode)})`}
              icon={BadgeDollarSign}
              value={reportsState === 'success' ? defaultCurrencyFormatter.format(defaultCurrencyBalance) : '--'}
              valueAccessory={
                <img
                  src={getCurrencyFlag(currencyCode)}
                  alt={`${currencyCode} flag`}
                  className="h-11 w-11 rounded-full object-cover shadow-md ring-2 ring-white/80"
                />
              }
              details={
                reportsState === 'success'
                  ? [
                      { label: t('dashboard.monthlyIncome'), value: defaultCurrencyFormatter.format(defaultIncome) },
                      { label: t('dashboard.monthlyExpenses'), value: defaultCurrencyFormatter.format(defaultExpenses) },
                    ]
                  : undefined
              }
              hint={t('common.monthNet', { start: dateRange.start, end: dateRange.end })}
              className="border-0 bg-gradient-to-br from-[#1b2559] via-[#3f5efb] to-[#5f76ff] text-white shadow-lg"
              labelClassName="text-white/95"
              hintClassName="text-white/90"
              backgroundChart={
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={balanceTrend}>
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke={CHART_THEME.layout.mutedLine}
                      fill={CHART_THEME.layout.mutedLine}
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              }
            />
          </div>
          {secondaryCurrencyCode && secondaryCurrencyFormatter ? (
            <div className="sm:col-span-1">
              <KpiCard
                label={`${t('dashboard.currentBalance')} (${secondaryCurrencyCode} ${getCurrencySymbol(locale, secondaryCurrencyCode)})`}
                icon={BadgeDollarSign}
                value={reportsState === 'success' ? secondaryCurrencyFormatter.format(secondaryCurrencyBalance) : '--'}
                valueAccessory={
                  <img
                    src={getCurrencyFlag(secondaryCurrencyCode)}
                    alt={`${secondaryCurrencyCode} flag`}
                    className="h-11 w-11 rounded-full object-cover shadow-md ring-2 ring-white/80"
                  />
                }
                details={
                  reportsState === 'success'
                    ? [
                        { label: t('dashboard.monthlyIncome'), value: secondaryCurrencyFormatter.format(secondaryIncome) },
                        { label: t('dashboard.monthlyExpenses'), value: secondaryCurrencyFormatter.format(secondaryExpenses) },
                      ]
                    : undefined
                }
                hint={
                  additionalSecondaryCount > 0
                    ? `${t('common.monthNet', { start: dateRange.start, end: dateRange.end })} · +${additionalSecondaryCount} other currencies`
                    : t('common.monthNet', { start: dateRange.start, end: dateRange.end })
                }
                className="border-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] text-white shadow-lg"
                labelClassName="text-white/95"
                hintClassName="text-white/90"
                backgroundChart={
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={balanceTrend}>
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke={CHART_THEME.layout.mutedLine}
                        fill={CHART_THEME.layout.mutedLine}
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                }
              />
            </div>
          ) : null}
        </div>
        <div className="flex w-full justify-start bg-transparent md:justify-end">
          <MonthNavigator />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title={t('dashboard.balanceValues')} subtitle={t('dashboard.accountsAndCardsBalances')}>
            <div className="space-y-4">
              <details className="rounded-xl border bg-card p-2">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                  {t('dashboard.selectAccounts')}
                </summary>
                <div className="mt-2 max-h-40 space-y-1 overflow-auto">
                  {accounts.map((account) => (
                    <label key={account.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.includes(account.id)}
                        onChange={() => toggleAccountSelection(account.id)}
                      />
                      <span>{account.name}</span>
                    </label>
                  ))}
                </div>
              </details>
              <div className="space-y-1 rounded-xl border bg-card p-2">
                {selectedValueAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between text-sm">
                    <span>{account.name}</span>
                    <span className="font-semibold">
                      {makeCurrencyFormatter(locale, (account.currency ?? currencyCode).toUpperCase()).format(account.balance)}
                    </span>
                  </div>
                ))}
                {selectedValueAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('dashboard.noActiveAccounts')}</p>
                ) : null}
              </div>
              <div className="space-y-1 rounded-xl border bg-card p-2">
                {creditCards.map((card) => (
                  <div key={card.id} className="flex items-center justify-between text-sm">
                    <span>{card.name}</span>
                    <span className="font-semibold">
                      {makeCurrencyFormatter(locale, (card.currency ?? currencyCode).toUpperCase()).format(card.current_balance)}
                    </span>
                  </div>
                ))}
                {creditCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('dashboard.noActiveCreditCards')}</p>
                ) : null}
              </div>
            </div>
          </ChartCard>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <KpiCard
            label={t('dashboard.investedPctIncome')}
            icon={PiggyBank}
            value={reportsState === 'success' && investmentsState === 'success' ? `${percentFormatter.format(investedPercentage)}%` : '--'}
            hint={investmentsState === 'success' ? currencyFormatter.format(totalInvested) : t('common.noInvestmentData')}
            backgroundChart={
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={investedPct12}>
                  <Area type="monotone" dataKey="value" stroke={CHART_THEME.series.income} fill={CHART_THEME.series.income} strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            }
          />
          <KpiCard
            label={t('dashboard.spentPctIncome')}
            icon={CreditCard}
            value={reportsState === 'success' ? `${percentFormatter.format(spentPercentage)}%` : '--'}
            backgroundChart={
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spentPct12}>
                  <Area type="monotone" dataKey="value" stroke={CHART_THEME.series.outflow} fill={CHART_THEME.series.outflow} strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            }
          />
        </div>
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
                const categoryMeta = categoryByName.get(budget.category.toLowerCase())
                const CategoryIcon = getCategoryIconFromMetadata(categoryMeta?.icon, budget.category)
                return (
                  <div key={budget.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-muted">
                          <CategoryIcon className="h-3.5 w-3.5" />
                        </span>
                        {budget.category}
                      </span>
                      <span className="text-muted-foreground">
                        {currencyFormatter.format(budget.consumed)} / {currencyFormatter.format(budget.configured)} ({percentFormatter.format(pct)}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${
                          pct >= 100
                            ? 'bg-gradient-to-r from-rose-500 to-red-600'
                            : 'bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500'
                        }`}
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
            <LazyMount>
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
            </LazyMount>
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
            <LazyMount>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incomeVsExpensesMonthly?.series ?? []}>
                  <defs>
                    <linearGradient id="income-gradient-12m" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="expense-gradient-12m" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(toNumber(value))} />
                  <Area type="monotone" dataKey="income" stroke={CHART_THEME.series.income} strokeWidth={3} fill="url(#income-gradient-12m)" fillOpacity={1} />
                  <Area type="monotone" dataKey="expenses" stroke={CHART_THEME.series.expenses} strokeWidth={3} fill="url(#expense-gradient-12m)" fillOpacity={1} />
                </AreaChart>
              </ResponsiveContainer>
            </LazyMount>
          ) : null}
        </ChartCard>

        <ChartCard title={t('dashboard.balanceTrendDuringMonth')} subtitle={t('dashboard.dailyProgressionMonth')}>
          {reportsState === 'loading' ? <p className="text-sm text-muted-foreground">{t('dashboard.loadingBalanceTrend')}</p> : null}
          {reportsState === 'error' ? <p className="text-sm text-red-500">{t('dashboard.balanceTrendUnavailable')}</p> : null}
          {reportsState === 'success' ? (
            <LazyMount>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceTrend}>
                  <defs>
                    <linearGradient id="balance-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_THEME.series.balance} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={CHART_THEME.series.balance} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => currencyFormatter.format(toNumber(value))} />
                  <Area type="monotone" dataKey="balance" stroke={CHART_THEME.series.balance} strokeWidth={3} fill="url(#balance-gradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </LazyMount>
          ) : null}
        </ChartCard>
      </div>
    </div>
  )
}
