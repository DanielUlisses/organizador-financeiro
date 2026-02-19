export type ExpenseBreakdownItem = {
  label: string
  total: number
}

export type IncomeSeriesPoint = {
  period: string
  income: number
  expenses: number
  net: number
}

export type BudgetItem = {
  category: string
  configured: number
  consumed: number
}

export type BalanceTrendPoint = {
  label: string
  balance: number
}

export const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

export const calculateSpentPercentage = (income: number, expenses: number) => {
  if (income <= 0) return 0
  return Math.min(999, (expenses / income) * 100)
}

export const calculateInvestedPercentage = (income: number, invested: number) => {
  if (income <= 0) return 0
  return Math.min(999, (invested / income) * 100)
}

export const buildBudgets = (items: ExpenseBreakdownItem[]): BudgetItem[] => {
  if (!items.length) {
    return [
      { category: 'Housing', configured: 1000, consumed: 750 },
      { category: 'Food', configured: 500, consumed: 390 },
      { category: 'Transport', configured: 350, consumed: 280 },
      { category: 'Leisure', configured: 300, consumed: 120 },
    ]
  }

  return items.slice(0, 5).map((item) => {
    const configured = Math.max(item.total * 1.15, item.total + 50)
    return {
      category: item.label,
      configured,
      consumed: item.total,
    }
  })
}

export const buildBalanceTrend = (startingBalance: number, series: IncomeSeriesPoint[]): BalanceTrendPoint[] => {
  if (!series.length) {
    return [
      { label: 'W1', balance: startingBalance * 0.95 },
      { label: 'W2', balance: startingBalance * 0.98 },
      { label: 'W3', balance: startingBalance * 1.01 },
      { label: 'W4', balance: startingBalance },
    ]
  }

  let rolling = startingBalance - (series[0]?.net ?? 0)
  return series.map((point, index) => {
    rolling += point.net
    return {
      label: point.period || `P${index + 1}`,
      balance: rolling,
    }
  })
}
