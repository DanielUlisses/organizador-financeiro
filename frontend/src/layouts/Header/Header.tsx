import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/app/providers/ThemeProvider'
import { Button } from '@/components/ui/button'
import { HeaderNotifications } from '@/layouts/Header/HeaderNotifications'
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '@/i18n'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const UPLOADS_BASE = '/uploads'
const USER_ID = 1

type HeaderProfile = {
  id: number
  email: string
  name: string | null
  profile_image_path: string | null
}

function profileImageUrl(path: string | null): string {
  if (!path) return ''
  const base = API_BASE_URL.replace(/\/$/, '')
  const uploads = UPLOADS_BASE.startsWith('/') ? UPLOADS_BASE : `/${UPLOADS_BASE}`
  return `${base}${uploads}/${path}`
}

type HeaderProps = {
  collapsed: boolean
  onOpenSidebar: () => void
  onToggleCollapsed: () => void
}

export function Header({ collapsed, onOpenSidebar, onToggleCollapsed }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { t, i18n } = useTranslation()
  const [profile, setProfile] = useState<HeaderProfile | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/users/${USER_ID}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: HeaderProfile | null) => data && setProfile(data))
      .catch(() => {})
  }, [])

  const currentLang = (i18n.language === 'pt-BR' ? 'pt-BR' : 'en') as SupportedLanguageCode
  const displayName = profile ? (profile.name?.trim() || profile.email) : t('common.defaultUser')
  const avatarUrl = profile ? profileImageUrl(profile.profile_image_path) : ''

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onOpenSidebar} aria-label={t('common.openMenu')} className="md:hidden">
          <Menu className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapsed}
          aria-label={t('common.toggleSidebar')}
          className="hidden md:inline-flex"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
        <h1 className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <img
              src="/logo.svg"
              alt=""
              className="h-9 w-9 select-none object-contain object-center"
              width={36}
              height={36}
              decoding="async"
            />
          </span>
          <span className="sr-only">{t('common.appName')}</span>
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border bg-card">
          {SUPPORTED_LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => i18n.changeLanguage(code)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                currentLang === code ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              title={label}
            >
              {code === 'pt-BR' ? 'PT' : 'EN'}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('common.toggleTheme')}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <HeaderNotifications />

        <Link
          to="/profile"
          className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 hover:bg-muted/50"
        >
          <div className="hidden text-right text-xs leading-tight sm:block">
            <div className="font-medium">{displayName}</div>
          </div>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </Link>
      </div>
    </header>
  )
}
