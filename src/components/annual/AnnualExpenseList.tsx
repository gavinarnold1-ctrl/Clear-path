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

  // Group active expenses by horizon
  const dueSoon: AnnualExpenseData[] = []   // ≤ 3 months
  const comingUp: AnnualExpenseData[] = []  // 4–12 months
  const future: AnnualExpenseData[] = []    // 12+ months

  for (const exp of active) {
    if (exp.monthsRemaining <= 3) {
      dueSoon.push(exp)
    } else if (exp.monthsRemaining <= 12) {
      comingUp.push(exp)
    } else {
      future.push(exp)
    }
  }

  const hasUnderfundedUrgent = dueSoon.some(
    (e) => e.computedStatus === 'urgent' || e.computedStatus === 'overdue' || e.computedStatus === 'behind'
  )

  function renderGroup(
    label: string,
    expenses: AnnualExpenseData[],
    accentClass: string,
    isFuture?: boolean,
  ) {
    if (expenses.length === 0) return null
    return (
      <div>
        <p className={`mb-2 text-xs font-semibold ${accentClass}`}>
          {label} &middot; {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
        </p>
        <div className={`grid grid-cols-1 gap-4 lg:grid-cols-2 ${isFuture ? 'opacity-85' : ''}`}>
          {expenses.map((exp) => {
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
      </div>
    )
  }

  return (
    <div className="mb-8">
      <h2 className="mb-3 font-display text-lg font-semibold text-fjord">Expenses</h2>

      {active.length === 0 && completed.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="text-sm text-stone">No annual expenses yet.</p>
          <p className="mt-1 text-xs text-stone">
            Add your first sinking fund to start planning.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {renderGroup(
              'Due soon',
              dueSoon,
              hasUnderfundedUrgent ? 'text-ember' : 'text-stone',
            )}
            {renderGroup('Coming up', comingUp, 'text-stone')}
            {renderGroup('Future', future, 'text-stone', true)}
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
