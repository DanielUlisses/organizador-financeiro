import { useEffect, useMemo, useState } from 'react'
import {
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
import { MonthNavigator } from '@/components/common/MonthNavigator'
import { Button } from '@/components/ui/button'

type ExpenseBreakdownItem = {
  label: string
  total: number
}

type ExpenseBreakdownResponse = {
  user_id: number
  start_date: string
  end_date: string
  breakdown_by: string
  items: ExpenseBreakdownItem[]
  total_expenses: number
}

type IncomeSeriesPoint = {
  period: string
  income: number
  expenses: number
  net: number
}

type IncomeVsExpensesResponse = {
  user_id: number
  start_date: string
  end_date: string
  total_income: number
  total_expenses: number
  net: number
  series: IncomeSeriesPoint[]
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

export function DashboardPage() {
  const { currentMonth } = useMonthContext()
  const [userId, setUserId] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownResponse | null>(null)
  const [incomeVsExpenses, setIncomeVsExpenses] = useState<IncomeVsExpensesResponse | null>(null)

  const colors = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6']

  const dateRange = useMemo(() => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
    const format = (d: Date) => d.toISOString().slice(0, 10)
    return { start: format(start), end: format(end) }
  }, [currentMonth])

  const loadReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const base = `${API_BASE_URL}/reports`
      const [expenseRes, incomeRes] = await Promise.all([
        fetch(
          `${base}/expense-breakdown?user_id=${userId}&start_date=${dateRange.start}&end_date=${dateRange.end}&breakdown_by=category`,
        ),
        fetch(
          `${base}/income-vs-expenses?user_id=${userId}&start_date=${dateRange.start}&end_date=${dateRange.end}&granularity=month`,
        ),
      ])

      if (!expenseRes.ok || !incomeRes.ok) {
        throw new Error('Failed to load analytics data. Check backend and user id.')
      }

      const rawExpenseData = await expenseRes.json()
      const rawIncomeData = await incomeRes.json()

      const expenseData: ExpenseBreakdownResponse = {
        ...rawExpenseData,
        total_expenses: toNumber(rawExpenseData.total_expenses),
        items: (rawExpenseData.items ?? []).map((item: { label: string; total: unknown }) => ({
          label: item.label,
          total: toNumber(item.total),
        })),
      }

      const incomeData: IncomeVsExpensesResponse = {
        ...rawIncomeData,
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
      }

      setExpenseBreakdown(expenseData)
      setIncomeVsExpenses(incomeData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dateRange.start, dateRange.end])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Phase 0 shell + existing analytics view</p>
          </div>
          <MonthNavigator />
        </div>
      </div>

      <div className="card rounded-lg border bg-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="userId" className="text-sm font-medium">
            User ID
          </label>
          <input
            id="userId"
            type="number"
            min={1}
            value={userId}
            onChange={(e) => setUserId(Number(e.target.value) || 1)}
            className="w-24 rounded border bg-background px-3 py-2"
          />
          <Button variant="outline" onClick={() => void loadReports()}>
            Reload
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Range: {dateRange.start} to {dateRange.end}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">API: {API_BASE_URL}</p>
      </div>

      {loading && <p className="mb-4 text-sm text-muted-foreground">Loading analytics...</p>}
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Total Income</p>
          <p className="text-2xl font-semibold text-green-600">
            {incomeVsExpenses?.total_income?.toFixed(2) ?? '0.00'}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-semibold text-red-500">
            {incomeVsExpenses?.total_expenses?.toFixed(2) ?? '0.00'}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Net</p>
          <p className="text-2xl font-semibold">{incomeVsExpenses?.net?.toFixed(2) ?? '0.00'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card rounded-lg border bg-card p-6">
          <h2 className="mb-2 text-xl font-semibold">Expense Breakdown by Category</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Total expenses: {expenseBreakdown?.total_expenses?.toFixed(2) ?? '0.00'}
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseBreakdown?.items ?? []}
                  dataKey="total"
                  nameKey="label"
                  outerRadius={100}
                  label
                >
                  {(expenseBreakdown?.items ?? []).map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | string) => toNumber(value).toFixed(2)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card rounded-lg border bg-card p-6">
          <h2 className="mb-2 text-xl font-semibold">Income vs Expenses</h2>
          <p className="mb-4 text-sm text-muted-foreground">Monthly cashflow comparison</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeVsExpenses?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value: number | string) => toNumber(value).toFixed(2)} />
                <Bar dataKey="income" fill="#22c55e" />
                <Bar dataKey="expenses" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
