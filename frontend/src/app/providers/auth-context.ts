import { createContext } from 'react'

export type AuthSession = {
  email: string
  issuedAt: number
  expiresAt: number
}

export type AuthContextValue = {
  isAuthenticated: boolean
  isLoading: boolean
  session: AuthSession | null
  signIn: (googleIdToken: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => void
  refreshSession: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
