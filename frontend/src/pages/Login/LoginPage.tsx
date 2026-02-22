import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/providers/useAuth'

/** From build-time env (dev) or from backend /api/config (Docker/production). */
const BUILD_TIME_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [googleClientId, setGoogleClientId] = useState<string>(BUILD_TIME_GOOGLE_CLIENT_ID)
  const [configLoaded, setConfigLoaded] = useState(Boolean(BUILD_TIME_GOOGLE_CLIENT_ID))
  const googleButtonRef = useRef<HTMLDivElement | null>(null)

  const targetAfterLogin =
    typeof location.state === 'object' && location.state && 'from' in location.state
      ? String((location.state as { from?: string }).from ?? '/dashboard')
      : '/dashboard'

  const handleGoogleSignIn = async (googleToken: string) => {
    setSubmitting(true)
    setErrorKey(null)
    const result = await signIn(googleToken)
    if (!result.ok) {
      setErrorKey(result.error ?? 'unknown')
      setSubmitting(false)
      return
    }
    navigate(targetAfterLogin, { replace: true })
  }

  // In Docker/production, VITE_GOOGLE_CLIENT_ID is not baked in; fetch from backend at runtime.
  useEffect(() => {
    if (BUILD_TIME_GOOGLE_CLIENT_ID) {
      setConfigLoaded(true)
      return
    }
    let cancelled = false
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : { googleClientId: '' }))
      .then((data: { googleClientId?: string }) => {
        if (!cancelled && data?.googleClientId) setGoogleClientId(data.googleClientId)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setConfigLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!configLoaded || !googleClientId) {
      if (configLoaded && !googleClientId) setErrorKey('google_not_configured')
      return
    }
    setErrorKey(null)

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) return
      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          void handleGoogleSignIn(response.credential ?? '')
        },
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        width: 300,
      })
    }

    if (window.google) {
      renderGoogleButton()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => renderGoogleButton()
    script.onerror = () => setErrorKey('google_not_configured')
    document.head.appendChild(script)
  }, [configLoaded, googleClientId])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('login.googleOnly')}</p>
        <div className="mt-6 space-y-3">
          <div className="flex justify-center" ref={googleButtonRef} />
          {submitting ? <p className="text-center text-sm text-muted-foreground">{t('common.loading')}</p> : null}
          {errorKey ? <p className="text-sm text-red-500">{t(`login.errors.${errorKey}`, t('common.unknownError'))}</p> : null}
        </div>
      </section>
    </main>
  )
}
