'use client'

import { useState } from 'react'
import AnnualExpenseCard from './AnnualExpenseCard'

interface PropertyOption {
  id: string
  name: string
  type: string
}

interface AnnualExpenseData {
  id: string
  name: string
  annualAmount: number
  dueMonth: number
  dueYear: number
  isRecurring: boolean
  monthlySetAside: number
  funded: number
  status: string
  actualCost: number | null
  actualDate: string | null
  notes: string | null
  monthsRemaining: number
  currentSetAside: number
  computedStatus: string
  linkedSpent?: number
  propertyId?: string | null
  property?: { id: string; name: string; type: string } | null
  budget: {
    id: string
    categoryId: string | null
    category: { name: string; icon: string | null } | null
  }
}

interface CategoryOption {
  id: string
  name: string
  icon: string | null
}

interface Props {
  active: AnnualExpenseData[]
  completed: AnnualExpenseData[]
  trueRemaining?: number
  monthlyBurden?: number
  categories?: CategoryOption[]
  properties?: PropertyOption[]
}

export default function AnnualExpenseList({ active, completed, trueRemaining, monthlyBurden, categories = [], properties = [] }: Props) {
  const [showCompleted, setShowCompleted] = useState(false)

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-fjord">Expenses</h2>

      {active.length === 0 && completed.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="text-sm text-stone">No annual expenses yet.</p>
          <p className="mt-1 text-xs text-stone">
            Add your first sinking fund to start planning.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {active.map((exp) => {
              // Compute per-expense affordable amount when there's a shortfall
              const affordable =
                trueRemaining !== undefined && monthlyBurden !== undefined && monthlyBurden > 0
                  ? (exp.currentSetAside / monthlyBurden) * Math.max(0, trueRemaining)
                  : undefined
              return (
                <AnnualExpenseCard
                  key={exp.id}
                  expense={exp}
                  affordableMonthly={affordable}
                  categories={categories}
                  properties={properties}
                />
              )
            })}
          </div>

          {completed.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-sm font-medium text-stone hover:text-fjord"
              >
                {showCompleted ? 'Hide' : 'Show'} completed ({completed.length})
              </button>
              {showCompleted && (
                <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {completed.map((exp) => (
                    <AnnualExpenseCard key={exp.id} expense={exp} categories={categories} properties={properties} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
