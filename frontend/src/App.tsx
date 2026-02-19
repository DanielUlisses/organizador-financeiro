import { useState } from 'react'
import { Button } from './components/ui/button'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-4">Organizador Financeiro</h1>
        <p className="text-muted-foreground mb-8">
          Personal finance management application
        </p>
        <div className="card p-6 bg-card rounded-lg border">
          <p className="mb-4">Welcome to the application skeleton.</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Phase 1 infrastructure is complete. shadcn/ui components are ready to use.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setCount(count + 1)}>
              Count: {count}
            </Button>
            <Button variant="outline" onClick={() => setCount(0)}>
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
