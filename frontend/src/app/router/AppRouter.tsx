import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/app/router/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { AccountsPage } from '@/pages/Accounts/AccountsPage'
import { AnalyticsPage } from '@/pages/Analytics/AnalyticsPage'
import { CreditCardsPage } from '@/pages/CreditCards/CreditCardsPage'
import { DashboardPage } from '@/pages/Dashboard/DashboardPage'
import { InvestmentsPage } from '@/pages/Investments/InvestmentsPage'
import { InvestmentTaxReportPage } from '@/pages/Investments/InvestmentTaxReportPage'
import { LoginPage } from '@/pages/Login/LoginPage'
import { ProfilePage } from '@/pages/Profile/ProfilePage'
import { SettingsPage } from '@/pages/Settings/SettingsPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/credit-cards" element={<CreditCardsPage />} />
        <Route path="/investments" element={<InvestmentsPage />} />
        <Route path="/investments/tax" element={<InvestmentTaxReportPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
