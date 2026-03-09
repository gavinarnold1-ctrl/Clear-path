'use client'

import { useEffect, useState } from 'react'

interface BudgetOption {
  id: string
  name: string
  tier: string
  categoryId: string | null
}

interface AnnualOption {
  id: string
  name: string
}

interface Props {
  budgetId: string | null
  annualExpenseId: string | null
  onChange: (budgetId: string | null, annualExpenseId: string | null) => void
  className?: string
}

export default function BudgetSelect({
  budgetId,
  annualExpenseId,
  onChange,
  className = '',
}: Props) {
  const [budgets, setBudgets] = useState<BudgetOption[]>([])
  const [annualExpenses, setAnnualExpenses] = useState<AnnualOption[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [budgetRes, annualRes] = await Promise.all([
          fetch('/api/budgets'),
          fetch('/api/budgets/annual'),
        ])
        if (budgetRes.ok) {
          const data = await budgetRes.json()
          const items = Array.isArray(data) ? data : data.budgets ?? []
          setBudgets(items.map((b: { id: string; name: string; tier: string; categoryId: string | null }) => ({
            id: b.id,
            name: b.name,
            tier: b.tier,
            categoryId: b.categoryId,
          })))
        }
        if (annualRes.ok) {
          const data = await annualRes.json()
          const items = Array.isArray(data) ? data : data.annualExpenses ?? []
          setAnnualExpenses(items.map((ae: { id: string; name: string }) => ({
            id: ae.id,
            name: ae.name,
          })))
        }
      } catch {
        // Non-critical
      } finally {
        setLoaded(true)
      }
    }
    fetchData()
  }, [])

  // Derive current value
  let currentValue = 'auto'
  if (annualExpenseId) {
    currentValue = `annual:${annualExpenseId}`
  } else if (budgetId) {
    currentValue = `budget:${budgetId}`
  }

  function handleChange(value: string) {
    if (value === 'auto') {
      onChange(null, null)
    } else if (value.startsWith('budget:')) {
      onChange(value.replace('budget:', ''), null)
    } else if (value.startsWith('annual:')) {
      onChange(null, value.replace('annual:', ''))
    }
  }

  const fixedBudgets = budgets.filter(b => b.tier === 'FIXED')
  const flexibleBudgets = budgets.filter(b => b.tier === 'FLEXIBLE')

  if (!loaded) {
    return (
      <select disabled className={`rounded-button border border-mist bg-snow px-3 py-1.5 text-sm text-stone ${className}`}>
        <option>Loading...</option>
      </select>
    )
  }

  return (
    <select
      value={currentValue}
      onChange={(e) => handleChange(e.target.value)}
      className={`rounded-button border border-mist bg-snow px-3 py-1.5 text-sm text-fjord ${className}`}
    >
      <option value="auto">Automatic (category-based)</option>

      {fixedBudgets.length > 0 && (
        <optgroup label="Fixed Budgets">
          {fixedBudgets.map(b => (
            <option key={b.id} value={`budget:${b.id}`}>{b.name}</option>
          ))}
        </optgroup>
      )}

      {flexibleBudgets.length > 0 && (
        <optgroup label="Flexible Budgets">
          {flexibleBudgets.map(b => (
            <option key={b.id} value={`budget:${b.id}`}>{b.name}</option>
          ))}
        </optgroup>
      )}

      {annualExpenses.length > 0 && (
        <optgroup label="Annual Plan Items">
          {annualExpenses.map(ae => (
            <option key={ae.id} value={`annual:${ae.id}`}>{ae.name}</option>
          ))}
        </optgroup>
      )}
    </select>
  )
}
