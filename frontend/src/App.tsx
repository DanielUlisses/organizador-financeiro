import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AppRouter } from '@/app/router/AppRouter'
import { MonthContextProvider } from '@/app/providers/MonthContextProvider'
import { ThemeProvider } from '@/app/providers/ThemeProvider'

function App() {
  const { i18n } = useTranslation()

  useEffect(() => {
    document.documentElement.lang = i18n.language
    document.title = i18n.t('common.appName')
  }, [i18n.language, i18n])

  return (
    <ThemeProvider>
      <MonthContextProvider>
        <AppRouter />
      </MonthContextProvider>
    </ThemeProvider>
  )
}

export default App
