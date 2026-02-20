import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMonthContext } from '@/app/providers/MonthContextProvider'
import { Button } from '@/components/ui/button'

export function MonthNavigator() {
  const { currentMonth, previousMonth, nextMonth, resetToCurrentMonth } = useMonthContext()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US'
  const formatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={previousMonth} aria-label={t('common.previousMonth')}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-44 rounded-md border bg-card px-3 py-2 text-center text-sm font-medium">
        {formatter.format(currentMonth)}
      </div>
      <Button variant="outline" size="icon" onClick={nextMonth} aria-label={t('common.nextMonth')}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={resetToCurrentMonth}>
        {t('common.currentMonth')}
      </Button>
    </div>
  )
}
