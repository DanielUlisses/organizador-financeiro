import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '@/components/common/PlaceholderPage'

export function AnalyticsPage() {
  const { t } = useTranslation()
  return (
    <PlaceholderPage
      title={t('analytics.title')}
      description={t('analytics.description')}
    />
  )
}
