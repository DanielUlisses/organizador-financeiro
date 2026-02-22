import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionHeader } from '@/components/common/SectionHeader'
import { ChartCard } from '@/components/common/ChartCard'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '/api')
const USER_ID = 1
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type InvestmentTaxRow = {
  payment_id: number
  description: string
  date: string
  amount: number
  status: string
  symbol: string
  asset_type: string
  principal: number
  gross: number
  tax: number
  profit: number
}

const parseSellMeta = (notes?: string | null) => {
  if (!notes) return null
  const fields = notes.split(';')
  const readNumber = (key: string) => {
    const raw = fields.find((field) => field.startsWith(`${key}=`))?.split('=')[1]
    return raw ? Number(raw) : 0
  }
  if (!notes.includes('investment_sell_meta')) {
    const fallbackTax = readNumber('sell_tax')
    return fallbackTax > 0
      ? { symbol: '-', asset_type: 'other', principal: 0, gross: 0, tax: fallbackTax, profit: -fallbackTax }
      : null
  }
  return {
    symbol: fields.find((field) => field.startsWith('investment_sell_meta:symbol='))?.split('=')[1] ?? '',
    asset_type: fields.find((field) => field.startsWith('asset_type='))?.split('=')[1] ?? 'other',
    principal: readNumber('principal'),
    gross: readNumber('gross'),
    tax: readNumber('tax'),
    profit: readNumber('profit'),
  }
}

export function InvestmentTaxReportPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [rows, setRows] = useState<InvestmentTaxRow[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE_URL}/payments?user_id=${USER_ID}&limit=1000`)
        if (!response.ok) throw new Error('Failed to load payments.')
        const payments = (await response.json()) as Array<{
          id: number
          description: string
          amount: number
          status?: string
          due_date?: string
          notes?: string
          from_account_type?: string
          to_account_type?: string
        }>
        const mapped = payments
          .filter((payment) => payment.from_account_type === 'investment_account' || payment.to_account_type === 'investment_account')
          .map((payment) => {
            const meta = parseSellMeta(payment.notes)
            return {
              payment_id: payment.id,
              description: payment.description,
              date: (payment.due_date ?? '').slice(0, 10),
              amount: Number(payment.amount),
              status: payment.status ?? 'pending',
              symbol: meta?.symbol ?? '-',
              asset_type: meta?.asset_type ?? '-',
              principal: meta?.principal ?? 0,
              gross: meta?.gross ?? 0,
              tax: meta?.tax ?? 0,
              profit: meta?.profit ?? 0,
            }
          })
          .filter((item) => item.date.startsWith(String(year)))
          .sort((a, b) => a.date.localeCompare(b.date))
        setRows(mapped)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [year])

  const grouped = useMemo(() => {
    const map = new Map<string, InvestmentTaxRow[]>()
    for (const row of rows) {
      const key = row.date.slice(0, 7)
      const group = map.get(key) ?? []
      group.push(row)
      map.set(key, group)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeader title={t('investments.investmentsTax')} subtitle={t('investments.investmentsTaxSubtitle')} />
      </div>

      <ChartCard title={t('common.filter')}>
        <div className="flex items-center gap-3">
          <label className="text-sm">{t('common.year')}</label>
          <input className="w-32 rounded-md border bg-background px-3 py-2 text-sm" type="number" value={year} onChange={(e)=>setYear(Number(e.target.value))} />
        </div>
      </ChartCard>

      {loading ? <p className="text-sm text-muted-foreground">{t('investments.loadingTaxRows')}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <ChartCard title={t('investments.transactionsCount', { count: rows.length })} subtitle={t('investments.includesPrincipalGrossTaxProfit')}>
        {grouped.length === 0 ? <p className="text-sm text-muted-foreground">{t('investments.noInvestmentTransactionsYear')}</p> : (
          <div className="space-y-4">
            {grouped.map(([month, monthRows]) => {
              const monthProfit = monthRows.reduce((sum, item) => sum + item.profit, 0)
              return (
                <div key={month}>
                  <div className="mb-2 flex items-center justify-between border-b pb-1 text-sm font-semibold">
                    <span>{month}</span>
                    <span>{t('common.profit')} {currency.format(monthProfit)}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {monthRows.map((item, index) => (
                      <div key={`${item.payment_id}-${item.date}-${index}`} className={index % 2 === 1 ? 'rounded-md bg-secondary/20 px-3 py-2' : 'px-3 py-2'}>
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-2">{item.date}</div>
                          <div className="col-span-2">{item.symbol}</div>
                          <div className="col-span-2">{item.asset_type}</div>
                          <div className="col-span-2 text-right">{currency.format(item.principal)}</div>
                          <div className="col-span-2 text-right">{currency.format(item.tax)}</div>
                          <div className="col-span-2 text-right">{currency.format(item.profit)}</div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ChartCard>
    </div>
  )
}
