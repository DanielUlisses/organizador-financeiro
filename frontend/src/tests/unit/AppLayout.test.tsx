import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from '@/app/providers/ThemeProvider'
import { AppLayout } from '@/layouts/AppLayout'

describe('AppLayout', () => {
  it('toggles sidebar collapsed state', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<div>Dashboard content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    const sidebar = screen.getByTestId('sidebar-root')
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')

    await user.click(screen.getByLabelText('Toggle sidebar collapse'))
    expect(sidebar).toHaveAttribute('data-collapsed', 'true')
  })

  it('renders header notifications button', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<div>Dashboard content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    const notifications = screen.getAllByLabelText('Open notifications')
    expect(notifications.length).toBeGreaterThan(0)
    expect(notifications[0]).toBeInTheDocument()
  })
})
