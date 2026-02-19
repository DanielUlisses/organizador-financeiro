import { AppRouter } from '@/app/router/AppRouter'
import { MonthContextProvider } from '@/app/providers/MonthContextProvider'
import { ThemeProvider } from '@/app/providers/ThemeProvider'

function App() {
  return (
    <ThemeProvider>
      <MonthContextProvider>
        <AppRouter />
      </MonthContextProvider>
    </ThemeProvider>
  )
}

export default App
