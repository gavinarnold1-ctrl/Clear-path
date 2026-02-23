'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface FundableExpense {
  id: string
  name: string
  currentSetAside: number
  monthsRemaining: number
  funded: number
  annualAmount: number
}

interface Props {
  trueRemaining: number
  monthlyBurden: number
  expenses: FundableExpense[]
}

export default function AutoFundBanner({ trueRemaining, monthlyBurden, expenses }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const activeExpenses = expenses.filter(
    (e) => e.funded < e.annualAmount && e.monthsRemaining > 0
  )

  if (activeExpenses.length === 0) return null

  const shortfall = monthlyBurden - trueRemaining
  const canFullyFund = trueRemaining >= monthlyBurden
  const availableForAnnual = Math.max(0, trueRemaining)

  // Compute allocation: nearest due date first (smallest monthsRemaining)
  const sorted = [...activeExpenses].sort((a, b) => a.monthsRemaining - b.monthsRemaining)
  const allocations: { id: string; name: string; amount: number; needed: number }[] = []
  let remaining = availableForAnnual

  if (canFullyFund) {
    for (const exp of sorted) {
      allocations.push({ id: exp.id, name: exp.name, amount: exp.currentSetAside, needed: exp.currentSetAside })
      remaining -= exp.currentSetAside
    }
  } else {
    // Proportional allocation based on urgency (nearest due date gets priority)
    const totalNeeded = sorted.reduce((s, e) => s + e.currentSetAside, 0)
    for (const exp of sorted) {
      const proportion = totalNeeded > 0 ? exp.currentSetAside / totalNeeded : 0
      const amount = Math.min(
        Math.round(availableForAnnual * proportion * 100) / 100,
        exp.currentSetAside
      )
      allocations.push({ id: exp.id, name: exp.name, amount, needed: exp.currentSetAside })
    }
  }

  async function handleAutoFund() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/budgets/annual/auto-fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: allocations
            .filter((a) => a.amount > 0)
            .map((a) => ({ expenseId: a.id, amount: a.amount })),
        }),
      })
      if (!res.ok) throw new Error('Auto-fund failed')
      const data = await res.json()
      setResult(`Funded ${data.funded} expense${data.funded !== 1 ? 's' : ''} totalling ${formatCurrency(data.totalFunded)}`)
      router.refresh()
    } catch {
      setResult('Failed to auto-fund. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`mb-6 rounded-xl border-2 p-5 ${canFullyFund ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">
            {canFullyFund ? 'Ready to fund this month' : 'Funding shortfall'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {canFullyFund ? (
              <>
                True Remaining ({formatCurrency(trueRemaining)}) covers your monthly set-aside
                ({formatCurrency(monthlyBurden)}).
              </>
            ) : (
              <>
                You need {formatCurrency(monthlyBurden)}/mo but only have{' '}
                {formatCurrency(Math.max(0, trueRemaining))} available.{' '}
                <span className="font-medium text-amber-700">
                  {formatCurrency(shortfall)} short.
                </span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={handleAutoFund}
          disabled={loading || availableForAnnual <= 0}
          className="btn-primary shrink-0 px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? 'Funding...' : canFullyFund ? 'Auto-Fund All' : 'Fund Available'}
        </button>
      </div>

      {result && (
        <p className="mt-2 text-sm font-medium text-green-700">{result}</p>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-xs font-medium text-gray-500 hover:text-gray-700"
      >
        {expanded ? 'Hide breakdown' : 'Show allocation breakdown'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-1 border-t border-gray-200 pt-3">
          {allocations.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{a.name}</span>
              <span className="text-gray-500">
                {formatCurrency(a.amount)}
                {a.amount < a.needed && (
                  <span className="ml-1 text-xs text-amber-600">
                    (of {formatCurrency(a.needed)} needed)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
