export type AccountPayment = {
  id: number
  description: string
  amount: number
  category?: string | null
  due_date?: string | null
  from_account_id?: number | null
  to_account_id?: number | null
}

export const isInMonth = (isoDate: string, month: Date) => {
  const [yearRaw, monthRaw] = isoDate.split('-')
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  return year === month.getFullYear() && monthIndex === month.getMonth()
}

export const getSignedAmount = (payment: AccountPayment, accountId: number, fallbackExpense = true) => {
  const category = (payment.category ?? '').toLowerCase()
  const amount = payment.amount

  if (payment.from_account_id === accountId) return -Math.abs(amount)
  if (payment.to_account_id === accountId) return Math.abs(amount)

  if (category === 'income') return Math.abs(amount)
  if (category === 'transfer') return fallbackExpense ? -Math.abs(amount) : 0
  return -Math.abs(amount)
}

export const buildRunningBalanceSeries = (
  openingBalance: number,
  payments: AccountPayment[],
  accountId: number,
) => {
  const sorted = [...payments].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  let rolling = openingBalance
  let cumulativeExpenses = 0
  const daily = new Map<
    string,
    {
      label: string
      balance: number
      cumulativeExpenses: number
      dailyExpenses: number
    }
  >()

  for (let index = 0; index < sorted.length; index += 1) {
    const payment = sorted[index]
    const signed = getSignedAmount(payment, accountId)
    rolling += signed
    const label = payment.due_date?.slice(5, 10) ?? `T${index + 1}`
    const current = daily.get(label) ?? {
      label,
      balance: rolling,
      cumulativeExpenses,
      dailyExpenses: 0,
    }
    if (signed < 0) {
      const expense = Math.abs(signed)
      cumulativeExpenses += expense
      current.dailyExpenses += expense
    }
    current.balance = rolling
    current.cumulativeExpenses = cumulativeExpenses
    daily.set(label, current)
  }

  return [...daily.values()]
}
