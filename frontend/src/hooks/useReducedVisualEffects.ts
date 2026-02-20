import { useEffect, useState } from 'react'
import { getReducedVisualEffects } from '@/pages/Settings/settings-sections'

export function useReducedVisualEffects(): boolean {
  const [enabled, setEnabled] = useState<boolean>(getReducedVisualEffects)

  useEffect(() => {
    const handleChange = () => setEnabled(getReducedVisualEffects())
    window.addEventListener('storage', handleChange)
    window.addEventListener('of:reduced-visual-effects-changed', handleChange as EventListener)
    return () => {
      window.removeEventListener('storage', handleChange)
      window.removeEventListener('of:reduced-visual-effects-changed', handleChange as EventListener)
    }
  }, [])

  return enabled
}
