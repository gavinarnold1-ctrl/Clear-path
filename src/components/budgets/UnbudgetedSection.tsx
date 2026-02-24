import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

interface UnbudgetedCategory {
  categoryId: string
  categoryName: string
  spent: number
}

interface Props {
  categories: UnbudgetedCategory[]
}

export default function UnbudgetedSection({ categories }: Props) {
  if (categories.length === 0) return null

  const totalUnbudgeted = categories.reduce((sum, c) => sum + c.spent, 0)

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-fjord">Unbudgeted</h2>
        <p className="text-sm text-stone">
          Categories with spending this month but no budget —{' '}
          <span className="font-medium text-ember">{formatCurrency(totalUnbudgeted)}</span> total
        </p>
      </div>
      <div className="card divide-y divide-mist">
        {categories.map((cat) => (
          <div key={cat.categoryId} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="font-medium text-fjord">{cat.categoryName}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-ember">
                {formatCurrency(cat.spent)}
              </span>
              <Link
                href={`/budgets/new?categoryId=${cat.categoryId}`}
                className="text-xs font-medium text-fjord hover:text-midnight"
              >
                + Budget
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
