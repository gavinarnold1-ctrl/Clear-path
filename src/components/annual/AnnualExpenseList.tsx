'use client'

import { useState } from 'react'
import AnnualExpenseCard from './AnnualExpenseCard'

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
  budget: {
    id: string
    category: { name: string; icon: string | null } | null
  }
}

interface Props {
  active: AnnualExpenseData[]
  completed: AnnualExpenseData[]
}

export default function AnnualExpenseList({ active, completed }: Props) {
  const [showCompleted, setShowCompleted] = useState(false)

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Expenses</h2>

      {active.length === 0 && completed.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="text-sm text-gray-500">No annual expenses yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Add your first sinking fund to start planning.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {active.map((exp) => (
              <AnnualExpenseCard key={exp.id} expense={exp} />
            ))}
          </div>

          {completed.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                {showCompleted ? 'Hide' : 'Show'} completed ({completed.length})
              </button>
              {showCompleted && (
                <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {completed.map((exp) => (
                    <AnnualExpenseCard key={exp.id} expense={exp} />
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
