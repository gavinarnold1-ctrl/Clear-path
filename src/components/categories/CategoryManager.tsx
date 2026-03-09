'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { GROUP_ORDER, CATEGORY_GROUPS, suggestGroup } from '@/lib/reference/category-groups'

interface CategoryRow {
  id: string
  name: string
  group: string
  type: string
  icon: string | null
  isDefault: boolean
  userId: string | null
  txCount: number
}

interface Props {
  categories: CategoryRow[]
}

const TYPE_BADGE: Record<string, string> = {
  income: 'bg-pine/10 text-pine',
  expense: 'bg-ember/10 text-ember',
  transfer: 'bg-birch/20 text-birch',
}

export default function CategoryManager({ categories: initial }: Props) {
  const router = useRouter()
  const [categories, setCategories] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null)
  const [reassignTo, setReassignTo] = useState<string>('') // '' = uncategorize

  // Merge modal state
  const [mergeSource, setMergeSource] = useState<CategoryRow | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string>('')

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && nameRef.current) nameRef.current.focus()
  }, [editingId])

  function startEdit(cat: CategoryRow) {
    if (!cat.userId) return // Can't edit system defaults
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditGroup(cat.group)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  async function saveEdit() {
    if (!editingId || saving) return
    const name = editName.trim()
    if (!name) { setError('Name is required.'); return }

    setSaving(true)
    setError(null)

    const prev = categories
    setCategories(cats =>
      cats.map(c => c.id === editingId ? { ...c, name, group: editGroup.trim() || c.group } : c)
    )
    setEditingId(null)

    try {
      const res = await fetch(`/api/categories/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, group: editGroup.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      router.refresh()
    } catch (err) {
      setCategories(prev)
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const prev = categories
    setCategories(cats => cats.filter(c => c.id !== deleteTarget.id))
    setDeleteTarget(null)

    try {
      const url = reassignTo
        ? `/api/categories/${deleteTarget.id}?reassignTo=${reassignTo}`
        : `/api/categories/${deleteTarget.id}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch {
      setCategories(prev)
      setError('Failed to delete category')
    }
    setReassignTo('')
  }

  async function confirmMerge() {
    if (!mergeSource || !mergeTarget) return
    const prev = categories
    setCategories(cats => cats.filter(c => c.id !== mergeSource.id))
    setMergeSource(null)

    try {
      const res = await fetch(`/api/categories/${mergeSource.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: mergeTarget }),
      })
      if (!res.ok) throw new Error('Merge failed')
      router.refresh()
    } catch {
      setCategories(prev)
      setError('Failed to merge category')
    }
    setMergeTarget('')
  }

  // Group categories by group name
  const grouped = categories.reduce<Record<string, CategoryRow[]>>((acc, cat) => {
    const g = cat.group || 'Other'
    if (!acc[g]) acc[g] = []
    acc[g].push(cat)
    return acc
  }, {})

  // Sort group names by canonical order, then alphabetically for any custom groups
  const groupNames = Object.keys(grouped).sort((a, b) => {
    const orderA = GROUP_ORDER.get(a) ?? 99
    const orderB = GROUP_ORDER.get(b) ?? 99
    if (orderA !== orderB) return orderA - orderB
    return a.localeCompare(b)
  })

  // All unique groups for the edit dropdown (canonical groups + any extras)
  const allGroups = [
    ...CATEGORY_GROUPS.map(g => g.name),
    ...Object.keys(grouped).filter(g => !GROUP_ORDER.has(g)),
  ].filter((v, i, a) => a.indexOf(v) === i)

  // Categories available as reassignment/merge targets (excluding the one being deleted/merged)
  const reassignOptions = categories.filter(
    c => c.id !== deleteTarget?.id && c.id !== mergeSource?.id
  )

  // Group descriptions from reference data
  const groupDescriptions = new Map(CATEGORY_GROUPS.map(g => [g.name, g.description]))

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-ember/30 bg-ember/10 px-4 py-2 text-sm text-ember">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">dismiss</button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="card mx-4 w-full max-w-md p-6">
            <h3 className="mb-2 text-lg font-semibold text-fjord">Delete &ldquo;{deleteTarget.name}&rdquo;?</h3>
            {deleteTarget.txCount > 0 && (
              <p className="mb-3 text-sm text-stone">
                This category has <span className="font-medium">{deleteTarget.txCount}</span> transaction{deleteTarget.txCount !== 1 ? 's' : ''}.
                Choose what to do with them:
              </p>
            )}
            {deleteTarget.txCount > 0 && (
              <div className="mb-4 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="reassign"
                    checked={reassignTo === ''}
                    onChange={() => setReassignTo('')}
                  />
                  Leave uncategorized
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="reassign"
                    checked={reassignTo !== ''}
                    onChange={() => setReassignTo(reassignOptions[0]?.id ?? '')}
                  />
                  Move to another category
                </label>
                {reassignTo !== '' && (
                  <select
                    value={reassignTo}
                    onChange={e => setReassignTo(e.target.value)}
                    className="input ml-6 text-sm"
                  >
                    {reassignOptions.map(c => (
                      <option key={c.id} value={c.id}>{c.group} / {c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setDeleteTarget(null); setReassignTo('') }}>
                Cancel
              </Button>
              <button onClick={confirmDelete} className="rounded bg-ember px-3 py-1.5 text-sm font-medium text-snow hover:bg-ember/80">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge modal */}
      {mergeSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="card mx-4 w-full max-w-md p-6">
            <h3 className="mb-2 text-lg font-semibold text-fjord">Merge &ldquo;{mergeSource.name}&rdquo;</h3>
            <p className="mb-3 text-sm text-stone">
              All transactions ({mergeSource.txCount}) and budgets will be moved to the target category.
              &ldquo;{mergeSource.name}&rdquo; will be deleted.
            </p>
            <label className="mb-4 block text-sm font-medium text-fjord">
              Merge into:
              <select
                value={mergeTarget}
                onChange={e => setMergeTarget(e.target.value)}
                className="input mt-1 text-sm"
              >
                <option value="">— Select target —</option>
                {reassignOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.group} / {c.name}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setMergeSource(null); setMergeTarget('') }}>
                Cancel
              </Button>
              <button
                onClick={confirmMerge}
                disabled={!mergeTarget}
                className="rounded bg-fjord px-3 py-1.5 text-sm font-medium text-snow hover:bg-midnight disabled:opacity-50"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grouped category accordion */}
      <div className="space-y-3">
        {groupNames.map(group => {
          const cats = grouped[group]
          const totalTxCount = cats.reduce((sum, c) => sum + c.txCount, 0)
          const description = groupDescriptions.get(group)

          return (
            <details key={group} className="group" open>
              <summary className="flex cursor-pointer list-none items-baseline justify-between rounded-card bg-frost px-4 py-3 hover:bg-mist/30 [&::-webkit-details-marker]:hidden">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-display text-sm font-semibold text-fjord">{group}</h2>
                  <span className="text-xs text-stone">
                    {cats.length} categor{cats.length !== 1 ? 'ies' : 'y'}
                  </span>
                  {description && (
                    <span className="hidden text-xs text-stone/60 md:inline">&middot; {description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-stone">{totalTxCount} txn{totalTxCount !== 1 ? 's' : ''}</span>
                  <svg className="h-4 w-4 text-stone transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>

              {/* Mobile card layout */}
              <div className="mt-2 space-y-2 md:hidden">
                {cats.map(cat =>
                  editingId === cat.id ? (
                    <div key={cat.id} className="card border-2 border-mist bg-frost">
                      <div className="space-y-3">
                        <input
                          ref={nameRef}
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="input w-full text-sm"
                          placeholder="Category name"
                          onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        />
                        <select
                          value={editGroup}
                          onChange={e => setEditGroup(e.target.value)}
                          className="input w-full text-sm"
                        >
                          {allGroups.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                        <div className="flex justify-end gap-2">
                          <button onClick={cancelEdit} className="text-xs text-stone hover:text-fjord">Cancel</button>
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="rounded bg-fjord px-2 py-1 text-xs font-medium text-snow hover:bg-midnight disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={cat.id} className="card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/transactions?category=${cat.id}`} className="font-medium text-fjord hover:underline">
                              {cat.icon && <span className="mr-1">{cat.icon}</span>}
                              {cat.name}
                            </Link>
                            {!cat.userId && (
                              <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] font-medium text-stone">
                                default
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${TYPE_BADGE[cat.type] ?? ''}`}>
                              {cat.type}
                            </span>
                            <span className="text-stone">{cat.txCount} txn{cat.txCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        {cat.userId && (
                          <div className="flex items-center gap-3">
                            <button onClick={(e) => { e.stopPropagation(); startEdit(cat) }} className="text-xs text-stone hover:text-fjord">Edit</button>
                            <button onClick={(e) => { e.stopPropagation(); setMergeSource(cat) }} className="text-xs text-stone hover:text-fjord">Merge</button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(cat) }} className="text-xs text-stone hover:text-ember">Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Desktop table layout */}
              <div className="mt-1 hidden md:block">
                <div className="overflow-hidden rounded-b-card border border-mist/50 bg-snow/50">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-mist/50">
                      {cats.map(cat =>
                        editingId === cat.id ? (
                          <tr key={cat.id} className="bg-frost">
                            <td className="px-4 py-2" colSpan={2}>
                              <div className="flex gap-2">
                                <input
                                  ref={nameRef}
                                  type="text"
                                  value={editName}
                                  onChange={e => setEditName(e.target.value)}
                                  className="input flex-1 text-sm"
                                  placeholder="Category name"
                                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                />
                                <select
                                  value={editGroup}
                                  onChange={e => setEditGroup(e.target.value)}
                                  className="input text-sm"
                                >
                                  {allGroups.map(g => (
                                    <option key={g} value={g}>{g}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right text-xs text-stone">{cat.txCount}</td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={cancelEdit} className="text-xs text-stone hover:text-fjord">Cancel</button>
                                <button
                                  onClick={saveEdit}
                                  disabled={saving}
                                  className="rounded bg-fjord px-2 py-1 text-xs font-medium text-snow hover:bg-midnight disabled:opacity-50"
                                >
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={cat.id} className="hover:bg-frost/50">
                            <td className="px-4 py-2.5 font-medium text-fjord">
                              {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
                              <Link href={`/transactions?category=${cat.id}`} className="hover:underline hover:text-fjord">
                                {cat.name}
                              </Link>
                              {!cat.userId && (
                                <span className="ml-2 rounded bg-mist px-1.5 py-0.5 text-[10px] font-medium text-stone">
                                  default
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[cat.type] ?? ''}`}>
                                {cat.type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-stone">{cat.txCount}</td>
                            <td className="px-4 py-2.5 text-right">
                              {cat.userId && (
                                <div className="flex items-center justify-end gap-3">
                                  <button
                                    onClick={() => startEdit(cat)}
                                    className="text-xs text-stone hover:text-fjord"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setMergeSource(cat)}
                                    className="text-xs text-stone hover:text-fjord"
                                  >
                                    Merge
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setDeleteTarget(cat) }}
                                    className="text-xs text-stone hover:text-ember"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          )
        })}
      </div>

      <p className="mt-4 text-right text-xs text-stone">
        {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} across {groupNames.length} group{groupNames.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
