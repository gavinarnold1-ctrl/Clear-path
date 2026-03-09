import { formatCurrency } from '@/lib/utils'
import AnnualBudgetRow from './AnnualBudgetRow'

interface AnnualExpense {
  id: string
  annualAmount: number
  dueMonth: number
  dueYear: number
  monthlySetAside: number
  funded: number
  status: string
  isRecurring: boolean
}

interface AnnualBudget {
  id: string
  name: string
  categoryId: string | null
  resolvedCategoryId: string | null
  category: { name: string; icon: string | null } | null
  annualExpense: AnnualExpense | null
  spent: number
}

interface Props {
  budgets: AnnualBudget[]
}

export default function AnnualBudgetSection({ budgets }: Props) {
  // Only show budgets that have an annual expense linked
  const withExpense = budgets.filter((b) => b.annualExpense !== null)
  if (withExpense.length === 0) return null

  const totalMonthly = withExpense.reduce((sum, b) => sum + (b.annualExpense?.monthlySetAside ?? 0), 0)
  const totalFunded = withExpense.reduce((sum, b) => sum + (b.annualExpense?.funded ?? 0), 0)
  const totalPlanned = withExpense.reduce((sum, b) => sum + (b.annualExpense?.annualAmount ?? 0), 0)

  return (
    <section className="mb-8">
      <details className="group">
        <summary className="mb-3 flex cursor-pointer list-none items-baseline justify-between [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="text-lg font-semibold text-fjord">
              Annual{' '}
              <span className="text-sm font-normal text-stone">
                (<span className="font-mono">{formatCurrency(totalMonthly)}</span>/mo &middot; <span className="font-mono">{formatCurrency(totalFunded)}</span>/<span className="font-mono">{formatCurrency(totalPlanned)}</span> funded)
              </span>
            </h2>
            <p className="text-sm text-stone group-open:hidden">Irregular expenses you plan and save for over time</p>
          </div>
          <span className="flex items-center gap-1 text-xs text-stone transition-colors hover:text-fjord">
            <span className="group-open:hidden">Show details</span>
            <span className="hidden group-open:inline">Hide details</span>
            <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </summary>
        <p className="mb-3 text-sm text-stone">Irregular expenses you plan and save for over time</p>
        <div className="card divide-y divide-mist">
          {withExpense.map((budget) => (
            <AnnualBudgetRow
              key={budget.id}
              name={budget.name}
              categoryId={budget.resolvedCategoryId ?? budget.categoryId}
              category={budget.category}
              annualExpense={budget.annualExpense!}
              spent={budget.spent}
            />
          ))}
        </div>
      </details>
    </section>
  )
}
