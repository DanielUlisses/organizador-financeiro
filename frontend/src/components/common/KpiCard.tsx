import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useReducedVisualEffects } from '@/hooks/useReducedVisualEffects'

type KpiCardProps = {
  label: string
  labelBadge?: ReactNode
  value: string
  valueAccessory?: ReactNode
  hint?: string
  icon?: LucideIcon
  details?: Array<{ label: string; value: string }>
  accentClassName?: string
  className?: string
  labelClassName?: string
  hintClassName?: string
  backgroundChart?: ReactNode
}

export function KpiCard({
  label,
  labelBadge,
  value,
  valueAccessory,
  hint,
  icon: Icon,
  details,
  accentClassName,
  className,
  labelClassName,
  hintClassName,
  backgroundChart,
}: KpiCardProps) {
  const reducedVisualEffects = useReducedVisualEffects()
  return (
    <article className={`relative overflow-hidden rounded-3xl border bg-card p-4 shadow-sm ${className ?? ''}`}>
      {backgroundChart && !reducedVisualEffects ? <div className="pointer-events-none absolute inset-0 opacity-35">{backgroundChart}</div> : null}
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {labelBadge ? <span>{labelBadge}</span> : null}
            <p className={`text-xs uppercase tracking-wide text-muted-foreground ${labelClassName ?? ''}`}>{label}</p>
          </div>
          {Icon ? (
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl bg-black/10 text-current ${reducedVisualEffects ? '' : 'backdrop-blur-sm'}`}>
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className={`text-2xl font-semibold ${accentClassName ?? ''}`}>{value}</p>
          {valueAccessory ? <div className="shrink-0">{valueAccessory}</div> : null}
        </div>
        {details && details.length > 0 ? (
          <div className="mt-2 space-y-1">
            {details.map((detail) => (
              <div key={detail.label} className="flex items-center justify-between text-xs">
                <span className="text-current/80">{detail.label}</span>
                <span className="font-semibold text-current/95">{detail.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        {hint ? <p className={`mt-1 text-xs text-muted-foreground ${hintClassName ?? ''}`}>{hint}</p> : null}
      </div>
    </article>
  )
}
