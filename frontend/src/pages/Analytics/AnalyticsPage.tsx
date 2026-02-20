import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import { ChartCard } from '@/components/common/ChartCard'
import { KpiCard } from '@/components/common/KpiCard'
import { SectionHeader } from '@/components/common/SectionHeader'
import { CHART_THEME, getCategoryColor } from '@/lib/chart-colors'
import { cn } from '@/lib/utils'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const USER_ID = 1
const EFFECTIVE_STATUSES = new Set(['processed', 'reconciled'])
const PLANNED_STATUSES = new Set(['pending', 'scheduled'])
const UNKNOWN_CATEGORY_KEY = '__unknown__'
const CUSTOM_PRESETS_STORAGE_KEY = 'of.analytics.custom-presets.v1'

type AnalyticsSectionId = 'expense-trends' | 'expense-composition' | 'category-comparison' | 'income-expenses-table' | 'investment-analysis'
type Timeframe = 'monthly' | 'semester' | 'yearly'
type WindowSize = 3 | 6 | 9 | 12
type CustomMetricId = 'income' | 'expenses' | 'net' | 'investmentBalance' | 'investmentNetFlow'

type MetadataCategory = {
  id: number
  transaction_type: string
  name: string
  color?: string | null
}

type InvestmentAccount = {
  id: number
  name: string
  current_value: number
}

type RawPayment = {
  id: number
  amount: unknown
  category?: string
  category_id?: number
  due_date?: string
  payment_type?: string
  status?: string
  from_account_type?: string
  from_account_id?: number
  to_account_type?: string
  to_account_id?: number
}

type RawOccurrence = {
  id: number
  scheduled_date: string
  amount: unknown
  status?: string
}

type NormalizedPayment = {
  id: string
  dueDate: string
  amount: number
  status: string
  categoryName: string
  categoryType: 'income' | 'expense' | 'transfer'
  fromAccountType?: string
  fromAccountId?: number
  toAccountType?: string
  toAccountId?: number
}

type MonthSummary = {
  monthIndex: number
  label: string
  realizedExpenses: number
  plannedExpenses: number
  realizedIncome: number
  plannedIncome: number
}

type CustomPreset = {
  id: string
  name: string
  metrics: CustomMetricId[]
  windowSize: WindowSize
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

const normalizeDate = (value?: string | null) => (value ?? '').slice(0, 10)
const isFutureMonth = (year: number, monthIndex: number) => {
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const targetMonthStart = new Date(year, monthIndex, 1).getTime()
  return targetMonthStart > currentMonthStart
}

const formatCurrency = (locale: string, currencyCode: string, value: number) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(value)

const formatMonthLabel = (locale: string, year: number, monthIndex: number) =>
  new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(year, monthIndex, 1))
const formatMonthYearLabel = (locale: string, year: number, monthIndex: number) =>
  new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(new Date(year, monthIndex, 1))

const yearFromIso = (iso: string) => Number(iso.slice(0, 4))
const monthFromIso = (iso: string) => Number(iso.slice(5, 7)) - 1

const toCategoryType = (
  payment: RawPayment,
  categoryByName: Map<string, MetadataCategory>,
  categoryById: Map<number, MetadataCategory>,
): 'income' | 'expense' | 'transfer' => {
  const fromId = payment.category_id
  const fromName = (payment.category ?? '').toLowerCase()
  const metadata = typeof fromId === 'number' ? categoryById.get(fromId) : categoryByName.get(fromName)
  const metaType = (metadata?.transaction_type ?? '').toLowerCase()
  if (metaType === 'income' || metaType === 'expense' || metaType === 'transfer') return metaType

  if (fromName === 'income' || fromName === 'expense' || fromName === 'transfer') return fromName

  if (payment.to_account_type === 'bank_account' && payment.from_account_type !== 'bank_account') return 'income'
  if (payment.from_account_type === 'bank_account' && payment.to_account_type !== 'bank_account') return 'expense'

  return 'expense'
}

const shouldUsePaymentForMonth = (payment: NormalizedPayment, year: number, monthIndex: number) => {
  const status = payment.status.toLowerCase()
  if (EFFECTIVE_STATUSES.has(status)) return true
  if (!PLANNED_STATUSES.has(status)) return false
  return isFutureMonth(year, monthIndex)
}

const buildMonthSummary = (
  payments: NormalizedPayment[],
  selectedYear: number,
  locale: string,
  selectedExpenseCategories: Set<string>,
): MonthSummary[] => {
  const base = Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    label: formatMonthLabel(locale, selectedYear, monthIndex),
    realizedExpenses: 0,
    plannedExpenses: 0,
    realizedIncome: 0,
    plannedIncome: 0,
  }))

  for (const payment of payments) {
    if (!payment.dueDate) continue
    if (yearFromIso(payment.dueDate) !== selectedYear) continue
    const monthIndex = monthFromIso(payment.dueDate)
    if (monthIndex < 0 || monthIndex > 11) continue
    const status = payment.status.toLowerCase()
    const amount = Math.abs(payment.amount)

    if (payment.categoryType === 'expense') {
      if (!selectedExpenseCategories.has(payment.categoryName)) continue
      if (EFFECTIVE_STATUSES.has(status)) base[monthIndex].realizedExpenses += amount
      else if (PLANNED_STATUSES.has(status) && isFutureMonth(selectedYear, monthIndex)) base[monthIndex].plannedExpenses += amount
      continue
    }

    if (payment.categoryType === 'income') {
      if (EFFECTIVE_STATUSES.has(status)) base[monthIndex].realizedIncome += amount
      else if (PLANNED_STATUSES.has(status) && isFutureMonth(selectedYear, monthIndex)) base[monthIndex].plannedIncome += amount
    }
  }

  return base
}

export function AnalyticsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US'
  const currencyCode = i18n.language === 'pt-BR' ? 'BRL' : 'USD'
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonthIndex = now.getMonth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSection, setCurrentSection] = useState<AnalyticsSectionId>('expense-trends')
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(currentMonthIndex)
  const [windowSize, setWindowSize] = useState<WindowSize>(6)

  const [categories, setCategories] = useState<MetadataCategory[]>([])
  const [payments, setPayments] = useState<NormalizedPayment[]>([])
  const [investmentAccounts, setInvestmentAccounts] = useState<InvestmentAccount[]>([])
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<Set<string>>(new Set())
  const [selectedInvestmentAccountIds, setSelectedInvestmentAccountIds] = useState<Set<number>>(new Set())
  const [crossMetricCategory, setCrossMetricCategory] = useState<string>('')
  const [crossMetricAccountId, setCrossMetricAccountId] = useState<number | 'all'>('all')
  const [customMetrics, setCustomMetrics] = useState<Set<CustomMetricId>>(new Set(['income', 'expenses', 'net']))
  const [customWindowSize, setCustomWindowSize] = useState<WindowSize>(6)
  const [customPresetName, setCustomPresetName] = useState('')
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as CustomPreset[]
      if (!Array.isArray(parsed)) return []
      return parsed
    } catch {
      return []
    }
  })

  const sectionOptions: Array<{ id: AnalyticsSectionId; label: string }> = [
    { id: 'expense-trends', label: t('analytics.sections.expenseTrends') },
    { id: 'expense-composition', label: t('analytics.sections.expenseComposition') },
    { id: 'category-comparison', label: t('analytics.sections.categoryComparison') },
    { id: 'income-expenses-table', label: t('analytics.sections.incomeExpensesTable') },
    { id: 'investment-analysis', label: t('analytics.sections.investmentAnalysis') },
  ]

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.transaction_type.toLowerCase() === 'expense'),
    [categories],
  )

  const availableYears = useMemo(() => {
    const years = new Set<number>([selectedYear, currentYear, currentYear - 1])
    for (const payment of payments) {
      if (!payment.dueDate) continue
      years.add(yearFromIso(payment.dueDate))
    }
    return [...years].sort((a, b) => a - b)
  }, [currentYear, payments, selectedYear])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [categoriesRes, paymentsRes, investmentAccountsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/transaction-metadata/categories?user_id=${USER_ID}`),
          fetch(`${API_BASE_URL}/payments?user_id=${USER_ID}&limit=5000`),
          fetch(`${API_BASE_URL}/investment-accounts?user_id=${USER_ID}&limit=200`),
        ])

        if (!categoriesRes.ok || !paymentsRes.ok || !investmentAccountsRes.ok) {
          throw new Error(t('analytics.errors.loadFailed'))
        }

        const rawCategories = (await categoriesRes.json()) as MetadataCategory[]
        const rawPayments = (await paymentsRes.json()) as RawPayment[]
        const rawInvestmentAccounts = (await investmentAccountsRes.json()) as Array<{
          id: number
          name: string
          current_value: unknown
        }>

        const categoryById = new Map(rawCategories.map((category) => [category.id, category]))
        const categoryByName = new Map(rawCategories.map((category) => [category.name.toLowerCase(), category]))
        const recurringPayments = rawPayments.filter((payment) => payment.payment_type === 'recurring')
        const occurrencesByPaymentId = new Map<number, RawOccurrence[]>()

        const occurrenceResponses = await Promise.all(
          recurringPayments.map(async (payment) => {
            const response = await fetch(`${API_BASE_URL}/payments/${payment.id}/occurrences?user_id=${USER_ID}&limit=1000`)
            if (!response.ok) return { paymentId: payment.id, occurrences: [] as RawOccurrence[] }
            const occurrences = (await response.json()) as RawOccurrence[]
            return { paymentId: payment.id, occurrences }
          }),
        )

        for (const response of occurrenceResponses) {
          occurrencesByPaymentId.set(response.paymentId, response.occurrences)
        }

        const normalized: NormalizedPayment[] = []
        for (const payment of rawPayments) {
          const categoryType = toCategoryType(payment, categoryByName, categoryById)
          const categoryName =
            (typeof payment.category_id === 'number' ? categoryById.get(payment.category_id)?.name : undefined) ??
            payment.category ??
            UNKNOWN_CATEGORY_KEY

          if (payment.payment_type !== 'recurring') {
            normalized.push({
              id: `p-${payment.id}`,
              dueDate: normalizeDate(payment.due_date),
              amount: toNumber(payment.amount),
              status: (payment.status ?? 'pending').toLowerCase(),
              categoryName,
              categoryType,
              fromAccountType: payment.from_account_type,
              fromAccountId: payment.from_account_id,
              toAccountType: payment.to_account_type,
              toAccountId: payment.to_account_id,
            })
            continue
          }

          const occurrences = occurrencesByPaymentId.get(payment.id) ?? []
          for (const occurrence of occurrences) {
            normalized.push({
              id: `o-${payment.id}-${occurrence.id}`,
              dueDate: normalizeDate(occurrence.scheduled_date),
              amount: toNumber(occurrence.amount),
              status: (occurrence.status ?? payment.status ?? 'pending').toLowerCase(),
              categoryName,
              categoryType,
              fromAccountType: payment.from_account_type,
              fromAccountId: payment.from_account_id,
              toAccountType: payment.to_account_type,
              toAccountId: payment.to_account_id,
            })
          }
        }

        setCategories(rawCategories)
        setPayments(normalized)
        setInvestmentAccounts(
          rawInvestmentAccounts.map((account) => ({
            id: account.id,
            name: account.name,
            current_value: toNumber(account.current_value),
          })),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.unknownError'))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [t])

  useEffect(() => {
    if (expenseCategories.length === 0) return
    if (selectedExpenseCategories.size > 0) return
    setSelectedExpenseCategories(new Set(expenseCategories.map((category) => category.name)))
  }, [expenseCategories, selectedExpenseCategories.size])

  useEffect(() => {
    if (investmentAccounts.length === 0) return
    if (selectedInvestmentAccountIds.size > 0) return
    setSelectedInvestmentAccountIds(new Set(investmentAccounts.map((account) => account.id)))
  }, [investmentAccounts, selectedInvestmentAccountIds.size])

  useEffect(() => {
    if (crossMetricCategory) return
    const firstSelected = expenseCategories.find((category) => selectedExpenseCategories.has(category.name))?.name
    if (firstSelected) setCrossMetricCategory(firstSelected)
  }, [crossMetricCategory, expenseCategories, selectedExpenseCategories])

  useEffect(() => {
    if (crossMetricAccountId !== 'all') return
    if (investmentAccounts.length === 0) return
    setCrossMetricAccountId(investmentAccounts[0].id)
  }, [crossMetricAccountId, investmentAccounts])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(customPresets))
  }, [customPresets])

  const monthSummary = useMemo(
    () => buildMonthSummary(payments, selectedYear, locale, selectedExpenseCategories),
    [locale, payments, selectedExpenseCategories, selectedYear],
  )

  const expenseTrendData = useMemo(() => {
    if (timeframe === 'monthly') {
      return monthSummary.map((item) => ({
        label: item.label,
        realized: item.realizedExpenses,
        planned: item.plannedExpenses,
        total: item.realizedExpenses + item.plannedExpenses,
      }))
    }

    if (timeframe === 'semester') {
      const first = monthSummary.slice(0, 6)
      const second = monthSummary.slice(6, 12)
      return [
        {
          label: 'H1',
          realized: first.reduce((sum, item) => sum + item.realizedExpenses, 0),
          planned: first.reduce((sum, item) => sum + item.plannedExpenses, 0),
          total: first.reduce((sum, item) => sum + item.realizedExpenses + item.plannedExpenses, 0),
        },
        {
          label: 'H2',
          realized: second.reduce((sum, item) => sum + item.realizedExpenses, 0),
          planned: second.reduce((sum, item) => sum + item.plannedExpenses, 0),
          total: second.reduce((sum, item) => sum + item.realizedExpenses + item.plannedExpenses, 0),
        },
      ]
    }

    return Array.from({ length: 5 }, (_, index) => selectedYear - 4 + index).map((year) => {
      let realized = 0
      let planned = 0
      for (const payment of payments) {
        if (!payment.dueDate || payment.categoryType !== 'expense') continue
        if (!selectedExpenseCategories.has(payment.categoryName)) continue
        if (yearFromIso(payment.dueDate) !== year) continue
        const monthIndex = monthFromIso(payment.dueDate)
        const status = payment.status.toLowerCase()
        if (EFFECTIVE_STATUSES.has(status)) {
          realized += Math.abs(payment.amount)
          continue
        }
        if (PLANNED_STATUSES.has(status) && shouldUsePaymentForMonth(payment, year, monthIndex)) {
          planned += Math.abs(payment.amount)
        }
      }
      return { label: String(year), realized, planned, total: realized + planned }
    })
  }, [monthSummary, payments, selectedExpenseCategories, selectedYear, timeframe])

  const pieData = useMemo(() => {
    const totals = new Map<string, number>()
    for (const payment of payments) {
      if (!payment.dueDate || payment.categoryType !== 'expense') continue
      if (yearFromIso(payment.dueDate) !== selectedYear || monthFromIso(payment.dueDate) !== selectedMonthIndex) continue
      if (!selectedExpenseCategories.has(payment.categoryName)) continue
      if (!shouldUsePaymentForMonth(payment, selectedYear, selectedMonthIndex)) continue
      totals.set(payment.categoryName, (totals.get(payment.categoryName) ?? 0) + Math.abs(payment.amount))
    }
    return [...totals.entries()].map(([category, total], index) => ({
      category,
      total,
      color: getCategoryColor(category, index),
    }))
  }, [payments, selectedExpenseCategories, selectedMonthIndex, selectedYear])

  const comparisonMonths = useMemo(() => {
    const months: Array<{ year: number; monthIndex: number; label: string }> = []
    for (let i = windowSize - 1; i >= 0; i -= 1) {
      const date = new Date(selectedYear, selectedMonthIndex - i, 1)
      months.push({
        year: date.getFullYear(),
        monthIndex: date.getMonth(),
        label: formatMonthLabel(locale, date.getFullYear(), date.getMonth()),
      })
    }
    return months
  }, [locale, selectedMonthIndex, selectedYear, windowSize])

  const comparisonData = useMemo(() => {
    const keys = [...selectedExpenseCategories]
    return comparisonMonths.map((month) => {
      const point: Record<string, number | string> = { label: month.label }
      for (const key of keys) point[key] = 0
      for (const payment of payments) {
        if (!payment.dueDate || payment.categoryType !== 'expense') continue
        if (!keys.includes(payment.categoryName)) continue
        if (yearFromIso(payment.dueDate) !== month.year || monthFromIso(payment.dueDate) !== month.monthIndex) continue
        if (!shouldUsePaymentForMonth(payment, month.year, month.monthIndex)) continue
        point[payment.categoryName] = (point[payment.categoryName] as number) + Math.abs(payment.amount)
      }
      return point
    })
  }, [comparisonMonths, payments, selectedExpenseCategories])

  const tableData = useMemo(() => {
    const anchor = new Date(selectedYear, selectedMonthIndex, 1)
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(anchor.getFullYear(), anchor.getMonth() + index - 5, 1)
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: formatMonthYearLabel(locale, date.getFullYear(), date.getMonth()),
        year: date.getFullYear(),
        monthIndex: date.getMonth(),
      }
    })

    const incomeByCategory = new Map<string, number[]>()
    const expenseByCategory = new Map<string, number[]>()

    const ensureCategory = (target: Map<string, number[]>, categoryName: string) => {
      if (!target.has(categoryName)) target.set(categoryName, Array.from({ length: months.length }, () => 0))
      return target.get(categoryName)!
    }

    for (const payment of payments) {
      if (!payment.dueDate) continue
      const monthSlot = months.findIndex((month) => yearFromIso(payment.dueDate) === month.year && monthFromIso(payment.dueDate) === month.monthIndex)
      if (monthSlot < 0) continue
      const month = months[monthSlot]
      if (!shouldUsePaymentForMonth(payment, month.year, month.monthIndex)) continue
      const amount = Math.abs(payment.amount)

      if (payment.categoryType === 'income') {
        const values = ensureCategory(incomeByCategory, payment.categoryName)
        values[monthSlot] += amount
      } else if (payment.categoryType === 'expense') {
        const values = ensureCategory(expenseByCategory, payment.categoryName)
        values[monthSlot] += amount
      }
    }

    const toRows = (source: Map<string, number[]>) =>
      [...source.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([category, values]) => ({
          category,
          values,
          total: values.reduce((sum, value) => sum + value, 0),
        }))

    const incomeRows = toRows(incomeByCategory)
    const expenseRows = toRows(expenseByCategory)

    const subtotalByMonth = (rows: Array<{ values: number[] }>) =>
      months.map((_, monthIndex) => rows.reduce((sum, row) => sum + row.values[monthIndex], 0))

    const incomeSubtotal = subtotalByMonth(incomeRows)
    const expenseSubtotal = subtotalByMonth(expenseRows)
    const netByMonth = months.map((_, monthIndex) => incomeSubtotal[monthIndex] - expenseSubtotal[monthIndex])

    return {
      months,
      incomeRows,
      expenseRows,
      incomeSubtotal,
      expenseSubtotal,
      netByMonth,
      incomeTotal: incomeSubtotal.reduce((sum, value) => sum + value, 0),
      expenseTotal: expenseSubtotal.reduce((sum, value) => sum + value, 0),
      netTotal: netByMonth.reduce((sum, value) => sum + value, 0),
    }
  }, [locale, payments, selectedMonthIndex, selectedYear])

  const renderAmountCell = (value: number, className?: string) => (
    <td className={cn('px-3 py-2 text-right font-medium whitespace-nowrap', className)}>{formatCurrency(locale, currencyCode, value)}</td>
  )

  const renderCategoryRow = (row: { category: string; values: number[]; total: number }, tone: 'income' | 'expense') => (
    <tr key={`${tone}-${row.category}`} className="border-b">
      <td className="py-2 pr-3 font-medium">{row.category === UNKNOWN_CATEGORY_KEY ? t('common.noCategory') : row.category}</td>
      {row.values.map((value, index) => (
        <td key={`${tone}-${row.category}-${tableData.months[index].key}`} className="px-3 py-2 text-right whitespace-nowrap">
          {formatCurrency(locale, currencyCode, value)}
        </td>
      ))}
      {renderAmountCell(row.total)}
    </tr>
  )

  const subtotalRowClass = 'bg-muted/40'

  const netClass = (value: number) => (value >= 0 ? 'text-emerald-600' : 'text-red-600')

  const incomeExpenseTable = (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-3">{t('analytics.table.category')}</th>
            {tableData.months.map((month) => (
              <th key={month.key} className="px-3 py-2 text-right whitespace-nowrap">
                {month.label}
              </th>
            ))}
            <th className="px-3 py-2 text-right whitespace-nowrap">{t('common.total')}</th>
          </tr>
        </thead>
        <tbody>
          {tableData.incomeRows.map((row) => renderCategoryRow(row, 'income'))}
          <tr className={cn('border-b font-semibold', subtotalRowClass)}>
            <td className="py-2 pr-3">{t('analytics.table.incomeSubtotal')}</td>
            {tableData.incomeSubtotal.map((value, index) => (
              <td key={`income-subtotal-${tableData.months[index].key}`} className="px-3 py-2 text-right whitespace-nowrap">
                {formatCurrency(locale, currencyCode, value)}
              </td>
            ))}
            {renderAmountCell(tableData.incomeTotal)}
          </tr>

          {tableData.expenseRows.map((row) => renderCategoryRow(row, 'expense'))}
          <tr className={cn('border-b font-semibold', subtotalRowClass)}>
            <td className="py-2 pr-3">{t('analytics.table.expenseSubtotal')}</td>
            {tableData.expenseSubtotal.map((value, index) => (
              <td key={`expense-subtotal-${tableData.months[index].key}`} className="px-3 py-2 text-right whitespace-nowrap">
                {formatCurrency(locale, currencyCode, value)}
              </td>
            ))}
            {renderAmountCell(tableData.expenseTotal)}
          </tr>

          <tr className="font-semibold">
            <td className="py-2 pr-3">{t('analytics.table.netTotal')}</td>
            {tableData.netByMonth.map((value, index) => (
              <td key={`net-total-${tableData.months[index].key}`} className={cn('px-3 py-2 text-right whitespace-nowrap', netClass(value))}>
                {formatCurrency(locale, currencyCode, value)}
              </td>
            ))}
            {renderAmountCell(tableData.netTotal, netClass(tableData.netTotal))}
          </tr>
        </tbody>
      </table>
    </div>
  )

  const investmentGrowthData = useMemo(() => {
    const base: Array<Record<string, number | string>> = monthSummary.map((month) => ({
      label: month.label,
      ...Object.fromEntries(investmentAccounts.map((account) => [String(account.id), 0])),
    }))

    const cumulativeByAccountId = new Map<number, number>()
    for (const account of investmentAccounts) cumulativeByAccountId.set(account.id, 0)

    const sortedByDate = [...payments]
      .filter((payment) => payment.dueDate && yearFromIso(payment.dueDate) === selectedYear)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

    for (const payment of sortedByDate) {
      const monthIndex = monthFromIso(payment.dueDate)
      if (!shouldUsePaymentForMonth(payment, selectedYear, monthIndex)) continue

      let accountId: number | undefined
      let delta = 0
      if (payment.toAccountType === 'investment_account' && typeof payment.toAccountId === 'number') {
        accountId = payment.toAccountId
        delta = Math.abs(payment.amount)
      } else if (payment.fromAccountType === 'investment_account' && typeof payment.fromAccountId === 'number') {
        accountId = payment.fromAccountId
        delta = -Math.abs(payment.amount)
      }
      if (typeof accountId !== 'number') continue
      if (!selectedInvestmentAccountIds.has(accountId)) continue

      const next = (cumulativeByAccountId.get(accountId) ?? 0) + delta
      cumulativeByAccountId.set(accountId, next)
      for (let index = monthIndex; index < base.length; index += 1) {
        base[index][String(accountId)] = cumulativeByAccountId.get(accountId) ?? 0
      }
    }

    return base
  }, [investmentAccounts, monthSummary, payments, selectedInvestmentAccountIds, selectedYear])

  const investmentGrowthDataWithBalance = useMemo(() => {
    return investmentGrowthData.map((point) => {
      const totalBalance = investmentAccounts
        .filter((account) => selectedInvestmentAccountIds.has(account.id))
        .reduce((sum, account) => sum + Number(point[String(account.id)] ?? 0), 0)
      return { ...point, totalBalance }
    })
  }, [investmentAccounts, investmentGrowthData, selectedInvestmentAccountIds])

  const totalYearExpenses = monthSummary.reduce((sum, item) => sum + item.realizedExpenses + item.plannedExpenses, 0)
  const totalYearIncome = monthSummary.reduce((sum, item) => sum + item.realizedIncome + item.plannedIncome, 0)
  const projectedNet = totalYearIncome - totalYearExpenses
  const selectedInvestmentAccounts = investmentAccounts.filter((account) => selectedInvestmentAccountIds.has(account.id))
  const investmentCurrentBalance = selectedInvestmentAccounts.reduce((sum, account) => sum + account.current_value, 0)
  const investmentYearNetFlow = payments.reduce((sum, payment) => {
    if (!payment.dueDate) return sum
    if (yearFromIso(payment.dueDate) !== selectedYear) return sum
    const monthIndex = monthFromIso(payment.dueDate)
    if (!shouldUsePaymentForMonth(payment, selectedYear, monthIndex)) return sum

    if (payment.toAccountType === 'investment_account' && typeof payment.toAccountId === 'number' && selectedInvestmentAccountIds.has(payment.toAccountId)) {
      return sum + Math.abs(payment.amount)
    }
    if (
      payment.fromAccountType === 'investment_account' &&
      typeof payment.fromAccountId === 'number' &&
      selectedInvestmentAccountIds.has(payment.fromAccountId)
    ) {
      return sum - Math.abs(payment.amount)
    }
    return sum
  }, 0)

  const investmentFlowByMonth = useMemo(() => {
    const values = Array.from({ length: 12 }, () => 0)
    for (const payment of payments) {
      if (!payment.dueDate) continue
      if (yearFromIso(payment.dueDate) !== selectedYear) continue
      const monthIndex = monthFromIso(payment.dueDate)
      if (!shouldUsePaymentForMonth(payment, selectedYear, monthIndex)) continue
      if (payment.toAccountType === 'investment_account' && typeof payment.toAccountId === 'number' && selectedInvestmentAccountIds.has(payment.toAccountId)) {
        values[monthIndex] += Math.abs(payment.amount)
      } else if (payment.fromAccountType === 'investment_account' && typeof payment.fromAccountId === 'number' && selectedInvestmentAccountIds.has(payment.fromAccountId)) {
        values[monthIndex] -= Math.abs(payment.amount)
      }
    }
    return values
  }, [payments, selectedInvestmentAccountIds, selectedYear])

  const categoryExpenseByMonth = useMemo(() => {
    const byCategory = new Map<string, number[]>()
    for (const category of expenseCategories) byCategory.set(category.name, Array.from({ length: 12 }, () => 0))
    for (const payment of payments) {
      if (!payment.dueDate || payment.categoryType !== 'expense') continue
      if (yearFromIso(payment.dueDate) !== selectedYear) continue
      const monthIndex = monthFromIso(payment.dueDate)
      if (!shouldUsePaymentForMonth(payment, selectedYear, monthIndex)) continue
      const values = byCategory.get(payment.categoryName)
      if (!values) continue
      values[monthIndex] += Math.abs(payment.amount)
    }
    return byCategory
  }, [expenseCategories, payments, selectedYear])

  const crossMetricData = useMemo(() => {
    return monthSummary.map((month, index) => {
      const income = month.realizedIncome + month.plannedIncome
      const expenses = month.realizedExpenses + month.plannedExpenses
      const accountValue =
        crossMetricAccountId === 'all'
          ? Number(investmentGrowthDataWithBalance[index]?.totalBalance ?? 0)
          : Number((investmentGrowthDataWithBalance[index] as Record<string, number | string> | undefined)?.[String(crossMetricAccountId)] ?? 0)
      return {
        label: month.label,
        income,
        expenses,
        net: income - expenses,
        investmentBalance: accountValue,
        investmentNetFlow: investmentFlowByMonth[index] ?? 0,
        categoryExpense: (crossMetricCategory ? categoryExpenseByMonth.get(crossMetricCategory)?.[index] : 0) ?? 0,
      }
    })
  }, [categoryExpenseByMonth, crossMetricAccountId, crossMetricCategory, investmentFlowByMonth, investmentGrowthDataWithBalance, monthSummary])

  const metricDefinitions: Array<{ id: CustomMetricId; label: string; color: string }> = [
    { id: 'income', label: t('analytics.custom.metrics.income'), color: CHART_THEME.series.income },
    { id: 'expenses', label: t('analytics.custom.metrics.expenses'), color: CHART_THEME.series.expenses },
    { id: 'net', label: t('analytics.custom.metrics.net'), color: CHART_THEME.layout.secondary },
    { id: 'investmentBalance', label: t('analytics.custom.metrics.investmentBalance'), color: CHART_THEME.layout.primary },
    { id: 'investmentNetFlow', label: t('analytics.custom.metrics.investmentNetFlow'), color: CHART_THEME.layout.positive },
  ]

  const customWindowData = useMemo(() => {
    const startMonth = Math.max(0, selectedMonthIndex - customWindowSize + 1)
    return monthSummary.slice(startMonth, selectedMonthIndex + 1).map((month, index) => ({
      key: `${selectedYear}-${month.monthIndex + 1}`,
      label: month.label,
      income: month.realizedIncome + month.plannedIncome,
      expenses: month.realizedExpenses + month.plannedExpenses,
      net: month.realizedIncome + month.plannedIncome - (month.realizedExpenses + month.plannedExpenses),
      investmentBalance: Number(investmentGrowthDataWithBalance[startMonth + index]?.totalBalance ?? 0),
      investmentNetFlow: investmentFlowByMonth[startMonth + index] ?? 0,
    }))
  }, [customWindowSize, investmentFlowByMonth, investmentGrowthDataWithBalance, monthSummary, selectedMonthIndex, selectedYear])

  const toggleCustomMetric = (metricId: CustomMetricId) => {
    setCustomMetrics((current) => {
      const next = new Set(current)
      if (next.has(metricId) && next.size > 1) next.delete(metricId)
      else next.add(metricId)
      return next
    })
  }

  const saveCustomPreset = () => {
    const name = customPresetName.trim()
    if (!name) return
    const preset: CustomPreset = {
      id: crypto.randomUUID(),
      name,
      metrics: [...customMetrics],
      windowSize: customWindowSize,
    }
    setCustomPresets((current) => [preset, ...current].slice(0, 15))
    setCustomPresetName('')
  }

  const applyCustomPreset = (preset: CustomPreset) => {
    setCustomMetrics(new Set(preset.metrics))
    setCustomWindowSize(preset.windowSize)
  }

  const deleteCustomPreset = (presetId: string) => {
    setCustomPresets((current) => current.filter((preset) => preset.id !== presetId))
  }

  const toggleCategory = (categoryName: string) => {
    setSelectedExpenseCategories((current) => {
      const next = new Set(current)
      if (next.has(categoryName)) next.delete(categoryName)
      else next.add(categoryName)
      return next
    })
  }

  const toggleInvestmentAccount = (accountId: number) => {
    setSelectedInvestmentAccountIds((current) => {
      const next = new Set(current)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeader title={t('analytics.title')} subtitle={t('analytics.subtitle')} />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sectionOptions.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setCurrentSection(section.id)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                currentSection === section.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm">
            {t('analytics.filters.year')}
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t('analytics.filters.month')}
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={selectedMonthIndex}
              onChange={(event) => setSelectedMonthIndex(Number(event.target.value))}
            >
              {Array.from({ length: 12 }, (_, monthIndex) => (
                <option key={monthIndex} value={monthIndex}>
                  {formatMonthLabel(locale, selectedYear, monthIndex)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t('analytics.filters.timeWindow')}
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={windowSize}
              onChange={(event) => setWindowSize(Number(event.target.value) as WindowSize)}
            >
              <option value={3}>3</option>
              <option value={6}>6</option>
              <option value={9}>9</option>
              <option value={12}>12</option>
            </select>
          </label>
        </div>

        {currentSection !== 'investment-analysis' && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">{t('analytics.filters.expenseCategories')}</p>
            <div className="flex flex-wrap gap-2">
              {expenseCategories.map((category, index) => {
                const selected = selectedExpenseCategories.has(category.name)
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.name)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      selected ? 'border-transparent text-white' : 'border-border bg-background text-muted-foreground',
                    )}
                    style={{ backgroundColor: selected ? (category.color ?? getCategoryColor(category.name, index)) : undefined }}
                  >
                    {category.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {currentSection === 'investment-analysis' ? (
          <>
            <KpiCard
              label={t('analytics.kpis.investmentBalance')}
              value={formatCurrency(locale, currencyCode, investmentCurrentBalance)}
              hint={t('analytics.kpis.investmentBalanceHint')}
            />
            <KpiCard
              label={t('analytics.kpis.investmentNetFlowYear')}
              value={formatCurrency(locale, currencyCode, investmentYearNetFlow)}
              hint={t('analytics.kpis.includesPlannedFuture')}
            />
            <KpiCard
              label={t('analytics.kpis.projectedNet')}
              value={formatCurrency(locale, currencyCode, projectedNet)}
              hint={t('analytics.kpis.yearProjection')}
            />
          </>
        ) : (
          <>
            <KpiCard
              label={t('analytics.kpis.expensesYear')}
              value={formatCurrency(locale, currencyCode, totalYearExpenses)}
              hint={t('analytics.kpis.includesPlannedFuture')}
            />
            <KpiCard
              label={t('analytics.kpis.incomeYear')}
              value={formatCurrency(locale, currencyCode, totalYearIncome)}
              hint={t('analytics.kpis.includesPlannedFuture')}
            />
            <KpiCard
              label={t('analytics.kpis.projectedNet')}
              value={formatCurrency(locale, currencyCode, projectedNet)}
              hint={t('analytics.kpis.yearProjection')}
            />
          </>
        )}
      </div>

      {currentSection === 'expense-trends' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartCard title={t('analytics.crossMetric.title')} subtitle={t('analytics.crossMetric.subtitle')}>
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm">
                {t('analytics.crossMetric.category')}
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={crossMetricCategory}
                  onChange={(event) => setCrossMetricCategory(event.target.value)}
                >
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {t('analytics.crossMetric.investmentAccount')}
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={crossMetricAccountId}
                  onChange={(event) => setCrossMetricAccountId(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                >
                  <option value="all">{t('analytics.crossMetric.allAccounts')}</option>
                  {investmentAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={crossMetricData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(locale, currencyCode, Number(value))} />
                  <Line type="monotone" dataKey="income" stroke={CHART_THEME.series.income} dot={false} name={t('analytics.crossMetric.series.income')} />
                  <Line type="monotone" dataKey="expenses" stroke={CHART_THEME.series.expenses} dot={false} name={t('analytics.crossMetric.series.expenses')} />
                  <Line type="monotone" dataKey="investmentBalance" stroke={CHART_THEME.layout.primary} dot={false} name={t('analytics.crossMetric.series.investmentBalance')} />
                  <Line type="monotone" dataKey="categoryExpense" stroke="#F59E0B" dot={false} name={t('analytics.crossMetric.series.categoryExpense')} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title={t('analytics.custom.title')} subtitle={t('analytics.custom.subtitle')}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  {t('analytics.custom.window')}
                  <select
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                    value={customWindowSize}
                    onChange={(event) => setCustomWindowSize(Number(event.target.value) as WindowSize)}
                  >
                    <option value={3}>3</option>
                    <option value={6}>6</option>
                    <option value={9}>9</option>
                    <option value={12}>12</option>
                  </select>
                </label>
                <label className="text-sm">
                  {t('analytics.custom.presetName')}
                  <div className="mt-1 flex gap-2">
                    <input
                      className="w-full rounded-md border bg-background px-3 py-2"
                      value={customPresetName}
                      onChange={(event) => setCustomPresetName(event.target.value)}
                      placeholder={t('analytics.custom.presetPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={saveCustomPreset}
                      className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                    >
                      {t('analytics.custom.savePreset')}
                    </button>
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {metricDefinitions.map((metric) => {
                  const selected = customMetrics.has(metric.id)
                  return (
                    <button
                      key={metric.id}
                      type="button"
                      onClick={() => toggleCustomMetric(metric.id)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        selected ? 'border-transparent text-white' : 'bg-background text-muted-foreground',
                      )}
                      style={{ backgroundColor: selected ? metric.color : undefined }}
                    >
                      {metric.label}
                    </button>
                  )
                })}
              </div>

              {customPresets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customPresets.map((preset) => (
                    <div key={preset.id} className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                      <button type="button" onClick={() => applyCustomPreset(preset)} className="text-left">
                        {preset.name}
                      </button>
                      <button type="button" onClick={() => deleteCustomPreset(preset.id)} className="text-muted-foreground">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={customWindowData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(locale, currencyCode, Number(value))} />
                  {metricDefinitions
                    .filter((metric) => customMetrics.has(metric.id))
                    .map((metric) => (
                      <Line key={metric.id} type="monotone" dataKey={metric.id} stroke={metric.color} dot={false} name={metric.label} />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      )}

      {(currentSection === 'expense-trends' || currentSection === 'expense-composition') && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {currentSection === 'expense-trends' && (
            <ChartCard
              title={t('analytics.expenseTrends.title')}
              subtitle={t('analytics.expenseTrends.subtitle')}
              titleAction={
                <select
                  className="rounded-md border bg-background px-2 py-1 text-xs"
                  value={timeframe}
                  onChange={(event) => setTimeframe(event.target.value as Timeframe)}
                >
                  <option value="monthly">{t('analytics.timeframes.monthly')}</option>
                  <option value="semester">{t('analytics.timeframes.semester')}</option>
                  <option value="yearly">{t('analytics.timeframes.yearly')}</option>
                </select>
              }
            >
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={expenseTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(locale, currencyCode, Number(value))}
                    />
                    <Area type="monotone" dataKey="realized" stackId="expenses" stroke={CHART_THEME.series.expenses} fill={CHART_THEME.series.expenses} fillOpacity={0.55} name={t('analytics.series.realized')} />
                    <Area type="monotone" dataKey="planned" stackId="expenses" stroke={CHART_THEME.layout.mutedLine} strokeDasharray="6 4" fill={CHART_THEME.layout.mutedLine} fillOpacity={0.25} name={t('analytics.series.planned')} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {currentSection === 'expense-composition' && (
            <ChartCard title={t('analytics.expenseComposition.title')} subtitle={t('analytics.expenseComposition.subtitle')}>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(value: number) => formatCurrency(locale, currencyCode, Number(value))} />
                    <Pie data={pieData} dataKey="total" nameKey="category" outerRadius={110} innerRadius={50} paddingAngle={2} label>
                      {pieData.map((entry) => (
                        <Cell key={entry.category} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {currentSection === 'expense-composition' && (
            <ChartCard title={t('analytics.expenseComposition.legendTitle')}>
              <div className="space-y-2 text-sm">
                {pieData.length === 0 ? <p className="text-muted-foreground">{t('common.noData')}</p> : null}
                {pieData
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map((item) => (
                    <div key={item.category} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.category === UNKNOWN_CATEGORY_KEY ? t('common.noCategory') : item.category}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(locale, currencyCode, item.total)}</span>
                    </div>
                  ))}
              </div>
            </ChartCard>
          )}
        </div>
      )}

      {currentSection === 'category-comparison' && (
        <ChartCard title={t('analytics.categoryComparison.title')} subtitle={t('analytics.categoryComparison.subtitle', { months: windowSize })}>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(locale, currencyCode, Number(value))} />
                {[...selectedExpenseCategories].map((category, index) => (
                  <Bar key={category} dataKey={category} stackId="expense-categories" fill={getCategoryColor(category, index)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {currentSection === 'income-expenses-table' && (
        <ChartCard title={t('analytics.incomeExpensesTable.title')} subtitle={t('analytics.incomeExpensesTable.subtitle')}>
          {incomeExpenseTable}
        </ChartCard>
      )}

      {currentSection === 'investment-analysis' && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium">{t('analytics.investmentAnalysis.accountFilter')}</p>
            <div className="flex flex-wrap gap-2">
              {investmentAccounts.map((account) => {
                const selected = selectedInvestmentAccountIds.has(account.id)
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggleInvestmentAccount(account.id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      selected ? 'border-transparent bg-primary text-primary-foreground' : 'bg-background text-muted-foreground',
                    )}
                  >
                    {account.name}
                  </button>
                )
              })}
            </div>
          </div>

          <ChartCard title={t('analytics.investmentAnalysis.growthTitle')} subtitle={t('analytics.investmentAnalysis.growthSubtitle')}>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={investmentGrowthDataWithBalance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(locale, currencyCode, Number(value))} />
                  <Area
                    type="monotone"
                    dataKey="totalBalance"
                    stroke={CHART_THEME.layout.primary}
                    fill={CHART_THEME.layout.primary}
                    fillOpacity={0.1}
                    name={t('analytics.investmentAnalysis.balanceLine')}
                  />
                  {investmentAccounts
                    .filter((account) => selectedInvestmentAccountIds.has(account.id))
                    .map((account, index) => (
                      <Area
                        key={account.id}
                        type="monotone"
                        dataKey={String(account.id)}
                        stroke={getCategoryColor(account.name, index)}
                        fill={getCategoryColor(account.name, index)}
                        fillOpacity={0.2}
                        name={account.name}
                      />
                    ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {investmentAccounts.map((account) => (
              <KpiCard key={account.id} label={account.name} value={formatCurrency(locale, currencyCode, account.current_value)} hint={t('analytics.investmentAnalysis.currentBalance')} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
