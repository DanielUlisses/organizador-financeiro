import { Navigate } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/useAuth'

type ProtectedRouteProps = {
  children: ReactNode
}

const AUTH_ENFORCED = import.meta.env.VITE_AUTH_ENFORCED === 'true'

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const { isAuthenticated, isLoading, refreshSession } = useAuth()

  useEffect(() => {
    if (!AUTH_ENFORCED || isLoading || !isAuthenticated) return
    refreshSession()
  }, [isAuthenticated, isLoading, location.pathname, location.search, refreshSession])

  if (!AUTH_ENFORCED) return <>{children}</>

  if (isLoading) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return <>{children}</>
}
