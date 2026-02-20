import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/app/providers/AuthProvider'
import { AppRoutes } from '@/app/router/AppRouter'
import { MonthContextProvider } from '@/app/providers/MonthContextProvider'
import { ThemeProvider } from '@/app/providers/ThemeProvider'

function renderRoutes(initialEntry: string) {
  render(
    <ThemeProvider>
      <AuthProvider>
        <MonthContextProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <AppRoutes />
          </MemoryRouter>
        </MonthContextProvider>
      </AuthProvider>
    </ThemeProvider>,
  )
}

describe('AppRoutes', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ total_income: 0, total_expenses: 0, net: 0, items: [], series: [] }),
      })),
    )
  })

  it('renders login page in public route', () => {
    renderRoutes('/login')
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })

  it('renders placeholder protected route pages', () => {
    renderRoutes('/accounts')
    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument()
  })

  it('redirects root route to dashboard', () => {
    renderRoutes('/')
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })
})
