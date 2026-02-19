import { describe, expect, it } from 'vitest'
import { buildRunningBalanceSeries, getSignedAmount, isInMonth } from '@/pages/Accounts/accounts-helpers'

describe('accounts helpers', () => {
  it('checks date in selected month', () => {
    const february = new Date(2026, 1, 1)
    expect(isInMonth('2026-02-10', february)).toBe(true)
    expect(isInMonth('2026-03-01', february)).toBe(false)
  })

  it('computes signed amount with account links', () => {
    expect(getSignedAmount({ id: 1, description: '', amount: 100, from_account_id: 10 }, 10)).toBe(-100)
    expect(getSignedAmount({ id: 2, description: '', amount: 100, to_account_id: 10 }, 10)).toBe(100)
  })

  it('prioritizes bank account type on mixed account ids', () => {
    expect(
      getSignedAmount(
        { id: 3, description: '', amount: 100, from_account_type: 'investment_account', from_account_id: 10, to_account_type: 'bank_account', to_account_id: 10 },
        10,
      ),
    ).toBe(100)
  })

  it('builds running balance series ordered by due date', () => {
    const series = buildRunningBalanceSeries(
      1000,
      [
        { id: 1, description: 'Expense', amount: 100, category: 'expense', due_date: '2026-02-10' },
        { id: 2, description: 'Income', amount: 200, category: 'income', due_date: '2026-02-05' },
      ],
      1,
    )
    expect(series).toEqual([
      { label: '02-05', balance: 1200, cumulativeExpenses: 0 },
      { label: '02-10', balance: 1100, cumulativeExpenses: 100 },
    ])
  })
})
