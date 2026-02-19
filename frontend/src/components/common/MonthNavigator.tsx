import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMonthContext } from '@/app/providers/MonthContextProvider'
import { Button } from '@/components/ui/button'

const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

export function MonthNavigator() {
  const { currentMonth, previousMonth, nextMonth, resetToCurrentMonth } = useMonthContext()

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={previousMonth} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-44 rounded-md border bg-card px-3 py-2 text-center text-sm font-medium">
        {formatter.format(currentMonth)}
      </div>
      <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={resetToCurrentMonth}>
        Current month
      </Button>
    </div>
  )
}
