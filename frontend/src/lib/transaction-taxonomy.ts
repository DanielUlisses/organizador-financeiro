export type TransactionType = 'expense' | 'income' | 'transfer'

export const TRANSACTION_TYPE_OPTIONS: TransactionType[] = ['expense', 'income', 'transfer']

export const TRANSACTION_CHILD_CATEGORIES: Record<TransactionType, string[]> = {
  expense: ['bills', 'housing', 'transport', 'food', 'health', 'other'],
  income: ['salary', 'dividends', 'freelance', 'other'],
  transfer: ['investment', 'credit_card_payment', 'savings', 'other'],
}

const CHILD_CATEGORY_MARKER = 'child_category='

export const defaultChildCategory = (transactionType: TransactionType) =>
  TRANSACTION_CHILD_CATEGORIES[transactionType][0]

export const getTransactionTypeFromBackendCategory = (category?: string | null): TransactionType => {
  const normalized = (category ?? '').toLowerCase()
  if (normalized === 'income') return 'income'
  if (normalized === 'transfer') return 'transfer'
  return 'expense'
}

export const parseChildCategory = (notes?: string | null) => {
  if (!notes) return null
  const parts = notes.split('|').map((part) => part.trim())
  const marker = parts.find((part) => part.startsWith(CHILD_CATEGORY_MARKER))
  if (!marker) return null
  const value = marker.slice(CHILD_CATEGORY_MARKER.length).trim()
  return value || null
}

export const attachChildCategoryToNotes = (baseNotes: string | null | undefined, childCategory: string) => {
  const notes = (baseNotes ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith(CHILD_CATEGORY_MARKER))

  notes.unshift(`${CHILD_CATEGORY_MARKER}${childCategory}`)
  return notes.join(' | ')
}

export const getDisplayCategory = (category?: string | null, notes?: string | null) => {
  const child = parseChildCategory(notes)
  if (child) return child
  return category ?? 'other'
}
