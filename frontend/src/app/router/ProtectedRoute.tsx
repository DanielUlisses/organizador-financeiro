import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'

type ProtectedRouteProps = {
  children: ReactNode
}

const AUTH_ENFORCED = import.meta.env.VITE_AUTH_ENFORCED === 'true'

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!AUTH_ENFORCED) return <>{children}</>

  const isAuthenticated = localStorage.getItem('of_session') === 'active'
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <>{children}</>
}
