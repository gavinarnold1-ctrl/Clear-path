/**
 * T2.1 — Household members (Phase 2, Step 5)
 *
 * Verifies that:
 * 1. HouseholdMember model exists in schema with correct fields
 * 2. Transaction model has householdMemberId (nullable) + relation
 * 3. API routes for household-members CRUD work correctly
 * 4. Transaction tagging with householdMemberId works
 * 5. TransactionForm and TransactionList include Person dropdown/column
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ─── T2.1.1: Schema verification ──────────────────────────────────────────────

describe('T2.1 — Schema: HouseholdMember model', () => {
  const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma')
  const schema = fs.readFileSync(schemaPath, 'utf-8')

  it('HouseholdMember model exists with required fields', () => {
    const modelMatch = schema.match(/model HouseholdMember \{[\s\S]*?\n\}/)
    expect(modelMatch).not.toBeNull()

    const model = modelMatch![0]
    expect(model).toMatch(/id\s+String\s+@id/)
    expect(model).toMatch(/userId\s+String/)
    expect(model).toMatch(/name\s+String/)
    expect(model).toMatch(/isDefault\s+Boolean/)
    expect(model).toMatch(/createdAt\s+DateTime/)
    expect(model).toMatch(/transactions\s+Transaction\[\]/)
  })

  it('HouseholdMember has @@index on userId', () => {
    const modelMatch = schema.match(/model HouseholdMember \{[\s\S]*?\n\}/)
    expect(modelMatch![0]).toMatch(/@@index\(\[userId\]\)/)
  })

  it('Transaction model has householdMemberId field', () => {
    const txModelMatch = schema.match(/model Transaction \{[\s\S]*?\n\}/)
    expect(txModelMatch).not.toBeNull()

    const txModel = txModelMatch![0]
    expect(txModel).toMatch(/householdMemberId\s+String\?/)
    expect(txModel).toMatch(/householdMember\s+HouseholdMember\?/)
  })

  it('Transaction householdMember relation has onDelete: SetNull', () => {
    const txModelMatch = schema.match(/model Transaction \{[\s\S]*?\n\}/)
    const txModel = txModelMatch![0]
    // Find the line with householdMember relation and check for SetNull
    expect(txModel).toMatch(/householdMember\s+HouseholdMember\?.*onDelete:\s*SetNull/)
  })

  it('Transaction has @@index on householdMemberId', () => {
    const txModelMatch = schema.match(/model Transaction \{[\s\S]*?\n\}/)
    expect(txModelMatch![0]).toMatch(/@@index\(\[householdMemberId\]\)/)
  })
})

// ─── T2.1.2: Types verification ──────────────────────────────────────────────

describe('T2.1 — Types: HouseholdMember interface', () => {
  const typesPath = path.resolve(__dirname, '../../src/types/index.ts')
  const types = fs.readFileSync(typesPath, 'utf-8')

  it('HouseholdMember interface exists with correct properties', () => {
    const interfaceMatch = types.match(/export\s+interface\s+HouseholdMember\s*\{[\s\S]*?\}/)
    expect(interfaceMatch).not.toBeNull()

    const iface = interfaceMatch![0]
    expect(iface).toMatch(/id:\s*string/)
    expect(iface).toMatch(/userId:\s*string/)
    expect(iface).toMatch(/name:\s*string/)
    expect(iface).toMatch(/isDefault:\s*boolean/)
  })

  it('Transaction interface has householdMemberId field', () => {
    const txInterfaceMatch = types.match(/export\s+interface\s+Transaction\s*\{[\s\S]*?\}/)
    expect(txInterfaceMatch).not.toBeNull()

    const txIface = txInterfaceMatch![0]
    expect(txIface).toMatch(/householdMemberId:\s*string\s*\|\s*null/)
    expect(txIface).toMatch(/householdMember\?:\s*HouseholdMember\s*\|\s*null/)
  })
})

// ─── T2.1.3: API route source verification ───────────────────────────────────

describe('T2.1 — API: household-members route source', () => {
  it('GET /api/household-members scopes by userId', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/household-members/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/getSession\(\)/)
    expect(code).toMatch(/session\.userId/)
    expect(code).toMatch(/householdMember\.findMany/)
    expect(code).toMatch(/where:.*userId:\s*session\.userId/)
  })

  it('POST /api/household-members validates name and creates member', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/household-members/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    // Name validation
    expect(code).toMatch(/!name\s*\|\|/)
    expect(code).toMatch(/Name is required/)

    // Create call
    expect(code).toMatch(/householdMember\.create/)
    expect(code).toMatch(/name:\s*name\.trim\(\)/)
    expect(code).toMatch(/status:\s*201/)
  })

  it('POST /api/household-members handles isDefault (unsets existing default)', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/household-members/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/if\s*\(isDefault\)/)
    expect(code).toMatch(/householdMember\.updateMany/)
    expect(code).toMatch(/isDefault:\s*false/)
  })
})

describe('T2.1 — API: household-members/[id] route source', () => {
  it('PATCH validates ownership before updating', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/household-members/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/householdMember\.findFirst/)
    expect(code).toMatch(/userId:\s*session\.userId/)
    expect(code).toMatch(/Not found/)
    expect(code).toMatch(/householdMember\.update/)
  })

  it('DELETE nulls out transactions then deletes member', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/household-members/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    // Uses $transaction for atomicity
    expect(code).toMatch(/\$transaction/)
    // Nulls out householdMemberId on transactions
    expect(code).toMatch(/transaction\.updateMany/)
    expect(code).toMatch(/householdMemberId:\s*null/)
    // Then deletes
    expect(code).toMatch(/householdMember\.delete/)
    expect(code).toMatch(/status:\s*204/)
  })
})

// ─── T2.1.4: Transaction tagging source verification ─────────────────────────

describe('T2.1 — Transaction tagging with householdMemberId', () => {
  it('GET /api/transactions includes householdMember in response', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/include:.*householdMember/)
  })

  it('GET /api/transactions supports householdMemberId filter', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/householdMemberId/)
    expect(code).toMatch(/searchParams\.get\(['"]householdMemberId['"]\)/)
  })

  it('POST /api/transactions accepts householdMemberId', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/householdMemberId/)
  })

  it('PATCH /api/transactions/[id] accepts householdMemberId', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/householdMemberId/)
  })

  it('createTransaction server action accepts householdMemberId from FormData', () => {
    const actionsPath = path.resolve(__dirname, '../../src/app/actions/transactions.ts')
    const code = fs.readFileSync(actionsPath, 'utf-8')

    expect(code).toMatch(/householdMemberId/)
  })
})

// ─── T2.1.5: UI verification ────────────────────────────────────────────────

describe('T2.1 — UI: Person column and dropdown', () => {
  it('TransactionList has HouseholdMemberOption interface and Person column', () => {
    const listPath = path.resolve(__dirname, '../../src/components/transactions/TransactionList.tsx')
    const code = fs.readFileSync(listPath, 'utf-8')

    expect(code).toMatch(/HouseholdMemberOption/)
    expect(code).toMatch(/householdMembers/)
    // Person column header
    expect(code).toMatch(/Person/)
  })

  it('TransactionForm includes Person dropdown', () => {
    const formPath = path.resolve(__dirname, '../../src/components/forms/TransactionForm.tsx')
    const code = fs.readFileSync(formPath, 'utf-8')

    expect(code).toMatch(/HouseholdMemberOption/)
    expect(code).toMatch(/householdMembers/)
    // Default member pre-selection
    expect(code).toMatch(/isDefault/)
  })

  it('transactions/page.tsx fetches householdMembers and passes to components', () => {
    const pagePath = path.resolve(__dirname, '../../src/app/(dashboard)/transactions/page.tsx')
    const code = fs.readFileSync(pagePath, 'utf-8')

    expect(code).toMatch(/householdMember/)
    expect(code).toMatch(/householdMembers/)
  })

  it('transactions/new/page.tsx fetches householdMembers for form', () => {
    const pagePath = path.resolve(__dirname, '../../src/app/(dashboard)/transactions/new/page.tsx')
    const code = fs.readFileSync(pagePath, 'utf-8')

    expect(code).toMatch(/householdMember/)
  })
})

// ─── T2.1.6: Mocked API behavior ────────────────────────────────────────────

const mockFindMany = vi.fn()
const mockCreate = vi.fn()
const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()
const mockUpdateMany = vi.fn()
const mockDelete = vi.fn()
const mockTxUpdateMany = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    householdMember: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    transaction: {
      updateMany: (...args: unknown[]) => mockTxUpdateMany(...args),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(() => Promise.resolve({ userId: 'u1', email: 'a@b.com', name: 'Test' })),
}))

import { GET, POST } from '@/app/api/household-members/route'

describe('T2.1 — API behavior: GET /api/household-members', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns members for authenticated user', async () => {
    const members = [
      { id: 'm1', userId: 'u1', name: 'Shared', isDefault: true },
      { id: 'm2', userId: 'u1', name: 'Gavin', isDefault: false },
      { id: 'm3', userId: 'u1', name: 'Caroline', isDefault: false },
    ]
    mockFindMany.mockResolvedValue(members)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(3)
    expect(data[0].name).toBe('Shared')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
      })
    )
  })
})

describe('T2.1 — API behavior: POST /api/household-members', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a household member successfully', async () => {
    mockCreate.mockResolvedValue({ id: 'm1', userId: 'u1', name: 'Gavin', isDefault: false })

    const req = new Request('http://localhost/api/household-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gavin' }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.name).toBe('Gavin')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Gavin', userId: 'u1' }),
      })
    )
  })

  it('rejects empty name', async () => {
    const req = new Request('http://localhost/api/household-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/Name is required/)
  })

  it('unsets existing default when creating with isDefault=true', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockCreate.mockResolvedValue({ id: 'm1', userId: 'u1', name: 'Shared', isDefault: true })

    const req = new Request('http://localhost/api/household-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Shared', isDefault: true }),
    })

    const res = await POST(req as never)
    expect(res.status).toBe(201)
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', isDefault: true },
        data: { isDefault: false },
      })
    )
  })
})
