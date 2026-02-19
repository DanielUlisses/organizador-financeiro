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
  currentBalance: number,
  payments: AccountPayment[],
  accountId: number,
) => {
  const sorted = [...payments].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  const monthNet = sorted.reduce((sum, payment) => sum + getSignedAmount(payment, accountId), 0)

  let rolling = currentBalance - monthNet
  let cumulativeExpenses = 0
  return sorted.map((payment, index) => {
    const signed = getSignedAmount(payment, accountId)
    rolling += signed
    if (signed < 0) cumulativeExpenses += Math.abs(signed)
    return {
      label: payment.due_date?.slice(5, 10) ?? `T${index + 1}`,
      balance: rolling,
      cumulativeExpenses,
    }
  })
}
