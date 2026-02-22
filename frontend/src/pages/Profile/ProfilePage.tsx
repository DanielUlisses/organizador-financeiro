import { useRef, useState } from 'react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ReactCrop, { centerCrop, makeAspectCrop, type Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { User, Settings, Upload } from 'lucide-react'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'
import { getDefaultCurrency, getTransactionOrder } from '@/pages/Settings/settings-sections'
import { getCroppedImg } from '@/pages/Profile/getCroppedImg'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '/api')
const UPLOADS_BASE = '/uploads'
const USER_ID = 1

type UserProfile = {
  id: number
  email: string
  name: string | null
  profile_image_path: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

function profileImageUrl(path: string | null): string {
  if (!path) return ''
  const base = API_BASE_URL.replace(/\/$/, '')
  const uploads = UPLOADS_BASE.startsWith('/') ? UPLOADS_BASE : `/${UPLOADS_BASE}`
  return `${base}${uploads}/${path}`
}

export function ProfilePage() {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<Crop>()
  const [uploadingImage, setUploadingImage] = useState(false)

  const fetchUser = () => {
    return fetch(`${API_BASE_URL}/users/${USER_ID}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'User not found' : `Failed to load: ${res.status}`)
        return res.json()
      })
      .then((data: UserProfile) => {
        setUser(data)
        setEditName(data.name ?? '')
        setEditEmail(data.email ?? '')
      })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchUser()
      .catch((e: Error) => {
        if (!cancelled) {
          const msg = e.message || String(e)
          setError(msg === 'Failed to fetch' ? 'Cannot reach the backend.' : msg)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveProfile = async () => {
    if (!user) return
    setSaving(true)
    setNotice(null)
    try {
      const res = await fetch(`${API_BASE_URL}/users/${USER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName || null, email: editEmail }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? `Failed to save: ${res.status}`)
      }
      const updated: UserProfile = await res.json()
      setUser(updated)
      setNotice(t('common.profileUpdated'))
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t('profile.failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setCropPreviewUrl(url)
    setCrop(undefined)
    setCompletedCrop(undefined)
    setCropModalOpen(true)
  }

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget
    const c = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, naturalWidth, naturalHeight),
      naturalWidth,
      naturalHeight
    )
    setCrop(c)
    setCompletedCrop(c)
  }

  const closeCropModal = () => {
    setCropModalOpen(false)
    if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl)
    setCropPreviewUrl(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
  }

  const handleApplyCrop = async () => {
    if (!imageRef.current || !completedCrop || !cropPreviewUrl) return
    setUploadingImage(true)
    try {
      const blob = await getCroppedImg(imageRef.current, completedCrop)
      const formData = new FormData()
      formData.append('file', blob, 'profile.jpg')
      const res = await fetch(`${API_BASE_URL}/users/${USER_ID}/profile-image`, {
        method: 'PUT',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? `Upload failed: ${res.status}`)
      }
      const updated: UserProfile = await res.json()
      setUser(updated)
      closeCropModal()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingImage(false)
    }
  }

  const defaultCurrency = getDefaultCurrency()
  const transactionOrder = getTransactionOrder()
  const avatarUrl = user ? profileImageUrl(user.profile_image_path) : ''

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          {t('profile.loadingProfile')}
        </div>
      </div>
    )
  }

  if (error) {
    const isConnectionError = error === 'Cannot reach the backend.'
    return (
      <div className="space-y-6">
        <SectionHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
        <div className="rounded-xl border bg-card p-6">
          <p className="text-destructive">{error}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {isConnectionError
              ? 'Start the backend (e.g. make start-backend), ensure the database is up (make createdb, make migrate-up), then run make seed to create the default user.'
              : error === 'User not found'
                ? 'Run make seed in the project root to create the default user, then reload.'
                : t('profile.backendCheck')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold">{t('common.userInformation')}</h3>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 flex-col items-center gap-2">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={t('common.profile')}
                  className="h-24 w-24 rounded-full border-2 border-muted object-cover"
                  onError={() => setUser((u) => (u ? { ...u, profile_image_path: null } : null))}
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-muted bg-muted/50">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleSelectImage}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                {t('profile.uploadPhoto')}
              </Button>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <label className="block text-sm">
                {t('common.displayName')}
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t('common.yourName')}
                />
              </label>
              <label className="block text-sm">
                {t('common.email')}
                <input
                  type="email"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder={t('common.emailPlaceholder')}
                />
              </label>
              {notice && (
                <p className={saving ? 'text-muted-foreground' : notice.startsWith(t('common.profileUpdated')) ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                  {notice}
                </p>
              )}
              <Button onClick={() => void handleSaveProfile()} disabled={saving}>
                {saving ? t('common.saving') : t('common.saveProfile')}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold">{t('common.configuration')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('common.appWideSettings')}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('common.defaultCurrency')}</dt>
              <dd className="font-medium">{defaultCurrency}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('common.transactionOrder')}</dt>
              <dd className="font-medium">
                {transactionOrder === 'older' ? t('common.olderFirstLabel') : t('common.newerFirstLabel')}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                {t('common.openSettings')}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {cropModalOpen && cropPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg rounded-xl border bg-card p-4 shadow-lg">
            <h3 className="mb-3 text-base font-semibold">{t('profile.cropPhoto')}</h3>
            <div className="max-h-[60vh] overflow-auto">
              <ReactCrop
                crop={crop}
                onChange={(_, c) => setCrop(c)}
                onComplete={(_, c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  ref={imageRef}
                  src={cropPreviewUrl}
                  alt="Crop"
                  onLoad={onImageLoad}
                  className="max-h-[50vh] w-full object-contain"
                />
              </ReactCrop>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={closeCropModal} disabled={uploadingImage}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void handleApplyCrop()} disabled={!completedCrop || uploadingImage}>
                {uploadingImage ? t('profile.uploading') : t('common.apply')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
