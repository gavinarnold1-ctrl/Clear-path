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
  // Primary: match by categoryId
  let matches = budget.categoryId
    ? transactions.filter((t) => t.categoryId === budget.categoryId)
    : []

  // Fallback: match by category name or budget name when categoryId is null or matches nothing
  if (matches.length === 0) {
    const budgetCatName = budget.category?.name?.toLowerCase()
    const budgetName = budget.name.toLowerCase()

    matches = transactions.filter((t) => {
      if (!t.category?.name) return false
      const txCatName = t.category.name.toLowerCase()
      // Exact name match to budget's linked category name
      if (budgetCatName && txCatName === budgetCatName) return true
      // Exact name match to budget name itself (e.g. budget "Mortgage" → category "Mortgage")
      if (txCatName === budgetName) return true
      // Partial match: "Mortgage Payment" contains "Mortgage"
      if (txCatName.includes(budgetName) || budgetName.includes(txCatName)) return true
      return false
    })
  }

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
