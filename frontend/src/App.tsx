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
import { Button } from './components/ui/button'

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

function App() {
  const [userId, setUserId] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownResponse | null>(null)
  const [incomeVsExpenses, setIncomeVsExpenses] = useState<IncomeVsExpensesResponse | null>(null)

  const colors = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6']

  const dateRange = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const format = (d: Date) => d.toISOString().slice(0, 10)
    return { start: format(start), end: format(end) }
  }, [])

  const loadReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const base = `http://localhost:8000/reports`
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

      const expenseData: ExpenseBreakdownResponse = await expenseRes.json()
      const incomeData: IncomeVsExpensesResponse = await incomeRes.json()
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
  }, [userId])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-2">Organizador Financeiro</h1>
        <p className="text-muted-foreground mb-8">Phase 5 - Reports & Analytics</p>

        <div className="card p-6 bg-card rounded-lg border mb-6">
          <div className="flex items-center gap-3">
            <label htmlFor="userId" className="text-sm font-medium">
              User ID
            </label>
            <input
              id="userId"
              type="number"
              min={1}
              value={userId}
              onChange={(e) => setUserId(Number(e.target.value) || 1)}
              className="border rounded px-3 py-2 bg-background w-24"
            />
            <Button variant="outline" onClick={() => void loadReports()}>
              Reload
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Range: {dateRange.start} to {dateRange.end}
          </p>
        </div>

        {loading && <p className="text-sm text-muted-foreground mb-4">Loading analytics...</p>}
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card p-6 bg-card rounded-lg border">
            <h2 className="text-xl font-semibold mb-2">Expense Breakdown by Category</h2>
            <p className="text-sm text-muted-foreground mb-4">
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
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6 bg-card rounded-lg border">
            <h2 className="text-xl font-semibold mb-2">Income vs Expenses</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Income: {incomeVsExpenses?.total_income?.toFixed(2) ?? '0.00'}
            </p>
            <p className="text-sm text-muted-foreground mb-1">
              Expenses: {incomeVsExpenses?.total_expenses?.toFixed(2) ?? '0.00'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Net: {incomeVsExpenses?.net?.toFixed(2) ?? '0.00'}
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeVsExpenses?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                  <Bar dataKey="income" fill="#22c55e" />
                  <Bar dataKey="expenses" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
