import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, parseLocalDate, budgetProgress, cn } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats a positive USD amount', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats a negative amount (debt)', () => {
    expect(formatCurrency(-500)).toBe('-$500.00')
  })

  it('formats large numbers with comma separators', () => {
    expect(formatCurrency(1_000_000)).toBe('$1,000,000.00')
  })

  it('respects a non-default currency code', () => {
    const result = formatCurrency(100, 'EUR')
    expect(result).toContain('100')
  })
})

describe('formatDate', () => {
  it('formats a Date object', () => {
    expect(formatDate(parseLocalDate('2026-02-21'))).toMatch(/Feb 21, 2026/)
  })

  it('accepts an ISO date string', () => {
    expect(formatDate(parseLocalDate('2026-01-01'))).toMatch(/Jan 1, 2026/)
  })

  it('accepts a full ISO datetime string', () => {
    const result = formatDate('2026-06-15T12:00:00Z')
    expect(result).toContain('2026')
  })
})

describe('budgetProgress', () => {
  it('returns 0 when total is 0 (division guard)', () => {
    expect(budgetProgress(100, 0)).toBe(0)
  })

  it('returns 0 when spent is 0', () => {
    expect(budgetProgress(0, 200)).toBe(0)
  })

  it('returns the correct percentage', () => {
    expect(budgetProgress(50, 200)).toBe(25)
  })

  it('returns 100 when exactly at limit', () => {
    expect(budgetProgress(200, 200)).toBe(100)
  })

  it('caps at 100 when over budget', () => {
    expect(budgetProgress(300, 200)).toBe(100)
  })

  it('rounds to nearest integer', () => {
    const result = budgetProgress(1, 3)
    expect(Number.isInteger(result)).toBe(true)
  })
})

describe('cn', () => {
  it('joins class names with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('filters out false', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar')
  })

  it('filters out null', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar')
  })

  it('filters out undefined', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar')
  })

  it('returns empty string when all inputs are falsy', () => {
    expect(cn(false, null, undefined)).toBe('')
  })

  it('handles a single class', () => {
    expect(cn('only')).toBe('only')
  })
})
