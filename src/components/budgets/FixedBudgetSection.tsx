import { formatCurrency } from '@/lib/utils'
import FixedBudgetRow from './FixedBudgetRow'
import type { FixedStatus } from './FixedBudgetRow'

interface Transaction {
  id: string
  categoryId: string | null
  amount: number
  merchant: string
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

function getFixedStatus(budget: FixedBudget, transactions: Transaction[]): { status: FixedStatus; matchedAmount: number } {
  // R1.2: Match by categoryId first, then fall back to name matching
  let matches = budget.categoryId
    ? transactions.filter((t) => t.categoryId === budget.categoryId)
    : []

  // Fallback: name-based matching when no categoryId or no category matches
  if (matches.length === 0) {
    const budgetNameLower = budget.name.toLowerCase()
    matches = transactions.filter((t) => {
      const merchant = t.merchant.toLowerCase()
      return merchant.includes(budgetNameLower) || budgetNameLower.includes(merchant)
    })
  }

  if (matches.length === 0) {
    const today = new Date().getDate()
    if (budget.dueDay && today > budget.dueDay) return { status: 'missed', matchedAmount: 0 }
    return { status: 'pending', matchedAmount: 0 }
  }

  // Find the BEST matching transaction (not sum of all)
  // Priority 1: merchant name matches budget name
  const budgetNameLower = budget.name.toLowerCase()
  let bestMatch = matches.find((t) => {
    const merchant = t.merchant.toLowerCase()
    return merchant.includes(budgetNameLower) || budgetNameLower.includes(merchant)
  })

  // Priority 2: closest amount to budgeted amount
  if (!bestMatch) {
    bestMatch = matches.reduce((best, t) =>
      Math.abs(Math.abs(t.amount) - budget.amount) < Math.abs(Math.abs(best.amount) - budget.amount)
        ? t
        : best
    )
  }

  const matchedAmount = Math.abs(bestMatch.amount)
  const expected = budget.amount
  const varianceLimit = budget.varianceLimit ?? expected * 0.05

  if (Math.abs(matchedAmount - expected) > varianceLimit) return { status: 'variance', matchedAmount }
  return { status: 'paid', matchedAmount }
}

interface Props {
  budgets: FixedBudget[]
  transactions: Transaction[]
}

export default function FixedBudgetSection({ budgets, transactions }: Props) {
  if (budgets.length === 0) return null

  const total = budgets.reduce((sum, b) => sum + b.amount, 0)
  const paidCount = budgets.filter((b) => {
    const { status } = getFixedStatus(b, transactions)
    return status === 'paid'
  }).length

  return (
    <section className="mb-8">
      <details className="group">
        <summary className="mb-3 flex cursor-pointer list-none items-baseline justify-between [&::-webkit-details-marker]:hidden">
          <h2 className="text-lg font-semibold text-fjord">
            Fixed{' '}
            <span className="text-sm font-normal text-stone">
              ({formatCurrency(total)}/mo &middot; {paidCount}/{budgets.length} paid)
            </span>
          </h2>
          <span className="text-xs text-stone group-open:hidden">
            Show details &darr;
          </span>
          <span className="hidden text-xs text-stone group-open:inline">
            Hide &uarr;
          </span>
        </summary>
        <div className="card divide-y divide-mist">
          {budgets.map((budget) => {
            const { status, matchedAmount } = getFixedStatus(budget, transactions)
            return (
              <FixedBudgetRow
                key={budget.id}
                id={budget.id}
                name={budget.name}
                amount={budget.amount}
                spent={matchedAmount}
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
      </details>
    </section>
  )
}
