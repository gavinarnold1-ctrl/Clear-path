'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface AccountRow {
  id: string
  name: string
  type: string
  balance: number
  currency: string
  institution: string | null
  txCount: number
}

interface Props {
  accounts: AccountRow[]
}

const TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Checking',
  SAVINGS: 'Savings',
  CREDIT_CARD: 'Credit Card',
  INVESTMENT: 'Investment',
  CASH: 'Cash',
  MORTGAGE: 'Mortgage',
  AUTO_LOAN: 'Auto Loan',
  STUDENT_LOAN: 'Student Loan',
}

const TYPE_GROUPS: Record<string, string[]> = {
  'Cash & Banking': ['CHECKING', 'SAVINGS', 'CASH'],
  'Credit': ['CREDIT_CARD'],
  'Loans': ['MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'],
  'Investments': ['INVESTMENT'],
}

const ALL_TYPES = Object.keys(TYPE_LABELS)

export default function AccountManager({ accounts: initial }: Props) {
  const router = useRouter()
  const [accounts, setAccounts] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editBalance, setEditBalance] = useState('')
  const [editInstitution, setEditInstitution] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AccountRow | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && nameRef.current) nameRef.current.focus()
  }, [editingId])

  function startEdit(acct: AccountRow) {
    setEditingId(acct.id)
    setEditName(acct.name)
    setEditType(acct.type)
    setEditBalance(String(acct.balance))
    setEditInstitution(acct.institution ?? '')
    setError(null)
  }

  async function saveEdit() {
    if (!editingId || saving) return
    const name = editName.trim()
    if (!name) { setError('Name is required.'); return }

    setSaving(true)
    setError(null)

    const prev = accounts
    const balance = parseFloat(editBalance) || 0
    setAccounts(accts =>
      accts.map(a => a.id === editingId ? {
        ...a,
        name,
        type: editType,
        balance,
        institution: editInstitution.trim() || null,
      } : a)
    )
    setEditingId(null)

    try {
      const res = await fetch(`/api/accounts/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: editType, balance: String(balance), institution: editInstitution.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      router.refresh()
    } catch (err) {
      setAccounts(prev)
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const prev = accounts
    setAccounts(accts => accts.filter(a => a.id !== deleteTarget.id))
    setDeleteTarget(null)

    try {
      const res = await fetch(`/api/accounts/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch {
      setAccounts(prev)
      setError('Failed to delete account')
    }
  }

  // Group accounts by type group
  const grouped: Record<string, AccountRow[]> = {}
  for (const acct of accounts) {
    let groupName = 'Other'
    for (const [gn, types] of Object.entries(TYPE_GROUPS)) {
      if (types.includes(acct.type)) { groupName = gn; break }
    }
    if (!grouped[groupName]) grouped[groupName] = []
    grouped[groupName].push(acct)
  }

  const groupOrder = ['Cash & Banking', 'Credit', 'Loans', 'Investments', 'Other']
  const activeGroups = groupOrder.filter(g => grouped[g]?.length)

  // Liability account balances must be subtracted for correct net worth.
  // Credit cards, mortgages, and loans represent money owed, not owned.
  const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])
  const totalBalance = accounts.reduce((sum, a) => {
    if (LIABILITY_TYPES.has(a.type)) return sum - Math.abs(a.balance)
    return sum + a.balance
  }, 0)

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
                This account has <span className="font-medium">{deleteTarget.txCount}</span> transaction{deleteTarget.txCount !== 1 ? 's' : ''}.
                They will be unlinked from this account (not deleted).
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={confirmDelete} className="rounded bg-ember px-3 py-1.5 text-sm font-medium text-snow hover:bg-ember/80">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Net worth banner */}
      <div className="mb-6 rounded-xl border border-mist bg-frost px-6 py-4">
        <p className="text-sm text-midnight">Net worth</p>
        <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-midnight' : 'text-expense'}`}>
          {formatCurrency(totalBalance)}
        </p>
      </div>

      {/* Grouped accounts */}
      {activeGroups.map(group => (
        <div key={group} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone">{group}</h2>
          <div className="space-y-3">
            {grouped[group].map(acct =>
              editingId === acct.id ? (
                <div key={acct.id} className="card border-2 border-mist bg-frost">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone">Name</label>
                      <input
                        ref={nameRef}
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="input text-sm"
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone">Type</label>
                      <select value={editType} onChange={e => setEditType(e.target.value)} className="input text-sm">
                        {ALL_TYPES.map(t => (
                          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone">Balance</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editBalance}
                        onChange={e => setEditBalance(e.target.value)}
                        className="input text-sm"
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone">Institution</label>
                      <input
                        type="text"
                        value={editInstitution}
                        onChange={e => setEditInstitution(e.target.value)}
                        className="input text-sm"
                        placeholder="e.g. Chase, Fidelity"
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => { setEditingId(null); setError(null) }} className="text-xs text-stone hover:text-fjord">Cancel</button>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="rounded bg-fjord px-3 py-1.5 text-xs font-medium text-snow hover:bg-midnight disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div key={acct.id} className="card flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-fjord">{acct.name}</p>
                    <p className="text-xs text-stone">
                      {TYPE_LABELS[acct.type] ?? acct.type}
                      {acct.institution && <span> &middot; {acct.institution}</span>}
                      {' '}&middot; {acct.txCount} txn{acct.txCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className={`text-xl font-bold ${acct.balance >= 0 ? 'text-fjord' : 'text-expense'}`}>
                      {formatCurrency(acct.balance, acct.currency)}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => startEdit(acct)}
                        className="text-xs text-stone hover:text-fjord"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(acct)}
                        className="text-xs text-stone hover:text-ember"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}

      <p className="text-right text-xs text-stone">
        {accounts.length} account{accounts.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
