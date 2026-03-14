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

/**
 * Parse a YYYY-MM-DD date string as local noon to prevent timezone
 * off-by-one errors. `new Date('2028-07-01')` is UTC midnight, which
 * rolls back to June 30 in western timezones.
 */
export function parseLocalDate(iso: string): Date {
  if (iso.includes('T')) return new Date(iso)
  return new Date(iso + 'T12:00:00')
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
