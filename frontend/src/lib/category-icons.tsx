import {
  Banknote,
  Briefcase,
  Car,
  CircleDollarSign,
  Folder,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Landmark,
  LucideIcon,
  Plane,
  ReceiptText,
  Shield,
  ShoppingBag,
  Ticket,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'

export const CATEGORY_ICON_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { value: 'food', label: 'Food', icon: UtensilsCrossed },
  { value: 'transport', label: 'Transport', icon: Car },
  { value: 'home', label: 'Home', icon: Home },
  { value: 'health', label: 'Health', icon: HeartPulse },
  { value: 'education', label: 'Education', icon: GraduationCap },
  { value: 'salary', label: 'Salary', icon: Briefcase },
  { value: 'investments', label: 'Investments', icon: HandCoins },
  { value: 'bank', label: 'Bank', icon: Landmark },
  { value: 'bills', label: 'Bills', icon: ReceiptText },
  { value: 'travel', label: 'Travel', icon: Plane },
  { value: 'insurance', label: 'Insurance', icon: Shield },
  { value: 'gift', label: 'Gift', icon: Gift },
  { value: 'income', label: 'Income', icon: CircleDollarSign },
  { value: 'transfer', label: 'Transfer', icon: Banknote },
  { value: 'entertainment', label: 'Entertainment', icon: Ticket },
  { value: 'wallet', label: 'Wallet', icon: Wallet },
  { value: 'folder', label: 'Folder', icon: Folder },
]

const ICON_BY_KEY = new Map(CATEGORY_ICON_OPTIONS.map((option) => [option.value, option.icon]))

export function getCategoryIcon(iconKey?: string): LucideIcon {
  return ICON_BY_KEY.get((iconKey ?? '').toLowerCase()) ?? Wallet
}

export function getCategoryIconFromMetadata(iconKey?: string, categoryName?: string): LucideIcon {
  const normalizedIcon = (iconKey ?? '').toLowerCase()
  if (normalizedIcon && normalizedIcon !== 'folder' && normalizedIcon !== 'wallet') return getCategoryIcon(normalizedIcon)

  const name = (categoryName ?? '').toLowerCase()
  if (name.includes('food') || name.includes('restaurant') || name.includes('grocery') || name.includes('aliment') || name.includes('mercado')) return UtensilsCrossed
  if (name.includes('transport') || name.includes('uber') || name.includes('fuel') || name.includes('combust') || name.includes('transporte')) return Car
  if (name.includes('house') || name.includes('rent') || name.includes('home') || name.includes('moradia') || name.includes('aluguel') || name.includes('casa')) return Home
  if (name.includes('health') || name.includes('medical') || name.includes('pharmacy') || name.includes('saude')) return HeartPulse
  if (name.includes('salary') || name.includes('payroll') || name.includes('salario')) return Briefcase
  if (name.includes('investment') || name.includes('investimento')) return HandCoins
  if (name.includes('bill') || name.includes('utilities') || name.includes('conta')) return ReceiptText
  if (name.includes('travel') || name.includes('flight') || name.includes('viagem')) return Plane
  if (name.includes('gift') || name.includes('presente')) return Gift
  if (name.includes('entertainment') || name.includes('movie') || name.includes('lazer')) return Ticket
  return getCategoryIcon(normalizedIcon || 'wallet')
}
