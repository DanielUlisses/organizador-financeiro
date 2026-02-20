export const CHART_THEME = {
  layout: {
    primary: '#5B8DEF',
    secondary: '#8B5CF6',
    positive: '#22C55E',
    negative: '#EF4444',
    mutedLine: '#93C5FD',
  },
  series: {
    balance: '#5B8DEF',
    expenses: '#8B5CF6',
    income: '#60A5FA',
    outflow: '#8B5CF6',
    inflow: '#60A5FA',
  },
}

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  bills: '#5B8DEF',
  housing: '#8B5CF6',
  transport: '#22C55E',
  salary: '#60A5FA',
  dividends: '#14B8A6',
  investment: '#A78BFA',
  credit_card_payment: '#F59E0B',
  other: '#94A3B8',
}

const FALLBACK_PALETTE = ['#5B8DEF', '#8B5CF6', '#60A5FA', '#22C55E', '#14B8A6', '#F59E0B']

export const getCategoryColor = (category: string, index = 0) => {
  return DEFAULT_CATEGORY_COLORS[category.toLowerCase()] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]
}
