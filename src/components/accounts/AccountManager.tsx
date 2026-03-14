'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { formatCurrency, normalizeAccountName } from '@/lib/utils'
import { usePlaidLink } from 'react-plaid-link'

interface HouseholdMemberOption {
  id: string
  name: string
}

interface AccountRow {
  id: string
  name: string
  type: string
  balance: number
  startingBalance: number
  balanceAsOfDate: string | null
  currency: string
  institution: string | null
  isManual: boolean
  plaidLastSynced: string | null
  balanceSource: string
  lastReconciled: string | null
  reconciliationDiscrepancy: number | null
  ownerId: string | null
  ownerName: string | null
  txCount: number
}

interface Props {
  accounts: AccountRow[]
  householdMembers: HouseholdMemberOption[]
  propertyEquity?: number
  linkedAccountIds?: string[]
  isDemo?: boolean
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

const TYPE_ACCENT: Record<string, string> = {
  CHECKING: 'border-l-fjord',
  SAVINGS: 'border-l-pine',
  CREDIT_CARD: 'border-l-ember',
  INVESTMENT: 'border-l-birch',
  CASH: 'border-l-stone',
  MORTGAGE: 'border-l-ember',
  AUTO_LOAN: 'border-l-ember',
  STUDENT_LOAN: 'border-l-ember',
}

function formatSyncTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function getSyncHoursStale(isoString: string): number {
  return (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60)
}

function BalanceSourceBadge({ account }: { account: AccountRow }) {
  if (!account.isManual && account.plaidLastSynced) {
    return (
      <span className="text-[10px] text-stone">
        Plaid &middot; {formatSyncTime(account.plaidLastSynced)}
      </span>
    )
  }
  if (account.isManual && account.startingBalance !== 0 && account.balanceAsOfDate) {
    return (
      <span className="text-[10px] text-stone">
        Computed &middot; {account.txCount} txns
      </span>
    )
  }
  if (account.isManual && account.txCount > 0 && account.startingBalance === 0 && !account.balanceAsOfDate) {
    return (
      <span className="text-[10px] text-ember">
        Set starting balance
      </span>
    )
  }
  return (
    <span className="text-[10px] text-stone">Manual</span>
  )
}

function ReconciliationStatus({ account }: { account: AccountRow }) {
  if (!account.lastReconciled) return null
  if (account.reconciliationDiscrepancy === null) return null
  const disc = account.reconciliationDiscrepancy
  if (Math.abs(disc) <= 0.01) {
    return <span className="text-[10px] text-pine">Matched</span>
  }
  return (
    <span className="text-[10px] text-ember">
      {formatCurrency(Math.abs(disc))} discrepancy
    </span>
  )
}

export default function AccountManager({ accounts: initial, householdMembers, propertyEquity = 0, linkedAccountIds = [], isDemo = false }: Props) {
  const router = useRouter()
  const [accounts, setAccounts] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editStartingBalance, setEditStartingBalance] = useState('')
  const [editBalanceAsOfDate, setEditBalanceAsOfDate] = useState('')
  const [editInstitution, setEditInstitution] = useState('')
  const [editOwnerId, setEditOwnerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AccountRow | null>(null)

  // Plaid Link state
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [plaidLoading, setPlaidLoading] = useState(false)
  const [plaidMessage, setPlaidMessage] = useState<string | null>(null)
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [showPostConnect, setShowPostConnect] = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && nameRef.current) nameRef.current.focus()
  }, [editingId])

  // Fetch link token when Connect Bank is clicked
  async function fetchLinkToken() {
    setPlaidLoading(true)
    setPlaidMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/plaid/create-link-token', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create link token')
      const data = await res.json()
      setLinkToken(data.link_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bank connection')
      setPlaidLoading(false)
    }
  }

  const onPlaidSuccess = useCallback(async (publicToken: string) => {
    setPlaidLoading(true)
    setPlaidMessage('Connecting accounts...')
    try {
      const exchangeRes = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken }),
      })
      if (!exchangeRes.ok) throw new Error('Failed to connect bank')
      const exchangeData = await exchangeRes.json()
      const accountCount = exchangeData.accounts?.length ?? 0

      setPlaidMessage('Syncing transactions...')
      const syncRes = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: exchangeData.itemId }),
      })
      const syncData = syncRes.ok ? await syncRes.json() : { added: 0 }
      let totalAdded = syncData.added ?? 0

      // Second sync pass to pick up historical transactions Plaid may still be processing
      setPlaidMessage(`Imported ${totalAdded} transactions, checking for more...`)
      await new Promise(r => setTimeout(r, 2000))
      const sync2Res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: exchangeData.itemId }),
      })
      if (sync2Res.ok) {
        const sync2Data = await sync2Res.json()
        totalAdded += sync2Data.added ?? 0
      }

      setPlaidMessage(
        `Connected ${accountCount} account${accountCount !== 1 ? 's' : ''}, imported ${totalAdded} transaction${totalAdded !== 1 ? 's' : ''}`
      )
      // Immediately add new accounts to local state so they appear without waiting for router.refresh()
      if (exchangeData.accounts && Array.isArray(exchangeData.accounts)) {
        setAccounts((prev) => {
          const existingIds = new Set(prev.map((a) => a.id))
          const newAccounts: AccountRow[] = exchangeData.accounts
            .filter((a: { id: string }) => !existingIds.has(a.id))
            .map((a: { id: string; name: string; type: string; balance: number; institution: string | null }) => ({
              id: a.id,
              name: a.name,
              type: a.type,
              balance: a.balance,
              startingBalance: a.balance,
              balanceAsOfDate: null,
              currency: 'USD',
              institution: a.institution,
              isManual: false,
              plaidLastSynced: new Date().toISOString(),
              balanceSource: 'plaid',
              lastReconciled: null,
              reconciliationDiscrepancy: null,
              ownerId: null,
              ownerName: null,
              txCount: syncData.added ?? 0,
            }))
          return [...prev, ...newAccounts]
        })
      }
      setShowPostConnect(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect bank')
    } finally {
      setPlaidLoading(false)
      setLinkToken(null)
    }
  }, [router])

  const onPlaidExit = useCallback(() => {
    setPlaidLoading(false)
    setLinkToken(null)
  }, [])

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  })

  // Auto-open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && plaidReady) {
      openPlaidLink()
    }
  }, [linkToken, plaidReady, openPlaidLink])

  // Plaid CDN timeout — if link token received but CDN never loads, show error
  useEffect(() => {
    if (linkToken && !plaidReady) {
      const timeout = setTimeout(() => {
        if (!plaidReady) {
          setError('Unable to load bank connection. Please try again later.')
          setPlaidLoading(false)
          setLinkToken(null)
        }
      }, 15000)
      return () => clearTimeout(timeout)
    }
  }, [linkToken, plaidReady])

  async function syncAccount(accountId: string) {
    setSyncingAccountId(accountId)
    setError(null)
    try {
      const res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      if (!res.ok) throw new Error('Sync failed')
      const data = await res.json()
      if (data.balancesFailed > 0) {
        const reason = data.balanceFailureReason ? ` (${data.balanceFailureReason})` : ''
        setPlaidMessage(`Synced transactions (+${data.added}), but balance update failed${reason}. Try again in a few minutes.`)
      } else {
        setPlaidMessage(`Synced: +${data.added} added, ${data.modified} modified, balances updated`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncingAccountId(null)
    }
  }

  async function handleSyncAll() {
    const hasPlaid = accounts.some(a => !a.isManual && a.plaidLastSynced)
    if (syncingAll || !hasPlaid) return
    setSyncingAll(true)
    setError(null)
    try {
      const res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Sync failed')
      const data = await res.json()
      if (data.balancesFailed > 0) {
        setPlaidMessage(`Synced all accounts (+${data.added} transactions), but ${data.balancesFailed} balance update(s) failed.`)
      } else {
        setPlaidMessage(`Synced all accounts: +${data.added} added, ${data.modified} modified, balances updated`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncingAll(false)
    }
  }

  function startEdit(acct: AccountRow) {
    setEditingId(acct.id)
    setEditName(acct.name)
    setEditType(acct.type)
    setEditStartingBalance(String(acct.startingBalance))
    setEditBalanceAsOfDate(acct.balanceAsOfDate ?? '')
    setEditInstitution(acct.institution ?? '')
    setEditOwnerId(acct.ownerId ?? '')
    setError(null)
  }

  async function saveEdit() {
    if (!editingId || saving) return
    const name = editName.trim()
    if (!name) { setError('Name is required.'); return }

    setSaving(true)
    setError(null)

    const prev = accounts
    const startingBalance = parseFloat(editStartingBalance) || 0
    const ownerMatch = householdMembers.find(m => m.id === editOwnerId)
    setAccounts(accts =>
      accts.map(a => a.id === editingId ? {
        ...a,
        name,
        type: editType,
        startingBalance,
        balanceAsOfDate: editBalanceAsOfDate || null,
        institution: editInstitution.trim() || null,
        ownerId: editOwnerId || null,
        ownerName: ownerMatch?.name ?? null,
      } : a)
    )
    setEditingId(null)

    try {
      const res = await fetch(`/api/accounts/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: editType,
          startingBalance: String(startingBalance),
          balanceAsOfDate: editBalanceAsOfDate || null,
          institution: editInstitution.trim(),
          ownerId: editOwnerId || '',
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      // Update local state with server-computed values (especially balance)
      const updated = await res.json()
      if (updated.balance !== undefined) {
        setAccounts(accts =>
          accts.map(a => a.id === editingId ? { ...a, balance: updated.balance } : a)
        )
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

  const [reconciling, setReconciling] = useState(false)
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null)

  async function handleReconcileAll() {
    if (reconciling) return
    setReconciling(true)
    setReconcileMessage(null)
    try {
      const res = await fetch('/api/accounts/reconcile', { method: 'POST' })
      if (!res.ok) throw new Error('Reconciliation failed')
      const data = await res.json()
      setReconcileMessage(
        `Reconciled ${data.summary.total} accounts: ${data.summary.matched} matched, ${data.summary.discrepancies} with discrepancies`
      )
      // Update local state with reconciliation results
      setAccounts(accts => accts.map(a => {
        const result = data.results.find((r: { accountId: string }) => r.accountId === a.id)
        if (!result) return a
        return {
          ...a,
          lastReconciled: new Date().toISOString(),
          reconciliationDiscrepancy: result.discrepancy,
        }
      }))
      router.refresh()
    } catch {
      setReconcileMessage('Reconciliation failed — please try again')
    } finally {
      setReconciling(false)
    }
  }

  // Accounts needing starting balance setup
  const needsStartingBalance = accounts.filter(
    a => a.isManual && a.txCount > 0 && a.startingBalance === 0 && !a.balanceAsOfDate
  )

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
  // Skip accounts linked to properties with values to avoid double-counting.
  const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])
  const linkedSet = new Set(linkedAccountIds)
  const accountBalance = accounts.reduce((sum, a) => {
    if (linkedSet.has(a.id)) return sum // Handled in property equity
    if (LIABILITY_TYPES.has(a.type)) return sum - Math.abs(a.balance)
    return sum + a.balance
  }, 0)
  const totalBalance = accountBalance + propertyEquity

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-ember/30 bg-ember/10 px-4 py-2 text-sm text-ember">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">dismiss</button>
        </div>
      )}

      {plaidMessage && (
        <div className="mb-4 rounded-lg border border-pine/30 bg-pine/10 px-4 py-3 text-sm text-pine">
          <p>{plaidMessage}</p>
          {showPostConnect && (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => { setPlaidMessage(null); setShowPostConnect(false); fetchLinkToken() }}
                className="rounded-button bg-fjord px-4 py-1.5 text-sm font-medium text-snow hover:bg-midnight"
              >
                Add Another Bank
              </button>
              <button
                onClick={() => { setPlaidMessage(null); setShowPostConnect(false) }}
                className="text-sm text-stone hover:text-fjord"
              >
                Done
              </button>
            </div>
          )}
          {!showPostConnect && (
            <button onClick={() => setPlaidMessage(null)} className="mt-1 font-medium underline">dismiss</button>
          )}
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
              <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
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
        <p className={`font-mono text-3xl font-bold ${totalBalance >= 0 ? 'text-midnight' : 'text-expense'}`}>
          {formatCurrency(totalBalance)}
        </p>
        {propertyEquity > 0 && (
          <p className="mt-1 text-xs text-stone">
            Accounts: {formatCurrency(accountBalance)} · Property Equity: {formatCurrency(propertyEquity)}
          </p>
        )}
      </div>

      {/* Starting balance banner for CSV accounts */}
      {needsStartingBalance.length > 0 && (
        <div className="mb-4 rounded-lg border border-birch/30 bg-birch/10 px-4 py-3">
          <p className="text-sm font-medium text-fjord">
            Set starting balances for accurate tracking
          </p>
          <p className="mt-0.5 text-xs text-stone">
            {needsStartingBalance.length} account{needsStartingBalance.length !== 1 ? 's' : ''} ha{needsStartingBalance.length !== 1 ? 've' : 's'} transactions
            but no starting balance. Click Edit to set a balance as-of date.
          </p>
        </div>
      )}

      {reconcileMessage && (
        <div className="mb-4 rounded-lg border border-pine/30 bg-pine/10 px-4 py-2 text-sm text-pine">
          {reconcileMessage}
          <button onClick={() => setReconcileMessage(null)} className="ml-2 font-medium underline">dismiss</button>
        </div>
      )}

      {/* Connect Bank + Reconcile buttons */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          onClick={fetchLinkToken}
          loading={plaidLoading}
          loadingText="Connecting..."
        >
          Connect Bank
        </Button>
        {accounts.some(a => !a.isManual) && (
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="rounded-button border border-mist px-4 py-2 text-sm font-medium text-fjord transition-colors hover:bg-frost disabled:opacity-50"
          >
            {syncingAll ? 'Syncing…' : 'Sync All'}
          </button>
        )}
        {accounts.length > 0 && (
          <button
            onClick={handleReconcileAll}
            disabled={reconciling}
            className="rounded-button border border-mist px-4 py-2 text-sm font-medium text-fjord transition-colors hover:bg-frost disabled:opacity-50"
          >
            {reconciling ? 'Reconciling…' : 'Reconcile All'}
          </button>
        )}
      </div>

      {/* Grouped accounts */}
      {activeGroups.map(group => (
        <div key={group} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-stone">{group}</h2>
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
                    {acct.isManual && (
                      <>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-stone">Starting balance</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editStartingBalance}
                            onChange={e => setEditStartingBalance(e.target.value)}
                            className="input text-sm"
                            onKeyDown={e => e.key === 'Enter' && saveEdit()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-stone">Balance as of date</label>
                          <input
                            type="date"
                            value={editBalanceAsOfDate}
                            onChange={e => setEditBalanceAsOfDate(e.target.value)}
                            className="input text-sm"
                          />
                          <p className="mt-0.5 text-[10px] text-stone">Transactions after this date adjust balance</p>
                        </div>
                      </>
                    )}
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
                    {householdMembers.length > 0 && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-stone">Owner</label>
                        <select value={editOwnerId} onChange={e => setEditOwnerId(e.target.value)} className="input text-sm">
                          <option value="">No owner</option>
                          {householdMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
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
                <div key={acct.id} className={`card border-l-4 ${TYPE_ACCENT[acct.type] ?? 'border-l-mist'}`}>
                  {/* Mobile: stacked layout */}
                  <div className="md:hidden">
                    <Link href={`/transactions?accountId=${acct.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-fjord">{normalizeAccountName(acct.name)}</p>
                            {!acct.isManual ? (
                              <span className="rounded-badge bg-pine/10 px-1.5 py-0.5 text-[10px] font-medium text-pine">Connected</span>
                            ) : (
                              <span className="rounded-badge bg-mist px-1.5 py-0.5 text-[10px] font-medium text-stone">Manual</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-stone">
                            {TYPE_LABELS[acct.type] ?? acct.type}
                            {acct.institution && <span> &middot; {acct.institution}</span>}
                            {acct.ownerName && <span> &middot; {acct.ownerName}</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-mono text-lg font-bold ${acct.balance >= 0 ? 'text-fjord' : 'text-expense'}`}>
                            {formatCurrency(acct.balance, acct.currency)}
                          </p>
                          <BalanceSourceBadge account={acct} />
                        </div>
                      </div>
                    </Link>
                    <div className="mt-2 flex items-center justify-between border-t border-mist pt-2">
                      <span className="text-xs text-stone">{acct.txCount} txn{acct.txCount !== 1 ? 's' : ''}
                        {!acct.isManual && acct.plaidLastSynced && (
                          <span className={getSyncHoursStale(acct.plaidLastSynced) > 24 ? 'font-medium text-ember' : ''}>
                            {' '}&middot; {getSyncHoursStale(acct.plaidLastSynced) > 24 ? '⚠ ' : ''}Synced {formatSyncTime(acct.plaidLastSynced)}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        {!acct.isManual && (
                          <button
                            onClick={(e) => { e.stopPropagation(); syncAccount(acct.id) }}
                            disabled={syncingAccountId === acct.id}
                            className="text-xs text-pine hover:text-pine/80 disabled:opacity-50"
                          >
                            {syncingAccountId === acct.id ? 'Syncing...' : 'Sync'}
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); startEdit(acct) }} className="text-xs text-stone hover:text-fjord">Edit</button>
                        {!isDemo && (
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(acct) }} className="text-xs text-stone hover:text-ember">Delete</button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Desktop: horizontal layout */}
                  <div className="hidden md:flex md:items-center md:justify-between">
                    <Link href={`/transactions?accountId=${acct.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-fjord">{normalizeAccountName(acct.name)}</p>
                        {!acct.isManual ? (
                          <span className="rounded-badge bg-pine/10 px-1.5 py-0.5 text-[10px] font-medium text-pine">Connected</span>
                        ) : (
                          <span className="rounded-badge bg-mist px-1.5 py-0.5 text-[10px] font-medium text-stone">Manual</span>
                        )}
                      </div>
                      <p className="text-xs text-stone">
                        {TYPE_LABELS[acct.type] ?? acct.type}
                        {acct.institution && <span> &middot; {acct.institution}</span>}
                        {acct.ownerName && <span> &middot; {acct.ownerName}</span>}
                        {' '}&middot; {acct.txCount} txn{acct.txCount !== 1 ? 's' : ''}
                        {!acct.isManual && acct.plaidLastSynced && (
                          <span className={getSyncHoursStale(acct.plaidLastSynced) > 24 ? 'font-medium text-ember' : ''}>
                            {' '}&middot; {getSyncHoursStale(acct.plaidLastSynced) > 24 ? '⚠ ' : ''}Synced {formatSyncTime(acct.plaidLastSynced)}
                          </span>
                        )}
                      </p>
                    </Link>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-mono text-xl font-bold ${acct.balance >= 0 ? 'text-fjord' : 'text-expense'}`}>
                          {formatCurrency(acct.balance, acct.currency)}
                        </p>
                        <BalanceSourceBadge account={acct} />
                      </div>
                      <div className="flex items-center gap-3">
                        {!acct.isManual && (
                          <button
                            onClick={() => syncAccount(acct.id)}
                            disabled={syncingAccountId === acct.id}
                            className="text-xs text-pine hover:text-pine/80 disabled:opacity-50"
                          >
                            {syncingAccountId === acct.id ? 'Syncing...' : 'Sync Now'}
                          </button>
                        )}
                        <button onClick={() => startEdit(acct)} className="text-xs text-stone hover:text-fjord">Edit</button>
                        {!isDemo && (
                          <button onClick={() => setDeleteTarget(acct)} className="text-xs text-stone hover:text-ember">Delete</button>
                        )}
                      </div>
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
