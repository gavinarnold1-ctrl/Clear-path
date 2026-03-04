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
                ({formatCurrency(totalMonthly)}/mo &middot; {formatCurrency(totalFunded)}/{formatCurrency(totalPlanned)} funded)
              </span>
            </h2>
            <p className="text-sm text-stone group-open:hidden">Irregular expenses you plan and save for over time</p>
          </div>
          <span className="text-xs text-stone group-open:hidden">
            Show details &darr;
          </span>
          <span className="hidden text-xs text-stone group-open:inline">
            Hide &uarr;
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
