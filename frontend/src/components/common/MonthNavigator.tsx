import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMonthContext } from '@/app/providers/MonthContextProvider'
import { Button } from '@/components/ui/button'
import { useReducedVisualEffects } from '@/hooks/useReducedVisualEffects'

export function MonthNavigator() {
  const { currentMonth, previousMonth, nextMonth, resetToCurrentMonth } = useMonthContext()
  const { t, i18n } = useTranslation()
  const reducedVisualEffects = useReducedVisualEffects()
  const locale = i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US'
  const formatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border border-white/60 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-slate-900/60 ${
        reducedVisualEffects ? '' : 'backdrop-blur'
      }`}
    >
      <Button variant="outline" size="icon" onClick={previousMonth} aria-label={t('common.previousMonth')}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-44 rounded-xl border bg-card/80 px-3 py-2 text-center text-sm font-semibold">
        {formatter.format(currentMonth)}
      </div>
      <Button variant="outline" size="icon" onClick={nextMonth} aria-label={t('common.nextMonth')}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={resetToCurrentMonth} className="hidden sm:inline-flex">
        {t('common.currentMonth')}
      </Button>
    </div>
  )
}
