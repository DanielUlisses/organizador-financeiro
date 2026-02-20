import type { ReactNode } from 'react'

type ChartCardProps = {
  title: string
  subtitle?: string
  /** Optional action (e.g. sort icon) shown next to the title */
  titleAction?: ReactNode
  children: ReactNode
}

export function ChartCard({ title, subtitle, titleAction, children }: ChartCardProps) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {titleAction ? <div className="shrink-0">{titleAction}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}
