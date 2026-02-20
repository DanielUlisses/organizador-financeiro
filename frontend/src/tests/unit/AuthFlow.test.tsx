import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'

describe('Auth flow setup', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ total_income: 0, total_expenses: 0, net: 0, items: [], series: [] }),
      })),
    )
  })

  it('redirects protected route to login when auth is enforced', async () => {
    vi.stubEnv('VITE_AUTH_ENFORCED', 'true')
    vi.resetModules()
    const { MemoryRouter } = await import('react-router-dom')
    const { AppRoutes } = await import('@/app/router/AppRouter')
    const { ThemeProvider } = await import('@/app/providers/ThemeProvider')
    const { MonthContextProvider } = await import('@/app/providers/MonthContextProvider')
    const { AuthProvider } = await import('@/app/providers/AuthProvider')

    render(
      <ThemeProvider>
        <AuthProvider>
          <MonthContextProvider>
            <MemoryRouter initialEntries={['/dashboard']}>
              <AppRoutes />
            </MemoryRouter>
          </MonthContextProvider>
        </AuthProvider>
      </ThemeProvider>,
    )

    expect(await screen.findByRole('heading', { name: /Login|Entrar/ })).toBeInTheDocument()
  })

  it('allows sign in and enters protected page', async () => {
    vi.stubEnv('VITE_AUTH_ENFORCED', 'true')
    let authenticated = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/auth/login')) {
          authenticated = true
          return { ok: true, status: 200, json: async () => ({ authenticated: true, user: { email: 'user@example.com' } }) }
        }
        if (url.includes('/auth/session')) {
          return { ok: true, status: 200, json: async () => ({ authenticated, user: authenticated ? { email: 'user@example.com' } : null }) }
        }
        return { ok: true, status: 200, json: async () => ({ total_income: 0, total_expenses: 0, net: 0, items: [], series: [] }) }
      }),
    )
    vi.resetModules()
    const user = userEvent.setup()
    const { MemoryRouter } = await import('react-router-dom')
    const { AppRoutes } = await import('@/app/router/AppRouter')
    const { ThemeProvider } = await import('@/app/providers/ThemeProvider')
    const { MonthContextProvider } = await import('@/app/providers/MonthContextProvider')
    const { AuthProvider } = await import('@/app/providers/AuthProvider')

    render(
      <ThemeProvider>
        <AuthProvider>
          <MonthContextProvider>
            <MemoryRouter initialEntries={['/dashboard']}>
              <AppRoutes />
            </MemoryRouter>
          </MonthContextProvider>
        </AuthProvider>
      </ThemeProvider>,
    )

    await screen.findAllByRole('heading', { name: /Login|Entrar/ })
    await user.type(screen.getByLabelText(/Email|E-mail/), 'user@example.com')
    await user.type(screen.getByLabelText(/Password|Senha/), 'password123')
    await user.click(screen.getByRole('button', { name: /Sign in|Entrar/ }))

    expect(await screen.findByRole('heading', { name: /Dashboard|Painel/ })).toBeInTheDocument()
  })
})
