import Link from 'next/link'

interface Props {
  count: number
}

export default function UncategorizedReviewBanner({ count }: Props) {
  if (count === 0) return null

  const currentMonth = (() => {
    const now = new Date()
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  })()

  return (
    <div className="mb-6 flex items-center justify-between rounded-card border border-birch/40 bg-birch/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-birch/20 text-sm">
          ❓
        </span>
        <div>
          <p className="text-sm font-medium text-fjord">
            {count} uncategorized transaction{count !== 1 ? 's' : ''} this month
          </p>
          <p className="text-xs text-stone">
            Categorize them so budgets track accurately — the app will learn for next time
          </p>
        </div>
      </div>
      <Link
        href={`/transactions?uncategorized=true&month=${currentMonth}`}
        className="whitespace-nowrap rounded-button bg-birch/30 px-3 py-1.5 text-xs font-medium text-fjord hover:bg-birch/50"
      >
        Review
      </Link>
    </div>
  )
}
