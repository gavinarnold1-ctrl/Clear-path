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

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
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
          <span className="font-mono font-medium text-ember">{formatCurrency(totalUnbudgeted)}</span> total
        </p>
      </div>
      <div className="card divide-y divide-mist">
        {categories.map((cat) => (
          <div key={cat.categoryId} className="flex items-center justify-between px-4 py-3">
            <Link
              href={`/transactions?categoryId=${cat.categoryId}&month=${getCurrentMonth()}`}
              className="flex items-center gap-3 hover:text-midnight"
            >
              <span className="font-medium text-fjord">{cat.categoryName}</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href={`/transactions?categoryId=${cat.categoryId}&month=${getCurrentMonth()}`}
                className="text-sm font-semibold text-ember hover:underline"
              >
                <span className="font-mono">{formatCurrency(cat.spent)}</span>
              </Link>
              <Link
                href={`/budgets/new?categoryId=${cat.categoryId}&tier=FLEXIBLE`}
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
