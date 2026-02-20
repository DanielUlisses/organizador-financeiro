import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue, type AuthSession } from '@/app/providers/auth-context'
import { authApi } from '@/services/authApi'

const AUTH_STORAGE_KEY = 'of_auth_session_v1'
const DEFAULT_SESSION_HOURS = 8

const parseStoredSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.email || !parsed?.expiresAt || parsed.expiresAt <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

const persistSession = (session: AuthSession | null) => {
  if (!session) {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem('of_session')
    return
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  localStorage.setItem('of_session', 'active')
}

const buildSession = (email: string, now = Date.now()): AuthSession => ({
  email,
  issuedAt: now,
  expiresAt: now + DEFAULT_SESSION_HOURS * 60 * 60 * 1000,
})

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const bootstrap = async () => {
      const current = parseStoredSession()
      if (!current) {
        setSession(null)
        persistSession(null)
        setIsLoading(false)
        return
      }
      const backendSession = await authApi.getSession()
      if (backendSession.ok && backendSession.body?.authenticated) {
        setSession(current)
        persistSession(current)
      } else {
        setSession(null)
        persistSession(null)
      }
      setIsLoading(false)
    }

    void bootstrap()
  }, [])

  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => {
      if (session.expiresAt <= Date.now()) {
        setSession(null)
        persistSession(null)
      }
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [session])

  const signIn = useCallback(async (googleIdToken: string) => {
    if (!googleIdToken.trim()) {
      return { ok: false, error: 'invalid_google_token' }
    }

    const backend = await authApi.signInWithGoogle(googleIdToken)
    if (backend.ok) {
      const backendEmail = backend.body?.user?.email?.trim().toLowerCase()
      const next = buildSession(backendEmail || 'unknown@google')
      setSession(next)
      persistSession(next)
      return { ok: true }
    }

    if (backend.status === 404 || backend.status === 405 || backend.status === 501 || backend.status === 0) {
      return { ok: false, error: 'backend_unavailable' }
    }

    if (backend.status === 401) return { ok: false, error: 'invalid_google_token' }
    if (backend.status === 403) return { ok: false, error: 'unauthorized_user' }

    return { ok: false, error: 'auth_failed' }
  }, [])

  const signOut = useCallback(() => {
    void authApi.signOut()
    setSession(null)
    persistSession(null)
  }, [])

  const refreshSession = useCallback(() => {
    setSession((current) => {
      if (!current) return null
      const currentEmail = current.email
      void (async () => {
        const backendSession = await authApi.getSession()
        if (backendSession.ok) {
          if (backendSession.body?.authenticated) {
            const next = buildSession(currentEmail)
            persistSession(next)
            setSession(next)
            return
          }
          persistSession(null)
          setSession(null)
          return
        }
      })()
      return current
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(session),
      isLoading,
      session,
      signIn,
      signOut,
      refreshSession,
    }),
    [isLoading, session, signIn, signOut, refreshSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
