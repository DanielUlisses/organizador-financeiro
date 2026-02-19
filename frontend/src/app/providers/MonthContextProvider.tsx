import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type MonthContextValue = {
  currentMonth: Date
  previousMonth: () => void
  nextMonth: () => void
  resetToCurrentMonth: () => void
}

const MonthContext = createContext<MonthContextValue | undefined>(undefined)

const getMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

export function MonthContextProvider({ children }: { children: ReactNode }) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => getMonthStart(new Date()))

  const value = useMemo(
    () => ({
      currentMonth,
      previousMonth: () =>
        setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1)),
      nextMonth: () => setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1)),
      resetToCurrentMonth: () => setCurrentMonth(getMonthStart(new Date())),
    }),
    [currentMonth],
  )

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook must live with provider
export function useMonthContext() {
  const context = useContext(MonthContext)
  if (!context) {
    throw new Error('useMonthContext must be used within MonthContextProvider')
  }
  return context
}
