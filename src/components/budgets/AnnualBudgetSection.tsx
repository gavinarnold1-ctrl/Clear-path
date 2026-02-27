import AnnualBudgetRow from './AnnualBudgetRow'

interface AnnualExpense {
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
  category: { name: string; icon: string | null } | null
  annualExpense: AnnualExpense | null
}

interface Props {
  budgets: AnnualBudget[]
}

export default function AnnualBudgetSection({ budgets }: Props) {
  // Only show budgets that have an annual expense linked
  const withExpense = budgets.filter((b) => b.annualExpense !== null)
  if (withExpense.length === 0) return null

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-fjord">Annual</h2>
        <p className="text-sm text-stone">Irregular expenses you plan and save for over time</p>
      </div>
      <div className="card divide-y divide-mist">
        {withExpense.map((budget) => (
          <AnnualBudgetRow
            key={budget.id}
            name={budget.name}
            categoryId={budget.categoryId}
            category={budget.category}
            annualExpense={budget.annualExpense!}
          />
        ))}
      </div>
    </section>
  )
}
