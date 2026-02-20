import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { AnalyticsPage } from '@/pages/Analytics/AnalyticsPage'

const mockCategories = [
  { id: 1, transaction_type: 'expense', name: 'Food', color: '#22C55E' },
  { id: 2, transaction_type: 'expense', name: 'Housing', color: '#8B5CF6' },
  { id: 3, transaction_type: 'income', name: 'Salary', color: '#60A5FA' },
]

const mockPayments = [
  {
    id: 1,
    amount: 1000,
    category: 'Salary',
    due_date: '2026-01-10',
    payment_type: 'one_time',
    status: 'processed',
    to_account_type: 'bank_account',
    to_account_id: 1,
  },
  {
    id: 2,
    amount: 200,
    category: 'Food',
    due_date: '2026-01-12',
    payment_type: 'one_time',
    status: 'processed',
    from_account_type: 'bank_account',
    from_account_id: 1,
  },
  {
    id: 3,
    amount: 300,
    category: 'Housing',
    due_date: '2026-12-12',
    payment_type: 'one_time',
    status: 'scheduled',
    from_account_type: 'bank_account',
    from_account_id: 1,
  },
  {
    id: 4,
    amount: 400,
    category: 'Investment',
    due_date: '2026-01-20',
    payment_type: 'one_time',
    status: 'processed',
    to_account_type: 'investment_account',
    to_account_id: 10,
  },
]

const mockInvestmentAccounts = [
  { id: 10, name: 'Broker 1', current_value: 3000 },
  { id: 11, name: 'Broker 2', current_value: 1000 },
]

describe('AnalyticsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/transaction-metadata/categories')) {
          return { ok: true, json: async () => mockCategories }
        }
        if (url.includes('/payments?')) {
          return { ok: true, json: async () => mockPayments }
        }
        if (url.includes('/investment-accounts?')) {
          return { ok: true, json: async () => mockInvestmentAccounts }
        }
        if (url.includes('/occurrences')) {
          return { ok: true, json: async () => [] }
        }
        return { ok: true, json: async () => [] }
      }),
    )
  })

  it('renders core phase 6 interactions and keeps custom presets', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<AnalyticsPage />)

    await screen.findByText(/Expense trends|Tendência de despesas/)
    expect(screen.getByText(/Cross-metric correlation|Correlação entre métricas/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Income vs expenses table|Tabela receitas vs despesas/ }))
    expect(screen.getByRole('columnheader', { name: /Category|Categoria/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Expense trends|Tendência de despesas/ }))
    const presetInput = screen.getByPlaceholderText(/Cashflow vs portfolio|Fluxo de caixa vs carteira/)
    await user.type(presetInput, 'Test preset')
    await user.click(screen.getByRole('button', { name: /Save|Salvar/ }))

    await waitFor(() => expect(screen.getByText('Test preset')).toBeInTheDocument())

    unmount()
    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Test preset')).toBeInTheDocument())
  })
})
