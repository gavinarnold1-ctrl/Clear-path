/**
 * T2.3 — Debts page (Phase 2, Step 7)
 *
 * Verifies that:
 * 1. Debt model exists with all PRD-specified fields
 * 2. DebtType enum has correct values
 * 3. Debt has optional relations to Property and Category
 * 4. API routes for debts CRUD work correctly
 * 5. Computed values (P&I breakdown, months remaining) are correct
 * 6. Debts page and DebtManager component render correctly
 * 7. Nav includes Debts, middleware protects /debts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ─── T2.3.1: Schema verification ──────────────────────────────────────────────

describe('T2.3 — Schema: Debt model and DebtType enum', () => {
  const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma')
  const schema = fs.readFileSync(schemaPath, 'utf-8')

  it('DebtType enum exists with all 6 values', () => {
    const enumMatch = schema.match(/enum DebtType \{[\s\S]*?\}/)
    expect(enumMatch).not.toBeNull()

    const enumBody = enumMatch![0]
    expect(enumBody).toMatch(/MORTGAGE/)
    expect(enumBody).toMatch(/STUDENT_LOAN/)
    expect(enumBody).toMatch(/AUTO/)
    expect(enumBody).toMatch(/CREDIT_CARD/)
    expect(enumBody).toMatch(/PERSONAL_LOAN/)
    expect(enumBody).toMatch(/OTHER/)
  })

  it('Debt model exists with all required fields', () => {
    const modelMatch = schema.match(/model Debt \{[\s\S]*?\n\}/)
    expect(modelMatch).not.toBeNull()

    const model = modelMatch![0]
    expect(model).toMatch(/id\s+String\s+@id/)
    expect(model).toMatch(/userId\s+String/)
    expect(model).toMatch(/name\s+String/)
    expect(model).toMatch(/type\s+DebtType/)
    expect(model).toMatch(/currentBalance\s+Float/)
    expect(model).toMatch(/originalBalance\s+Float\?/)
    expect(model).toMatch(/interestRate\s+Float/)
    expect(model).toMatch(/minimumPayment\s+Float/)
    expect(model).toMatch(/paymentDay\s+Int\?/)
    expect(model).toMatch(/termMonths\s+Int\?/)
    expect(model).toMatch(/startDate\s+DateTime\?/)
    expect(model).toMatch(/createdAt\s+DateTime/)
    expect(model).toMatch(/updatedAt\s+DateTime/)
  })

  it('Debt has optional relation to Property', () => {
    const modelMatch = schema.match(/model Debt \{[\s\S]*?\n\}/)
    const model = modelMatch![0]
    expect(model).toMatch(/propertyId\s+String\?/)
    expect(model).toMatch(/property\s+Property\?/)
  })

  it('Debt has optional relation to Category', () => {
    const modelMatch = schema.match(/model Debt \{[\s\S]*?\n\}/)
    const model = modelMatch![0]
    expect(model).toMatch(/categoryId\s+String\?/)
    expect(model).toMatch(/category\s+Category\?/)
  })

  it('Debt has @@index on userId', () => {
    const modelMatch = schema.match(/model Debt \{[\s\S]*?\n\}/)
    expect(modelMatch![0]).toMatch(/@@index\(\[userId\]\)/)
  })

  it('User model has debts relation', () => {
    const userModelMatch = schema.match(/model User \{[\s\S]*?\n\}/)
    expect(userModelMatch).not.toBeNull()
    expect(userModelMatch![0]).toMatch(/debts\s+Debt\[\]/)
  })

  it('Category model has debts relation', () => {
    const catModelMatch = schema.match(/model Category \{[\s\S]*?\n\}/)
    expect(catModelMatch).not.toBeNull()
    expect(catModelMatch![0]).toMatch(/debts\s+Debt\[\]/)
  })
})

// ─── T2.3.2: Types verification ──────────────────────────────────────────────

describe('T2.3 — Types: Debt interface and DebtType', () => {
  const typesPath = path.resolve(__dirname, '../../src/types/index.ts')
  const types = fs.readFileSync(typesPath, 'utf-8')

  it('DebtType type exists with all values', () => {
    expect(types).toMatch(/export\s+type\s+DebtType/)
    expect(types).toMatch(/MORTGAGE/)
    expect(types).toMatch(/STUDENT_LOAN/)
    expect(types).toMatch(/AUTO/)
    expect(types).toMatch(/CREDIT_CARD/)
    expect(types).toMatch(/PERSONAL_LOAN/)
    expect(types).toMatch(/OTHER/)
  })

  it('Debt interface exists with all required properties', () => {
    const interfaceMatch = types.match(/export\s+interface\s+Debt\s*\{[\s\S]*?\}/)
    expect(interfaceMatch).not.toBeNull()

    const iface = interfaceMatch![0]
    expect(iface).toMatch(/id:\s*string/)
    expect(iface).toMatch(/userId:\s*string/)
    expect(iface).toMatch(/name:\s*string/)
    expect(iface).toMatch(/type:\s*DebtType/)
    expect(iface).toMatch(/currentBalance:\s*number/)
    expect(iface).toMatch(/originalBalance:\s*number\s*\|\s*null/)
    expect(iface).toMatch(/interestRate:\s*number/)
    expect(iface).toMatch(/minimumPayment:\s*number/)
    expect(iface).toMatch(/paymentDay:\s*number\s*\|\s*null/)
    expect(iface).toMatch(/termMonths:\s*number\s*\|\s*null/)
    expect(iface).toMatch(/propertyId:\s*string\s*\|\s*null/)
    expect(iface).toMatch(/categoryId:\s*string\s*\|\s*null/)
  })
})

// ─── T2.3.3: API route source verification ───────────────────────────────────

describe('T2.3 — API: debts route source', () => {
  it('GET /api/debts scopes by userId and returns computed fields', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/debts/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/getSession\(\)/)
    expect(code).toMatch(/session\.userId/)
    expect(code).toMatch(/debt\.findMany/)

    // Computed fields are provided by piBreakdown from the amortization engine
    expect(code).toMatch(/piBreakdown/)

    // Verify the engine itself computes the expected fields
    const enginePath = path.resolve(__dirname, '../../src/lib/engines/amortization.ts')
    const engine = fs.readFileSync(enginePath, 'utf-8')
    expect(engine).toMatch(/monthlyInterest/)
    expect(engine).toMatch(/monthlyPrincipal/)
    expect(engine).toMatch(/monthsRemaining/)
    expect(engine).toMatch(/annualRate\s*\/\s*12/)
  })

  it('GET /api/debts returns summary (totalDebt, totalPayments, weightedAvgRate)', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/debts/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/totalDebt/)
    expect(code).toMatch(/totalPayments/)
    expect(code).toMatch(/weightedAvgRate|weightedRate/)
    expect(code).toMatch(/summary/)
  })

  it('POST /api/debts validates required fields', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/debts/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/Name is required/)
    expect(code).toMatch(/Invalid debt type/)
    expect(code).toMatch(/Current balance must be/)
    expect(code).toMatch(/Interest rate must be/)
    expect(code).toMatch(/Minimum payment must be/)
  })

  it('POST /api/debts validates debt type against allowed values', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/debts/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/VALID_DEBT_TYPES/)
    expect(code).toMatch(/MORTGAGE/)
    expect(code).toMatch(/STUDENT_LOAN/)
    expect(code).toMatch(/AUTO/)
    expect(code).toMatch(/CREDIT_CARD/)
    expect(code).toMatch(/PERSONAL_LOAN/)
    expect(code).toMatch(/OTHER/)
  })

  it('POST /api/debts verifies ownership of propertyId and categoryId', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/debts/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/propertyId/)
    expect(code).toMatch(/property\.findFirst/)
    expect(code).toMatch(/Property not found/)
    expect(code).toMatch(/categoryId/)
    expect(code).toMatch(/category\.findFirst/)
    expect(code).toMatch(/Category not found/)
  })
})

describe('T2.3 — API: debts/[id] route source', () => {
  it('GET returns single debt with computed fields', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/debts/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    // Computed fields delegated to piBreakdown from amortization engine
    expect(code).toMatch(/piBreakdown/)
  })

  it('PATCH validates ownership and updates debt', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/debts/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/debt\.findFirst/)
    expect(code).toMatch(/userId:\s*session\.userId/)
    expect(code).toMatch(/Not found/)
    expect(code).toMatch(/debt\.update/)
  })

  it('PATCH verifies ownership of referenced property and category', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/debts/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/property\.findFirst/)
    expect(code).toMatch(/category\.findFirst/)
  })

  it('DELETE verifies ownership then deletes', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/debts/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/debt\.findFirst/)
    expect(code).toMatch(/debt\.delete/)
    expect(code).toMatch(/status:\s*204/)
  })
})

// ─── T2.3.4: Computed values unit tests ──────────────────────────────────────

describe('T2.3 — Computed values: P&I breakdown', () => {
  it('monthly interest = currentBalance × (interestRate / 12)', () => {
    const currentBalance = 218400
    const interestRate = 0.053

    const monthlyInterest = currentBalance * (interestRate / 12)
    expect(monthlyInterest).toBeCloseTo(964.60, 0) // 218400 × 0.053/12 ≈ 964.60
  })

  it('monthly principal = minimumPayment - monthlyInterest', () => {
    const currentBalance = 218400
    const interestRate = 0.053
    const minimumPayment = 1847

    const monthlyInterest = currentBalance * (interestRate / 12)
    const monthlyPrincipal = Math.max(0, minimumPayment - monthlyInterest)
    expect(monthlyPrincipal).toBeCloseTo(882.40, 0) // 1847 - 964.60 ≈ 882.40
  })

  it('months remaining = currentBalance / monthlyPrincipal (rough estimate)', () => {
    const currentBalance = 218400
    const interestRate = 0.053
    const minimumPayment = 1847

    const monthlyInterest = currentBalance * (interestRate / 12)
    const monthlyPrincipal = Math.max(0, minimumPayment - monthlyInterest)
    const monthsRemaining = monthlyPrincipal > 0 ? Math.ceil(currentBalance / monthlyPrincipal) : null

    expect(monthsRemaining).not.toBeNull()
    expect(monthsRemaining).toBeGreaterThan(200) // ~247 months
    expect(monthsRemaining).toBeLessThan(300)
  })

  it('monthsRemaining is null when payment <= interest (no principal)', () => {
    const currentBalance = 100000
    const interestRate = 0.10 // 10%
    const minimumPayment = 500 // Less than monthly interest of ~833

    const monthlyInterest = currentBalance * (interestRate / 12)
    const monthlyPrincipal = Math.max(0, minimumPayment - monthlyInterest)

    expect(monthlyPrincipal).toBe(0)
    const monthsRemaining = monthlyPrincipal > 0 ? Math.ceil(currentBalance / monthlyPrincipal) : null
    expect(monthsRemaining).toBeNull()
  })

  it('total debt = sum of all currentBalance', () => {
    const debts = [
      { currentBalance: 218400 },
      { currentBalance: 18200 },
    ]
    const totalDebt = debts.reduce((sum, d) => sum + d.currentBalance, 0)
    expect(totalDebt).toBe(236600)
  })

  it('total payments = sum of all minimumPayment', () => {
    const debts = [
      { minimumPayment: 1847 },
      { minimumPayment: 650 },
    ]
    const totalPayments = debts.reduce((sum, d) => sum + d.minimumPayment, 0)
    expect(totalPayments).toBe(2497)
  })

  it('weighted average rate = Σ(balance × rate) / Σ(balance)', () => {
    const debts = [
      { currentBalance: 218400, interestRate: 0.053 },
      { currentBalance: 18200, interestRate: 0.05 },
    ]
    const totalDebt = debts.reduce((sum, d) => sum + d.currentBalance, 0)
    const weightedRate = debts.reduce((sum, d) => sum + d.currentBalance * d.interestRate, 0) / totalDebt

    // Weighted rate should be close to 5.3% (mortgage dominates)
    expect(weightedRate).toBeCloseTo(0.05277, 3)
  })
})

// ─── T2.3.5: Debts page source verification ─────────────────────────────────

describe('T2.3 — UI: Debts page and DebtManager', () => {
  it('/debts page.tsx fetches debts with includes and computes summary', () => {
    const pagePath = path.resolve(__dirname, '../../src/app/(dashboard)/debts/page.tsx')
    const code = fs.readFileSync(pagePath, 'utf-8')

    expect(code).toMatch(/debt\.findMany/)
    expect(code).toMatch(/include:[\s\S]*property[\s\S]*category/)
    expect(code).toMatch(/totalDebt/)
    expect(code).toMatch(/totalPayments/)
    expect(code).toMatch(/weightedRate/)
    expect(code).toMatch(/monthlyInterest/)
    expect(code).toMatch(/monthlyPrincipal/)
    expect(code).toMatch(/DebtManager/)
  })

  it('DebtManager component renders debt cards with P&I breakdown', () => {
    const componentPath = path.resolve(__dirname, '../../src/components/debts/DebtManager.tsx')
    const code = fs.readFileSync(componentPath, 'utf-8')

    expect(code).toMatch(/monthlyPrincipal/)
    expect(code).toMatch(/monthlyInterest/)
    expect(code).toMatch(/Principal/)
    expect(code).toMatch(/Interest/)
    // P&I bar
    expect(code).toMatch(/bg-pine/)
    expect(code).toMatch(/bg-ember/)
  })

  it('DebtManager shows payoff progress bar when originalBalance exists', () => {
    const componentPath = path.resolve(__dirname, '../../src/components/debts/DebtManager.tsx')
    const code = fs.readFileSync(componentPath, 'utf-8')

    expect(code).toMatch(/originalBalance/)
    expect(code).toMatch(/Payoff progress/)
  })

  it('DebtManager has add debt form with all fields', () => {
    const componentPath = path.resolve(__dirname, '../../src/components/debts/DebtManager.tsx')
    const code = fs.readFileSync(componentPath, 'utf-8')

    expect(code).toMatch(/Add Debt/)
    expect(code).toMatch(/formName/)
    expect(code).toMatch(/formType/)
    expect(code).toMatch(/formBalance/)
    expect(code).toMatch(/formRate/)
    expect(code).toMatch(/formPayment/)
    expect(code).toMatch(/formOriginalBalance/)
    expect(code).toMatch(/formPaymentDay/)
    expect(code).toMatch(/formTermMonths/)
  })

  it('DebtManager includes property and category dropdowns in form', () => {
    const componentPath = path.resolve(__dirname, '../../src/components/debts/DebtManager.tsx')
    const code = fs.readFileSync(componentPath, 'utf-8')

    expect(code).toMatch(/formPropertyId|propertyId/)
    expect(code).toMatch(/formCategoryId|categoryId/)
    expect(code).toMatch(/properties/)
    expect(code).toMatch(/categories/)
  })

  it('DebtManager has delete functionality with optimistic updates', () => {
    const componentPath = path.resolve(__dirname, '../../src/components/debts/DebtManager.tsx')
    const code = fs.readFileSync(componentPath, 'utf-8')

    expect(code).toMatch(/handleDelete/)
    expect(code).toMatch(/setDebts/)
    expect(code).toMatch(/filter/)
    // Optimistic rollback on error
    expect(code).toMatch(/setDebts\(prev\)/)
  })

  it('DebtManager shows debt type labels', () => {
    const componentPath = path.resolve(__dirname, '../../src/components/debts/DebtManager.tsx')
    const code = fs.readFileSync(componentPath, 'utf-8')

    expect(code).toMatch(/DEBT_TYPES/)
    expect(code).toMatch(/Mortgage/)
    expect(code).toMatch(/Student Loan/)
    expect(code).toMatch(/Auto Loan/)
    expect(code).toMatch(/Credit Card/)
    expect(code).toMatch(/Personal Loan/)
  })

  it('DebtManager shows estimated remaining time', () => {
    const componentPath = path.resolve(__dirname, '../../src/components/debts/DebtManager.tsx')
    const code = fs.readFileSync(componentPath, 'utf-8')

    expect(code).toMatch(/monthsRemaining/)
    expect(code).toMatch(/Est\. Remaining/)
  })
})

// ─── T2.3.6: Navigation and middleware ───────────────────────────────────────

describe('T2.3 — Nav and middleware include Debts', () => {
  it('dashboard layout includes Debts in nav', () => {
    const layoutPath = path.resolve(__dirname, '../../src/app/(dashboard)/layout.tsx')
    const code = fs.readFileSync(layoutPath, 'utf-8')

    expect(code).toMatch(/\/debts/)
    expect(code).toMatch(/Debts/)
  })

  it('middleware protects /debts route', () => {
    const middlewarePath = path.resolve(__dirname, '../../middleware.ts')
    const code = fs.readFileSync(middlewarePath, 'utf-8')

    expect(code).toMatch(/\/debts/)
  })
})

// ─── T2.3.7: Mocked API behavior ────────────────────────────────────────────

const mockDebtFindMany = vi.fn()
const mockDebtCreate = vi.fn()
const mockDebtFindFirst = vi.fn()
const mockDebtDelete = vi.fn()
const mockPropertyFindFirst = vi.fn()
const mockCategoryFindFirst = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    debt: {
      findMany: (...args: unknown[]) => mockDebtFindMany(...args),
      findFirst: (...args: unknown[]) => mockDebtFindFirst(...args),
      create: (...args: unknown[]) => mockDebtCreate(...args),
      delete: (...args: unknown[]) => mockDebtDelete(...args),
    },
    property: {
      findFirst: (...args: unknown[]) => mockPropertyFindFirst(...args),
    },
    category: {
      findFirst: (...args: unknown[]) => mockCategoryFindFirst(...args),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(() => Promise.resolve({ userId: 'u1', email: 'a@b.com', name: 'Test' })),
}))

import { GET, POST } from '@/app/api/debts/route'

describe('T2.3 — API behavior: GET /api/debts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns debts with computed P&I fields and summary', async () => {
    mockDebtFindMany.mockResolvedValue([
      {
        id: 'd1',
        name: 'Mortgage - 123 Nicoll St',
        type: 'MORTGAGE',
        currentBalance: 218400,
        originalBalance: 245000,
        interestRate: 0.053,
        minimumPayment: 1847,
        paymentDay: 15,
        termMonths: 360,
        property: { id: 'p1', name: '123 Nicoll St' },
        category: null,
      },
      {
        id: 'd2',
        name: 'Student Loans',
        type: 'STUDENT_LOAN',
        currentBalance: 18200,
        originalBalance: null,
        interestRate: 0.05,
        minimumPayment: 650,
        paymentDay: null,
        termMonths: null,
        property: null,
        category: null,
      },
    ])

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.debts).toHaveLength(2)
    expect(data.summary).toBeDefined()
    expect(data.summary.totalDebt).toBeCloseTo(236600, 0)
    expect(data.summary.totalPayments).toBeCloseTo(2497, 0)
    expect(data.summary.count).toBe(2)

    // Check computed fields on first debt (mortgage)
    const mortgage = data.debts[0]
    expect(mortgage.monthlyInterest).toBeCloseTo(964.60, 0)
    expect(mortgage.monthlyPrincipal).toBeCloseTo(882.40, 0)
    expect(mortgage.monthsRemaining).toBeGreaterThan(0)
  })
})

describe('T2.3 — API behavior: POST /api/debts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a mortgage debt successfully', async () => {
    mockDebtCreate.mockResolvedValue({
      id: 'd1',
      userId: 'u1',
      name: 'Mortgage - 123 Nicoll St',
      type: 'MORTGAGE',
      currentBalance: 218400,
      originalBalance: 245000,
      interestRate: 0.053,
      minimumPayment: 1847,
      property: null,
      category: null,
    })

    const req = new Request('http://localhost/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mortgage - 123 Nicoll St',
        type: 'MORTGAGE',
        currentBalance: 218400,
        originalBalance: 245000,
        interestRate: 0.053,
        minimumPayment: 1847,
        paymentDay: 15,
        termMonths: 360,
      }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.name).toBe('Mortgage - 123 Nicoll St')
  })

  it('rejects empty name', async () => {
    const req = new Request('http://localhost/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        type: 'MORTGAGE',
        currentBalance: 100000,
        interestRate: 0.05,
        minimumPayment: 500,
      }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/Name is required/)
  })

  it('rejects invalid debt type', async () => {
    const req = new Request('http://localhost/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Debt',
        type: 'INVALID_TYPE',
        currentBalance: 100000,
        interestRate: 0.05,
        minimumPayment: 500,
      }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/Invalid debt type/)
  })

  it('rejects negative current balance', async () => {
    const req = new Request('http://localhost/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Debt',
        type: 'MORTGAGE',
        currentBalance: -5000,
        interestRate: 0.05,
        minimumPayment: 500,
      }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/Current balance/)
  })

  it('rejects debt when referenced propertyId does not belong to user', async () => {
    mockPropertyFindFirst.mockResolvedValue(null)

    const req = new Request('http://localhost/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Debt',
        type: 'MORTGAGE',
        currentBalance: 100000,
        interestRate: 0.05,
        minimumPayment: 500,
        propertyId: 'nonexistent-property',
      }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toMatch(/Property not found/)
  })

  it('rejects debt when referenced categoryId does not belong to user', async () => {
    mockCategoryFindFirst.mockResolvedValue(null)

    const req = new Request('http://localhost/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Debt',
        type: 'MORTGAGE',
        currentBalance: 100000,
        interestRate: 0.05,
        minimumPayment: 500,
        categoryId: 'nonexistent-category',
      }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toMatch(/Category not found/)
  })
})

// ─── T2.3.8: Phase 1 regression checks ──────────────────────────────────────

describe('T2.3 — Regression: Phase 1 requirements preserved', () => {
  it('Budget model still has no spent field', () => {
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma')
    const schema = fs.readFileSync(schemaPath, 'utf-8')
    const budgetModelMatch = schema.match(/model Budget \{[\s\S]*?\n\}/)
    expect(budgetModelMatch).not.toBeNull()
    expect(budgetModelMatch![0]).not.toMatch(/\bspent\s+Float/)
  })

  it('Transaction model still enforces amount sign convention pattern', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')
    expect(code).toMatch(/-Math\.abs\(amount\)/)
    expect(code).toMatch(/Math\.abs\(amount\)/)
  })

  it('budget-context still computes spent from transactions', () => {
    const ctxPath = path.resolve(__dirname, '../../src/lib/budget-context.ts')
    const code = fs.readFileSync(ctxPath, 'utf-8')
    expect(code).toMatch(/transaction\.findMany/)
    expect(code).toMatch(/Math\.abs/)
  })
})
