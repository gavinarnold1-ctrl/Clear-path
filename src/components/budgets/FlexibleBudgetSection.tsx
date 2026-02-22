import FlexibleBudgetRow from './FlexibleBudgetRow'

interface FlexibleBudget {
  id: string
  name: string
  amount: number
  spent: number
  period: string
  category: { name: string; icon: string | null } | null
}

interface Props {
  budgets: FlexibleBudget[]
}

export default function FlexibleBudgetSection({ budgets }: Props) {
  if (budgets.length === 0) return null

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Flexible</h2>
        <p className="text-sm text-gray-500">Variable spending you control — track against a monthly limit</p>
      </div>
      <div className="card divide-y divide-gray-100">
        {budgets.map((budget) => (
          <FlexibleBudgetRow
            key={budget.id}
            name={budget.name}
            amount={budget.amount}
            spent={budget.spent}
            category={budget.category}
          />
        ))}
      </div>
    </section>
  )
}
