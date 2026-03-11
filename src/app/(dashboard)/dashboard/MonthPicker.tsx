'use client'

import { useRouter, usePathname } from 'next/navigation'

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1 + delta)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthPicker({ currentMonth }: { currentMonth: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const now = new Date()
  const maxMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const nextMonth = shiftMonth(currentMonth, 1)
  const canGoNext = nextMonth <= maxMonth

  function navigate(month: string) {
    router.push(`${pathname}?month=${month}`)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => navigate(shiftMonth(currentMonth, -1))}
        className="rounded-button p-1.5 text-stone hover:bg-frost hover:text-fjord"
        aria-label="Previous month"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 12L6 8l4-4" />
        </svg>
      </button>
      <span className="min-w-[140px] text-center text-sm font-medium text-fjord">
        {formatMonthLabel(currentMonth)}
      </span>
      <button
        type="button"
        onClick={() => canGoNext && navigate(nextMonth)}
        disabled={!canGoNext}
        className="rounded-button p-1.5 text-stone hover:bg-frost hover:text-fjord disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Next month"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4l4 4-4 4" />
        </svg>
      </button>
    </div>
  )
}
