import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function LoginPage() {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('login.emailPasswordLocked')}
        </p>
        <div className="mt-6 space-y-3">
          <label className="block text-sm">
            {t('login.email')}
            <input className="mt-1 w-full rounded-md border bg-background px-3 py-2" type="email" />
          </label>
          <label className="block text-sm">
            {t('login.password')}
            <input className="mt-1 w-full rounded-md border bg-background px-3 py-2" type="password" />
          </label>
          <Button className="w-full" type="button">
            {t('login.signIn')}
          </Button>
          <Button className="w-full" variant="outline" asChild>
            <Link to="/dashboard">{t('login.continueToDashboard')}</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
