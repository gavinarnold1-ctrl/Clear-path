import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BudgetCard from '@/components/ui/BudgetCard'

const baseBudget = {
  id: 'b1',
  name: 'Grocery Budget',
  amount: 500,
  spent: 250,
  tier: 'flexible',
  category: { name: 'Food', color: '#22c55e' },
}

describe('BudgetCard', () => {
  it('renders the budget name', () => {
    render(<BudgetCard budget={baseBudget} />)
    expect(screen.getByText('Grocery Budget')).toBeInTheDocument()
  })

  it('renders the category name', () => {
    render(<BudgetCard budget={baseBudget} />)
    expect(screen.getByText('Food')).toBeInTheDocument()
  })

  it('renders the tier badge', () => {
    render(<BudgetCard budget={baseBudget} />)
    expect(screen.getByText('Flexible')).toBeInTheDocument()
  })

  it('renders spent amount', () => {
    render(<BudgetCard budget={baseBudget} />)
    expect(screen.getByText(/\$250\.00 spent/)).toBeInTheDocument()
  })

  it('renders remaining amount when under budget', () => {
    render(<BudgetCard budget={baseBudget} />)
    expect(screen.getByText(/\$250\.00 left/)).toBeInTheDocument()
  })

  it('renders "over" text and amount when over budget', () => {
    render(<BudgetCard budget={{ ...baseBudget, spent: 600 }} />)
    expect(screen.getByText(/\$100\.00 over/)).toBeInTheDocument()
  })

  it('renders the correct percentage', () => {
    render(<BudgetCard budget={baseBudget} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('shows 100% when over budget', () => {
    render(<BudgetCard budget={{ ...baseBudget, spent: 1000 }} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('renders the spending limit', () => {
    render(<BudgetCard budget={baseBudget} />)
    expect(screen.getByText(/Limit: \$500\.00/)).toBeInTheDocument()
  })

  it('renders without a category', () => {
    render(<BudgetCard budget={{ ...baseBudget, category: null }} />)
    expect(screen.getByText('Grocery Budget')).toBeInTheDocument()
    expect(screen.queryByText('Food')).not.toBeInTheDocument()
  })

  it('renders a progressbar element', () => {
    render(<BudgetCard budget={baseBudget} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders all tier labels correctly', () => {
    const tiers = ['fixed', 'flexible', 'annual']
    const labels = ['Fixed', 'Flexible', 'Annual']
    tiers.forEach((tier, i) => {
      const { unmount } = render(<BudgetCard budget={{ ...baseBudget, tier }} />)
      expect(screen.getByText(labels[i])).toBeInTheDocument()
      unmount()
    })
  })
})
