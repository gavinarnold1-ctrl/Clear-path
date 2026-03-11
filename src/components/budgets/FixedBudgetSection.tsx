import { formatCurrency } from '@/lib/utils'
import FixedBudgetRow from './FixedBudgetRow'
import type { FixedStatus } from './FixedBudgetRow'

interface Transaction {
  id: string
  categoryId: string | null
  annualExpenseId: string | null
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
  _count?: { overrideTransactions: number }
}

function getFixedStatus(budget: FixedBudget, transactions: Transaction[]): { status: FixedStatus; matchedAmount: number } {
  // FIRST gate: exclude annual-linked transactions from the candidate pool
  const nonAnnualTxs = transactions.filter(tx => !tx.annualExpenseId)

  let bestMatch: Transaction | undefined

  if (budget.categoryId) {
    // Priority 1: exact category match (source of truth for linked budgets)
    const categoryMatches = nonAnnualTxs.filter(t => t.categoryId === budget.categoryId)
    if (categoryMatches.length > 0) {
      bestMatch = categoryMatches.reduce((best, t) =>
        Math.abs(Math.abs(t.amount) - budget.amount) < Math.abs(Math.abs(best.amount) - budget.amount)
          ? t : best
      )
    }
  }

  // Priority 2: merchant name fallback (ONLY for unlinked budgets)
  if (!bestMatch && !budget.categoryId) {
    const budgetNameLower = budget.name.toLowerCase()
    bestMatch = nonAnnualTxs.find(t => {
      const merchant = t.merchant.toLowerCase()
      return merchant.includes(budgetNameLower) || budgetNameLower.includes(merchant)
    })
  }

  // Priority 3: amount match (ONLY for unlinked budgets)
  if (!bestMatch && !budget.categoryId && nonAnnualTxs.length > 0) {
    bestMatch = nonAnnualTxs.reduce((best, t) =>
      Math.abs(Math.abs(t.amount) - budget.amount) < Math.abs(Math.abs(best.amount) - budget.amount)
        ? t : best
    )
  }

  if (!bestMatch) {
    const today = new Date().getDate()
    if (budget.dueDay && today > budget.dueDay) return { status: 'missed', matchedAmount: 0 }
    return { status: 'pending', matchedAmount: 0 }
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
  month?: string
}

export default function FixedBudgetSection({ budgets, transactions, month }: Props) {
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
              (<span className="font-mono">{formatCurrency(total)}</span>/mo &middot; {paidCount}/{budgets.length} paid)
            </span>
          </h2>
          <span className="flex items-center gap-1 text-xs text-stone transition-colors hover:text-fjord">
            <span className="group-open:hidden">Show details</span>
            <span className="hidden group-open:inline">Hide details</span>
            <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
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
                overrideCount={budget._count?.overrideTransactions}
                month={month}
              />
            )
          })}
        </div>
      </details>
    </section>
  )
}
