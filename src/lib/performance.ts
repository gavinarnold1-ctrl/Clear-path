/**
 * Lightweight performance measurement utilities.
 * Uses the Performance API (marks + measures) for zero-overhead tracking.
 * Marks are no-ops in environments without `performance` (SSR).
 */

const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function'

/** Start a performance mark. Returns the mark name for convenience. */
export function markStart(name: string): string {
  if (hasPerf) performance.mark(`${name}:start`)
  return name
}

/** End a performance mark and create a measure. Returns duration in ms or null. */
export function markEnd(name: string): number | null {
  if (!hasPerf) return null
  const startMark = `${name}:start`
  const endMark = `${name}:end`
  try {
    performance.mark(endMark)
    const measure = performance.measure(name, startMark, endMark)
    // Clean up marks
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    return measure.duration
  } catch {
    return null
  }
}

/** Measure an async function's execution time. */
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  markStart(name)
  try {
    return await fn()
  } finally {
    markEnd(name)
  }
}
