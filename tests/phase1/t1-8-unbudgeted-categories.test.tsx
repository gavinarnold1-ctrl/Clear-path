import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

// Mock next/link before importing the component
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => {
    const React = require('react')
    return React.createElement('a', { href, ...props }, children)
  },
}))

// Mock @/lib/utils to provide formatCurrency
vi.mock('@/lib/utils', () => ({
  formatCurrency: (amount: number) => {
    const abs = Math.abs(amount)
    const formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return amount < 0 ? `-$${formatted}` : `$${formatted}`
  },
  cn: (...classes: (string | undefined | false)[]) =>
    classes.filter(Boolean).join(' '),
}))

const UNBUDGETED_SECTION_PATH = path.resolve(
  __dirname,
  '../../src/components/budgets/UnbudgetedSection.tsx'
)
const BUDGETS_PAGE_PATH = path.resolve(
  __dirname,
  '../../src/app/(dashboard)/budgets/page.tsx'
)

describe('T1.8 — Unbudgeted categories on Budgets page', () => {
  // ── 1. UnbudgetedSection component exists ─────────────────────────────────
  describe('1. UnbudgetedSection component exists', () => {
    it('file exists at src/components/budgets/UnbudgetedSection.tsx', () => {
      expect(fs.existsSync(UNBUDGETED_SECTION_PATH)).toBe(true)
    })

    it('exports UnbudgetedSection', () => {
      const source = fs.readFileSync(UNBUDGETED_SECTION_PATH, 'utf-8')
      expect(source).toMatch(
        /export\s+(default\s+)?function\s+UnbudgetedSection|export\s+\{[^}]*UnbudgetedSection/
      )
    })

    it('accepts categories prop with categoryId, categoryName, and spent', () => {
      const source = fs.readFileSync(UNBUDGETED_SECTION_PATH, 'utf-8')
      expect(source).toMatch(/categoryId/)
      expect(source).toMatch(/categoryName/)
      expect(source).toMatch(/spent/)
    })

    it('imports formatCurrency from utils', () => {
      const source = fs.readFileSync(UNBUDGETED_SECTION_PATH, 'utf-8')
      expect(source).toMatch(/formatCurrency/)
    })
  })

  // ── 2. Budgets page imports UnbudgetedSection ─────────────────────────────
  describe('2. Budgets page imports UnbudgetedSection', () => {
    it('budgets page file exists', () => {
      expect(fs.existsSync(BUDGETS_PAGE_PATH)).toBe(true)
    })

    it('imports UnbudgetedSection', () => {
      const source = fs.readFileSync(BUDGETS_PAGE_PATH, 'utf-8')
      expect(source).toMatch(/import.*UnbudgetedSection.*from/)
    })

    it('renders <UnbudgetedSection in JSX', () => {
      const source = fs.readFileSync(BUDGETS_PAGE_PATH, 'utf-8')
      expect(source).toMatch(/<UnbudgetedSection/)
    })
  })

  // ── 3. Budgets page computes unbudgetedCategories from transactions without budgets
  describe('3. Budgets page computes unbudgetedCategories', () => {
    it('references unbudgeted categories in the source', () => {
      const source = fs.readFileSync(BUDGETS_PAGE_PATH, 'utf-8')
      expect(source).toMatch(/unbudgeted/i)
    })

    it('derives categories from transactions that lack budgets', () => {
      const source = fs.readFileSync(BUDGETS_PAGE_PATH, 'utf-8')
      // The page should compare transaction categories against budget categories
      // to find unbudgeted ones
      expect(source).toMatch(/unbudgeted/i)
      expect(source).toMatch(/categor/i)
    })
  })

  // ── 4–5. Component rendering tests ───────────────────────────────────────
  describe('Component rendering', () => {
    let UnbudgetedSection: React.ComponentType<{
      categories: {
        categoryId: string
        categoryName: string
        spent: number
      }[]
    }>
    let cleanup: () => void

    beforeAll(async () => {
      const mod = await import(
        '../../src/components/budgets/UnbudgetedSection'
      )
      UnbudgetedSection = mod.default || mod.UnbudgetedSection
      const rtl = await import('@testing-library/react')
      cleanup = rtl.cleanup
    })

    afterEach(() => {
      cleanup()
    })

    // ── 4. Renders category names and spend amounts ─────────────────────────
    describe('4. Renders category names and spend amounts', () => {
      it('renders each category name', async () => {
        const { render, screen } = await import('@testing-library/react')
        const categories = [
          { categoryId: 'cat-1', categoryName: 'Groceries', spent: 350.5 },
          {
            categoryId: 'cat-2',
            categoryName: 'Entertainment',
            spent: 120.0,
          },
        ]

        render(
          // @ts-expect-error - dynamic import typing
          <UnbudgetedSection categories={categories} />
        )

        expect(screen.getByText('Groceries')).toBeDefined()
        expect(screen.getByText('Entertainment')).toBeDefined()
      })

      it('renders formatted spend amounts', async () => {
        const { render, screen } = await import('@testing-library/react')
        const categories = [
          { categoryId: 'cat-1', categoryName: 'Groceries', spent: 350.5 },
          {
            categoryId: 'cat-2',
            categoryName: 'Entertainment',
            spent: 120.0,
          },
        ]

        render(
          // @ts-expect-error - dynamic import typing
          <UnbudgetedSection categories={categories} />
        )

        // Amounts may appear in both the category row and the total summary
        expect(screen.getAllByText(/350\.50/).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/120\.00/).length).toBeGreaterThan(0)
      })
    })

    // ── 5. Shows a "Budget" link for each unbudgeted category ───────────────
    describe('5. Shows a Budget link for each unbudgeted category', () => {
      it('renders a link to /budgets/new with categoryId for each category', async () => {
        const { render, screen } = await import('@testing-library/react')
        const categories = [
          { categoryId: 'cat-1', categoryName: 'Groceries', spent: 350.5 },
          {
            categoryId: 'cat-2',
            categoryName: 'Entertainment',
            spent: 120.0,
          },
        ]

        render(
          // @ts-expect-error - dynamic import typing
          <UnbudgetedSection categories={categories} />
        )

        const links = screen.getAllByRole('link')
        const budgetLinks = links.filter((link: HTMLElement) =>
          link.getAttribute('href')?.includes('/budgets/new')
        )
        expect(budgetLinks.length).toBe(2)

        expect(budgetLinks[0].getAttribute('href')).toContain(
          'categoryId=cat-1'
        )
        expect(budgetLinks[1].getAttribute('href')).toContain(
          'categoryId=cat-2'
        )
      })

      it('renders a single category link correctly', async () => {
        const { render, screen } = await import('@testing-library/react')
        const categories = [
          {
            categoryId: 'cat-99',
            categoryName: 'Dining Out',
            spent: 87.25,
          },
        ]

        render(
          // @ts-expect-error - dynamic import typing
          <UnbudgetedSection categories={categories} />
        )

        expect(screen.getByText('Dining Out')).toBeDefined()
        // Amount may appear in both the row and the summary
        expect(screen.getAllByText(/87\.25/).length).toBeGreaterThan(0)

        const links = screen.getAllByRole('link')
        const budgetLinks = links.filter((link: HTMLElement) =>
          link.getAttribute('href')?.includes('/budgets/new')
        )
        expect(budgetLinks.length).toBe(1)
        expect(budgetLinks[0].getAttribute('href')).toContain(
          'categoryId=cat-99'
        )
      })

      it('source contains Link component referencing /budgets/new', () => {
        const source = fs.readFileSync(UNBUDGETED_SECTION_PATH, 'utf-8')
        expect(source).toMatch(/\/budgets\/new/)
        expect(source).toMatch(/categoryId/)
        expect(source).toMatch(/Link/)
      })
    })

    // ── 6. Returns null when categories list is empty ───────────────────────
    describe('6. Returns null when categories list is empty', () => {
      it('renders nothing when categories is an empty array', async () => {
        const { render } = await import('@testing-library/react')

        const { container } = render(
          // @ts-expect-error - dynamic import typing
          <UnbudgetedSection categories={[]} />
        )

        expect(container.innerHTML).toBe('')
      })

      it('source checks for empty array and returns null', () => {
        const source = fs.readFileSync(UNBUDGETED_SECTION_PATH, 'utf-8')
        expect(source).toMatch(
          /\.length\s*(===\s*0|<\s*1|==\s*0)|!categories\.length/
        )
        expect(source).toMatch(/return\s+null/)
      })
    })
  })

  // ── 7. Only expense categories appear (amount < 0) ────────────────────────
  describe('7. Only expense categories appear (computation uses amount < 0)', () => {
    it('budgets page filters for expense transactions using negative amounts', () => {
      const source = fs.readFileSync(BUDGETS_PAGE_PATH, 'utf-8')
      const usesNegativeAmounts =
        source.match(/amount.*lt.*0/) ||
        source.match(/amount\s*<\s*0/) ||
        source.match(/lt:\s*0/)
      expect(usesNegativeAmounts).toBeTruthy()
    })

    it('only renders categories that are passed (pre-filtered expenses)', async () => {
      const { render, screen } = await import('@testing-library/react')
      const mod = await import(
        '../../src/components/budgets/UnbudgetedSection'
      )
      const UnbudgetedSection = mod.default || mod.UnbudgetedSection

      const expenseCategories = [
        { categoryId: 'exp-1', categoryName: 'Groceries', spent: 320.0 },
      ]

      render(
        // @ts-expect-error - dynamic import typing
        <UnbudgetedSection categories={expenseCategories} />
      )

      // Category name and amount may each appear multiple times (row + summary)
      expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/320\.00/).length).toBeGreaterThan(0)

      // Income or transfer categories should not appear since they are not passed
      expect(screen.queryByText('Salary')).toBeNull()
      expect(screen.queryByText('Transfer')).toBeNull()
    })
  })
})
