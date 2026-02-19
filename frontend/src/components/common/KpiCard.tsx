import type { ReactNode } from 'react'

type KpiCardProps = {
  label: string
  value: string
  hint?: string
  accentClassName?: string
  className?: string
  labelClassName?: string
  hintClassName?: string
  backgroundChart?: ReactNode
}

export function KpiCard({
  label,
  value,
  hint,
  accentClassName,
  className,
  labelClassName,
  hintClassName,
  backgroundChart,
}: KpiCardProps) {
  return (
    <article className={`relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm ${className ?? ''}`}>
      {backgroundChart ? <div className="pointer-events-none absolute inset-0 opacity-30">{backgroundChart}</div> : null}
      <div className="relative z-10">
        <p className={`text-xs uppercase tracking-wide text-muted-foreground ${labelClassName ?? ''}`}>{label}</p>
        <p className={`mt-2 text-2xl font-semibold ${accentClassName ?? ''}`}>{value}</p>
        {hint ? <p className={`mt-1 text-xs text-muted-foreground ${hintClassName ?? ''}`}>{hint}</p> : null}
      </div>
    </article>
  )
}
