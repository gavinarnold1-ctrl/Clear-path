/** Format a number as a localized currency string. */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

/** Format a Date or ISO string for display (e.g. "Feb 21, 2026"). */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

/** Return the percentage of spent vs. budgeted, capped at 100. */
export function budgetProgress(spent: number, total: number): number {
  if (total === 0) return 0
  return Math.min(Math.round((spent / total) * 100), 100)
}

/** Merge class name strings, filtering falsy values. */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
