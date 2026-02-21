import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, budgetProgress, cn } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats a positive USD amount', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })
  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })
})

describe('formatDate', () => {
  it('formats a Date object', () => {
    expect(formatDate(new Date('2026-02-21'))).toMatch(/Feb 2(0|1), 2026/)
  })
  it('accepts an ISO string', () => {
    expect(formatDate('2026-01-01')).toMatch(/Jan 1, 2026/)
  })
})

describe('budgetProgress', () => {
  it('returns 0 when total is 0', () => {
    expect(budgetProgress(100, 0)).toBe(0)
  })
  it('returns percentage of spent', () => {
    expect(budgetProgress(50, 200)).toBe(25)
  })
  it('caps at 100 when over budget', () => {
    expect(budgetProgress(300, 200)).toBe(100)
  })
})

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })
  it('filters falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar')
  })
})
