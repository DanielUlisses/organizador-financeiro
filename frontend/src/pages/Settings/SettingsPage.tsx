import { useEffect, useMemo, useState } from 'react'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const USER_ID = 1

export function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [categories, setCategories] = useState<
    Array<{
      id: number
      transaction_type: 'expense' | 'income' | 'transfer'
      name: string
      color: string
      budget: number | null
      budget_scope: 'all_months' | 'current_month'
      budget_month: string | null
    }>
  >([])
  const [tags, setTags] = useState<Array<{ id: number; name: string; color: string }>>([])

  const [newCategory, setNewCategory] = useState({
    transaction_type: 'expense' as 'expense' | 'income' | 'transfer',
    name: '',
    color: '#5B8DEF',
    budget: '',
    budget_scope: 'all_months' as 'all_months' | 'current_month',
    budget_month: '',
  })
  const [newTag, setNewTag] = useState({ name: '', color: '#8B5CF6' })

  const groupedCategories = useMemo(
    () => ({
      expense: categories.filter((category) => category.transaction_type === 'expense'),
      income: categories.filter((category) => category.transaction_type === 'income'),
      transfer: categories.filter((category) => category.transaction_type === 'transfer'),
    }),
    [categories],
  )

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/transaction-metadata/categories?user_id=${USER_ID}`),
        fetch(`${API_BASE_URL}/transaction-metadata/tags?user_id=${USER_ID}`),
      ])
      if (!categoriesRes.ok || !tagsRes.ok) throw new Error('Failed to load category/tag settings.')
      const rawCategories = (await categoriesRes.json()) as Array<{
        id: number
        transaction_type: 'expense' | 'income' | 'transfer'
        name: string
        color: string
        budget: number | null
        budget_scope: 'all_months' | 'current_month'
        budget_month: string | null
      }>
      const rawTags = (await tagsRes.json()) as Array<{ id: number; name: string; color: string }>
      setCategories(rawCategories)
      setTags(rawTags)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const createCategory = async () => {
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${API_BASE_URL}/transaction-metadata/categories?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: newCategory.transaction_type,
          name: newCategory.name,
          color: newCategory.color,
          budget: newCategory.budget ? Number(newCategory.budget) : null,
          budget_scope: newCategory.budget_scope,
          budget_month: newCategory.budget_scope === 'current_month' ? newCategory.budget_month || null : null,
        }),
      })
      if (!response.ok) throw new Error('Failed to create category.')
      setNewCategory({
        transaction_type: 'expense',
        name: '',
        color: '#5B8DEF',
        budget: '',
        budget_scope: 'all_months',
        budget_month: '',
      })
      setNotice('Category created.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create category failed.')
    }
  }

  const createTag = async () => {
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${API_BASE_URL}/transaction-metadata/tags?user_id=${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTag),
      })
      if (!response.ok) throw new Error('Failed to create tag.')
      setNewTag({ name: '', color: '#8B5CF6' })
      setNotice('Tag created.')
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create tag failed.')
    }
  }

  const deleteCategory = async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/transaction-metadata/categories/${id}?user_id=${USER_ID}`, { method: 'DELETE' })
    if (response.ok) {
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    }
  }

  const deleteTag = async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/transaction-metadata/tags/${id}?user_id=${USER_ID}`, { method: 'DELETE' })
    if (response.ok) {
      await loadData()
      window.dispatchEvent(new CustomEvent('of:transactions-changed'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeader title="Settings" subtitle="Manage categories, monthly budgets, and tags used by charts and statements." />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading settings...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold">Create category</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Type
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCategory.transaction_type}
                onChange={(event) =>
                  setNewCategory((current) => ({ ...current, transaction_type: event.target.value as 'expense' | 'income' | 'transfer' }))
                }
              >
                <option value="expense">expense</option>
                <option value="income">income</option>
                <option value="transfer">transfer</option>
              </select>
            </label>
            <label className="text-sm">
              Name
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCategory.name}
                onChange={(event) => setNewCategory((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Color
              <input
                type="color"
                className="mt-1 h-10 w-full rounded-md border bg-background px-2"
                value={newCategory.color}
                onChange={(event) => setNewCategory((current) => ({ ...current, color: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Budget
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCategory.budget}
                onChange={(event) => setNewCategory((current) => ({ ...current, budget: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Budget scope
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCategory.budget_scope}
                onChange={(event) =>
                  setNewCategory((current) => ({ ...current, budget_scope: event.target.value as 'all_months' | 'current_month' }))
                }
              >
                <option value="all_months">all_months</option>
                <option value="current_month">current_month</option>
              </select>
            </label>
            <label className="text-sm">
              Budget month
              <input
                type="date"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newCategory.budget_month}
                onChange={(event) => setNewCategory((current) => ({ ...current, budget_month: event.target.value }))}
                disabled={newCategory.budget_scope !== 'current_month'}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void createCategory()}>Create category</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold">Create tag</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Name
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={newTag.name}
                onChange={(event) => setNewTag((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Color
              <input
                type="color"
                className="mt-1 h-10 w-full rounded-md border bg-background px-2"
                value={newTag.color}
                onChange={(event) => setNewTag((current) => ({ ...current, color: event.target.value }))}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void createTag()}>Create tag</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Categories</h3>
          {(['expense', 'income', 'transfer'] as const).map((type) => (
            <div key={type} className="mb-4">
              <p className="mb-2 text-sm font-medium uppercase text-muted-foreground">{type}</p>
              <div className="space-y-2">
                {groupedCategories[type].map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name} {category.budget ? `• ${category.budget}` : ''}
                    </span>
                    <Button variant="outline" onClick={() => void deleteCategory(category.id)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Tags</h3>
          <div className="space-y-2">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
                <Button variant="outline" onClick={() => void deleteTag(tag.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
