import { describe, expect, it } from 'vitest'
import {
  buildBalanceTrend,
  buildBudgets,
  calculateInvestedPercentage,
  calculateSpentPercentage,
} from '@/pages/Dashboard/dashboard-helpers'

describe('dashboard helpers', () => {
  it('calculates spent percentage from income and expenses', () => {
    expect(calculateSpentPercentage(1000, 250)).toBe(25)
  })

  it('calculates invested percentage from income and invested amount', () => {
    expect(calculateInvestedPercentage(2000, 600)).toBe(30)
  })

  it('returns fallback budgets when no categories are available', () => {
    const budgets = buildBudgets([])
    expect(budgets.length).toBeGreaterThan(0)
    expect(budgets[0]).toHaveProperty('configured')
  })

  it('builds balance trend series from net points', () => {
    const trend = buildBalanceTrend(1000, [
      { period: 'P1', income: 200, expenses: 100, net: 100 },
      { period: 'P2', income: 120, expenses: 20, net: 100 },
    ])

    expect(trend).toEqual([
      { label: 'P1', balance: 1000 },
      { label: 'P2', balance: 1100 },
    ])
  })
})
