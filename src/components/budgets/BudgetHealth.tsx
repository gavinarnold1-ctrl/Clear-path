'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface Props {
  expectedIncome: number
  actualIncome: number
  expectedExpenses: number
  actualExpenses: number
  fixedPaid: number
  fixedTotal: number
  flexOnTrack: number
  flexTotal: number
  flexOverBudget: number
  monthLabel: string
  isIncomeEditable?: boolean
}

function ComparisonBar({
  label,
  expected,
  actual,
  color,
  href,
  expectedNode,
}: {
  label: string
  expected: number
  actual: number
  color: 'income' | 'expense'
  href?: string
  expectedNode?: React.ReactNode
}) {
  const maxVal = Math.max(expected, actual, 1)
  const expectedPct = (expected / maxVal) * 100
  const actualPct = (actual / maxVal) * 100
  const isOver = actual > expected && expected > 0
  const overflowPct = isOver ? ((actual - expected) / maxVal) * 100 : 0
  const normalPct = isOver ? expectedPct : actualPct

  const barColor = color === 'income' ? 'bg-pine' : 'bg-fjord'
  const onTrack = expected > 0 && actual <= expected
  const incomeOnTrack = color === 'income' && expected > 0 && actual >= expected * 0.9

  const inner = (
    <>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-fjord">{label}{href && <span className="ml-1 text-xs text-stone">&rarr;</span>}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-fjord">
            {formatCurrency(actual)}
          </span>
          {color === 'income' && incomeOnTrack && (
            <span className="text-xs font-medium text-pine">on track</span>
          )}
          {color === 'expense' && onTrack && (
            <span className="text-xs font-medium text-pine">under budget</span>
          )}
          {isOver && color === 'expense' && (
            <span className="text-xs font-medium text-ember">over budget</span>
          )}
        </div>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-bar bg-mist/50">
        <div
          className="absolute inset-y-0 left-0 rounded-bar bg-mist"
          style={{ width: `${expectedPct}%` }}
        />
        <div
          className={`absolute inset-y-0 left-0 rounded-bar ${barColor}`}
          style={{ width: `${normalPct}%` }}
        />
        {isOver && (
          <div
            className="absolute inset-y-0 rounded-bar bg-ember"
            style={{ left: `${expectedPct}%`, width: `${overflowPct}%` }}
          />
        )}
      </div>
    </>
  )

  return (
    <div>
      {href ? (
        <Link href={href} className="block rounded-lg p-2 -m-2 hover:bg-snow transition-colors">{inner}</Link>
      ) : (
        <div>{inner}</div>
      )}
      {expectedNode ?? (
        <p className="mt-1 text-xs text-stone">
          Expected: {formatCurrency(expected)}
        </p>
      )}
    </div>
  )
}

export default function BudgetHealth({
  expectedIncome,
  actualIncome,
  expectedExpenses,
  actualExpenses,
  fixedPaid,
  fixedTotal,
  flexOnTrack,
  flexTotal,
  flexOverBudget,
  monthLabel,
  isIncomeEditable = true,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(Math.round(expectedIncome)))
  const [saving, setSaving] = useState(false)

  async function saveExpectedIncome() {
    const parsed = parseFloat(editValue)
    if (isNaN(parsed) || parsed < 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedMonthlyIncome: parsed }),
      })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const incomeExpectedNode = (
    <div className="mt-1 flex items-center gap-1.5">
      {editing ? (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-stone">Expected: $</span>
          <input
            type="number"
            step="1"
            min="0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveExpectedIncome(); if (e.key === 'Escape') setEditing(false); }}
            className="w-24 rounded border border-mist bg-snow px-1.5 py-0.5 font-mono text-xs text-fjord focus:border-fjord focus:outline-none"
            autoFocus
          />
          <button
            onClick={saveExpectedIncome}
            disabled={saving}
            className="text-xs font-medium text-pine hover:text-pine/80"
          >
            {saving ? '...' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-stone hover:text-fjord"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-stone">
            Expected: {formatCurrency(expectedIncome)}
          </p>
          {isIncomeEditable && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditValue(String(Math.round(expectedIncome))); setEditing(true); }}
              className="text-[10px] font-medium text-stone hover:text-fjord"
            >
              edit
            </button>
          )}
        </div>
      )}
    </div>
  )

  const incomeMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="card mb-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone">
        Budget Health — {monthLabel}
      </h2>

      <div className="space-y-5">
        <ComparisonBar
          label="Income"
          expected={expectedIncome}
          actual={actualIncome}
          color="income"
          href={`/transactions?classification=income&month=${incomeMonth}`}
          expectedNode={incomeExpectedNode}
        />
        <ComparisonBar
          label="Expenses"
          expected={expectedExpenses}
          actual={actualExpenses}
          color="expense"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-stone">
          Fixed Bills{' '}
          <span className="font-semibold text-fjord">
            {fixedPaid}/{fixedTotal}
          </span>{' '}
          paid
        </span>
        <span className="text-stone">
          Flexible{' '}
          <span className={`font-semibold ${flexOverBudget > 0 ? 'text-ember' : 'text-pine'}`}>
            {flexOnTrack}/{flexTotal}
          </span>{' '}
          on track
          {flexOverBudget > 0 && (
            <span className="text-ember"> ({flexOverBudget} over)</span>
          )}
        </span>
      </div>
    </div>
  )
}
