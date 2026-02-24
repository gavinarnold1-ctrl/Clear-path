import { formatCurrency } from '@/lib/utils'
import FixedBudgetRow from './FixedBudgetRow'
import type { FixedStatus } from './FixedBudgetRow'

interface Transaction {
  categoryId: string | null
  amount: number
  category?: { id: string; name: string } | null
}

interface FixedBudget {
  id: string
  name: string
  amount: number
  spent: number
  dueDay: number | null
  isAutoPay: boolean | null
  varianceLimit: number | null
  category: { name: string; icon: string | null } | null
  categoryId: string | null
}

function getFixedStatus(budget: FixedBudget, transactions: Transaction[]): FixedStatus {
  // R1.2: Match STRICTLY by categoryId — no fuzzy/name-based matching.
  // This prevents "Mortgage Payment" from matching "Credit Card Payment" transactions.
  const matches = budget.categoryId
    ? transactions.filter((t) => t.categoryId === budget.categoryId)
    : []

  if (matches.length === 0) {
    const today = new Date().getDate()
    if (budget.dueDay && today > budget.dueDay) return 'missed'
    return 'pending'
  }

  const totalPaid = matches.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const expected = budget.amount
  const varianceLimit = budget.varianceLimit ?? expected * 0.05

  if (Math.abs(totalPaid - expected) > varianceLimit) return 'variance'
  return 'paid'
}

interface Props {
  budgets: FixedBudget[]
  transactions: Transaction[]
}

export default function FixedBudgetSection({ budgets, transactions }: Props) {
  if (budgets.length === 0) return null

  const total = budgets.reduce((sum, b) => sum + b.amount, 0)

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-fjord">
          Fixed{' '}
          <span className="text-sm font-normal text-stone">
            ({formatCurrency(total)}/mo)
          </span>
        </h2>
      </div>
      <div className="card divide-y divide-mist">
        {budgets.map((budget) => {
          const status = getFixedStatus(budget, transactions)
          return (
            <FixedBudgetRow
              key={budget.id}
              name={budget.name}
              amount={budget.amount}
              spent={budget.spent}
              dueDay={budget.dueDay}
              isAutoPay={budget.isAutoPay}
              varianceLimit={budget.varianceLimit}
              categoryId={budget.categoryId}
              category={budget.category}
              status={status}
            />
          )
        })}
      </div>
    </section>
  )
}
