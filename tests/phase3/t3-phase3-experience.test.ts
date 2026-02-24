import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

function readSrc(relativePath: string): string {
  const fullPath = path.join(root, relativePath)
  return fs.readFileSync(fullPath, 'utf-8')
}

function fileExists(relativePath: string): boolean {
  const fullPath = path.join(root, relativePath)
  return fs.existsSync(fullPath)
}

// ---------------------------------------------------------------------------
// T3.1 — Overview redesign (Step 11)
// ---------------------------------------------------------------------------
describe('T3.1 Overview redesign', () => {
  const dashboardPath = 'src/app/(dashboard)/dashboard/page.tsx'

  it('dashboard page file exists', () => {
    expect(fileExists(dashboardPath)).toBe(true)
  })

  it('dashboard page contains "True Remaining" text', () => {
    const src = readSrc(dashboardPath)
    expect(src).toMatch(/True\s*Remaining/i)
  })

  it('dashboard page computes trueRemaining from income minus fixed minus annual', () => {
    const src = readSrc(dashboardPath)
    // The computation should reference trueRemaining
    expect(src).toMatch(/trueRemaining/i)
    // Should involve income, fixed, and annual components
    expect(src).toMatch(/income/i)
    expect(src).toMatch(/fixed/i)
    expect(src).toMatch(/annual/i)
  })
})

// ---------------------------------------------------------------------------
// T3.2 — Navigation restructure (Step 12)
// ---------------------------------------------------------------------------
describe('T3.2 Navigation restructure', () => {
  const layoutPath = 'src/app/(dashboard)/layout.tsx'
  const insightsPagePath = 'src/app/(dashboard)/insights/page.tsx'

  it('layout file exists', () => {
    expect(fileExists(layoutPath)).toBe(true)
  })

  it('layout has correct nav items in expected order', () => {
    const src = readSrc(layoutPath)
    const expectedNavOrder = [
      'Overview',
      'Budgets',
      'Spending',
      'Annual',
      'Debts',
      'Transactions',
      'Monthly Review',
      'Settings',
      'Accounts',
      'Categories',
    ]

    // Verify each nav item is present
    for (const item of expectedNavOrder) {
      expect(src).toContain(item)
    }

    // Verify ordering: each item appears before the next in the source
    let lastIndex = -1
    for (const item of expectedNavOrder) {
      const idx = src.indexOf(item)
      expect(idx).toBeGreaterThan(lastIndex)
      lastIndex = idx
    }
  })

  it('layout does not contain "Insights" as a nav label (replaced by Monthly Review)', () => {
    const src = readSrc(layoutPath)
    // "Insights" should not appear as a standalone nav label
    // It may appear as part of a route path like /insights, but not as display text
    const labelPattern = />\s*Insights\s*</
    expect(labelPattern.test(src)).toBe(false)
    // Confirm "Monthly Review" is present as the replacement
    expect(src).toContain('Monthly Review')
  })

  it('/insights page redirects to /monthly-review', () => {
    expect(fileExists(insightsPagePath)).toBe(true)
    const src = readSrc(insightsPagePath)
    // Should contain redirect logic pointing to monthly-review
    expect(src).toMatch(/monthly-review/)
    expect(src).toMatch(/redirect/i)
  })
})

// ---------------------------------------------------------------------------
// T3.3 — Settings page (Step 13)
// ---------------------------------------------------------------------------
describe('T3.3 Settings page', () => {
  const settingsPagePath = 'src/app/(dashboard)/settings/page.tsx'
  const settingsClientPath = 'src/app/(dashboard)/settings/SettingsClient.tsx'

  it('settings page exists', () => {
    expect(fileExists(settingsPagePath)).toBe(true)
  })

  it('settings page or client component handles profile management', () => {
    const pageSrc = readSrc(settingsPagePath)
    const clientSrc = fileExists(settingsClientPath)
      ? readSrc(settingsClientPath)
      : ''
    const combined = pageSrc + clientSrc
    expect(combined).toMatch(/profile/i)
  })

  it('settings page or client component handles household members', () => {
    const pageSrc = readSrc(settingsPagePath)
    const clientSrc = fileExists(settingsClientPath)
      ? readSrc(settingsClientPath)
      : ''
    const combined = pageSrc + clientSrc
    expect(combined).toMatch(/household|member/i)
  })

  it('settings page or client component handles properties', () => {
    const pageSrc = readSrc(settingsPagePath)
    const clientSrc = fileExists(settingsClientPath)
      ? readSrc(settingsClientPath)
      : ''
    const combined = pageSrc + clientSrc
    expect(combined).toMatch(/propert/i)
  })

  it('settings page or client component handles export', () => {
    const pageSrc = readSrc(settingsPagePath)
    const clientSrc = fileExists(settingsClientPath)
      ? readSrc(settingsClientPath)
      : ''
    const combined = pageSrc + clientSrc
    expect(combined).toMatch(/export/i)
  })

  it('settings page or client component handles account deletion', () => {
    const pageSrc = readSrc(settingsPagePath)
    const clientSrc = fileExists(settingsClientPath)
      ? readSrc(settingsClientPath)
      : ''
    const combined = pageSrc + clientSrc
    expect(combined).toMatch(/delete/i)
  })

  it('API route exists: GET/PATCH /api/profile', () => {
    const routePath = 'src/app/api/profile/route.ts'
    expect(fileExists(routePath)).toBe(true)
    const src = readSrc(routePath)
    expect(src).toMatch(/export\s+(async\s+)?function\s+GET/)
    expect(src).toMatch(/export\s+(async\s+)?function\s+PATCH/)
  })

  it('API route exists: POST /api/profile/password', () => {
    const routePath = 'src/app/api/profile/password/route.ts'
    expect(fileExists(routePath)).toBe(true)
    const src = readSrc(routePath)
    expect(src).toMatch(/export\s+(async\s+)?function\s+POST/)
  })

  it('API route exists: POST /api/profile/delete', () => {
    const routePath = 'src/app/api/profile/delete/route.ts'
    expect(fileExists(routePath)).toBe(true)
    const src = readSrc(routePath)
    expect(src).toMatch(/export\s+(async\s+)?function\s+POST/)
  })

  it('API route exists: GET /api/transactions/export', () => {
    const routePath = 'src/app/api/transactions/export/route.ts'
    expect(fileExists(routePath)).toBe(true)
    const src = readSrc(routePath)
    expect(src).toMatch(/export\s+(async\s+)?function\s+GET/)
  })
})

// ---------------------------------------------------------------------------
// T3.4 — Spending views (Step 14)
// ---------------------------------------------------------------------------
describe('T3.4 Spending views', () => {
  const spendingPagePath = 'src/app/(dashboard)/spending/page.tsx'
  const spendingViewsPath = 'src/app/(dashboard)/spending/SpendingViews.tsx'
  const transactionListPath = 'src/components/transactions/TransactionList.tsx'

  it('spending page exists', () => {
    expect(fileExists(spendingPagePath)).toBe(true)
  })

  it('spending page has "By Person" data section', () => {
    const pageSrc = readSrc(spendingPagePath)
    const viewsSrc = fileExists(spendingViewsPath)
      ? readSrc(spendingViewsPath)
      : ''
    const combined = pageSrc + viewsSrc
    expect(combined).toMatch(/[Bb]y\s*[Pp]erson/)
  })

  it('spending page has "By Property" data section', () => {
    const pageSrc = readSrc(spendingPagePath)
    const viewsSrc = fileExists(spendingViewsPath)
      ? readSrc(spendingViewsPath)
      : ''
    const combined = pageSrc + viewsSrc
    expect(combined).toMatch(/[Bb]y\s*[Pp]roperty/)
  })

  it('SpendingViews.tsx exists and has tab options for category, person, property', () => {
    expect(fileExists(spendingViewsPath)).toBe(true)
    const src = readSrc(spendingViewsPath)
    expect(src).toMatch(/category/i)
    expect(src).toMatch(/person/i)
    expect(src).toMatch(/property/i)
  })

  it('TransactionList.tsx has property filter', () => {
    expect(fileExists(transactionListPath)).toBe(true)
    const src = readSrc(transactionListPath)
    expect(src).toMatch(/property/i)
  })
})

// ---------------------------------------------------------------------------
// T3.5 — Monthly snapshots (Step 15)
// ---------------------------------------------------------------------------
describe('T3.5 Monthly snapshots', () => {
  const schemaPath = 'prisma/schema.prisma'
  const snapshotsLibPath = 'src/lib/snapshots.ts'
  const cronRoutePath = 'src/app/api/cron/monthly-snapshot/route.ts'
  const vercelJsonPath = 'vercel.json'
  const importRoutePath = 'src/app/api/transactions/import/route.ts'

  it('MonthlySnapshot model exists in schema.prisma', () => {
    const src = readSrc(schemaPath)
    expect(src).toMatch(/model\s+MonthlySnapshot\s*\{/)
  })

  it('MonthlySnapshot has @@unique([userId, month]) constraint', () => {
    const src = readSrc(schemaPath)
    // Extract the MonthlySnapshot model block
    const modelMatch = src.match(/model\s+MonthlySnapshot\s*\{([^}]+)\}/)
    expect(modelMatch).not.toBeNull()
    const modelBody = modelMatch![1]
    expect(modelBody).toMatch(/@@unique\(\s*\[\s*userId\s*,\s*month\s*\]\s*\)/)
  })

  it('createMonthlySnapshot function exists in snapshots.ts', () => {
    expect(fileExists(snapshotsLibPath)).toBe(true)
    const src = readSrc(snapshotsLibPath)
    expect(src).toMatch(/createMonthlySnapshot/)
  })

  it('cron endpoint exists at /api/cron/monthly-snapshot', () => {
    expect(fileExists(cronRoutePath)).toBe(true)
    const src = readSrc(cronRoutePath)
    expect(src).toMatch(/export\s+(async\s+)?function\s+(GET|POST)/)
  })

  it('vercel.json has cron config for monthly snapshot', () => {
    expect(fileExists(vercelJsonPath)).toBe(true)
    const src = readSrc(vercelJsonPath)
    const config = JSON.parse(src)
    expect(config.crons).toBeDefined()
    const hasSnapshotCron = config.crons.some(
      (cron: { path: string }) =>
        cron.path && cron.path.includes('monthly-snapshot')
    )
    expect(hasSnapshotCron).toBe(true)
  })

  it('import route creates baseline snapshot for first import', () => {
    expect(fileExists(importRoutePath)).toBe(true)
    const src = readSrc(importRoutePath)
    // Should reference snapshot creation on import
    const mentionsSnapshot =
      src.includes('snapshot') || src.includes('Snapshot')
    expect(mentionsSnapshot).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T3.6 — Monthly Review trajectory (Step 16)
// ---------------------------------------------------------------------------
describe('T3.6 Monthly Review trajectory', () => {
  const monthlyReviewPath = 'src/app/(dashboard)/monthly-review/page.tsx'

  it('monthly review page exists', () => {
    expect(fileExists(monthlyReviewPath)).toBe(true)
  })

  it('monthly review page shows trajectory', () => {
    const src = readSrc(monthlyReviewPath)
    expect(src).toMatch(/trajectory/i)
  })

  it('monthly review page fetches MonthlySnapshot records', () => {
    const src = readSrc(monthlyReviewPath)
    expect(src).toMatch(/[Mm]onthly[Ss]napshot/)
  })

  it('monthly review page compares first to latest snapshot', () => {
    const src = readSrc(monthlyReviewPath)
    // Should reference comparison logic — first/earliest vs latest/current
    const hasFirst =
      /first/i.test(src) || src.includes('[0]') || /earliest/i.test(src)
    const hasLatest =
      /latest/i.test(src) || /last/i.test(src) || /current/i.test(src)
    expect(hasFirst).toBe(true)
    expect(hasLatest).toBe(true)
  })

  it('monthly review page shows person breakdown from snapshot JSON', () => {
    const src = readSrc(monthlyReviewPath)
    expect(src).toMatch(/person/i)
    expect(
      src
    ).toMatch(
      /person.*breakdown|breakdown.*person|byPerson|personBreakdown|spendingByPerson/i
    )
  })

  it('monthly review page shows property breakdown from snapshot JSON', () => {
    const src = readSrc(monthlyReviewPath)
    expect(src).toMatch(/property/i)
    expect(
      src
    ).toMatch(
      /property.*breakdown|breakdown.*property|byProperty|propertyBreakdown|spendingByProperty/i
    )
  })
})
