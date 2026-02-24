/**
 * T2.2 — Property tagging (Phase 2, Step 6)
 *
 * Verifies that:
 * 1. Property model exists with correct fields (name, type: PERSONAL/RENTAL, isDefault)
 * 2. PropertyType enum exists
 * 3. Transaction model has propertyId (nullable) + relation
 * 4. API routes for properties CRUD work correctly
 * 5. Transaction tagging with propertyId works
 * 6. TransactionForm and TransactionList include Property dropdown/column
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ─── T2.2.1: Schema verification ──────────────────────────────────────────────

describe('T2.2 — Schema: Property model and PropertyType enum', () => {
  const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma')
  const schema = fs.readFileSync(schemaPath, 'utf-8')

  it('PropertyType enum exists with PERSONAL and RENTAL', () => {
    const enumMatch = schema.match(/enum PropertyType \{[\s\S]*?\}/)
    expect(enumMatch).not.toBeNull()

    const enumBody = enumMatch![0]
    expect(enumBody).toMatch(/PERSONAL/)
    expect(enumBody).toMatch(/RENTAL/)
  })

  it('Property model exists with required fields', () => {
    const modelMatch = schema.match(/model Property \{[\s\S]*?\n\}/)
    expect(modelMatch).not.toBeNull()

    const model = modelMatch![0]
    expect(model).toMatch(/id\s+String\s+@id/)
    expect(model).toMatch(/userId\s+String/)
    expect(model).toMatch(/name\s+String/)
    expect(model).toMatch(/type\s+PropertyType/)
    expect(model).toMatch(/isDefault\s+Boolean/)
    expect(model).toMatch(/createdAt\s+DateTime/)
    expect(model).toMatch(/transactions\s+Transaction\[\]/)
    expect(model).toMatch(/debts\s+Debt\[\]/)
  })

  it('Property model does NOT have old propertyType String field', () => {
    const modelMatch = schema.match(/model Property \{[\s\S]*?\n\}/)
    const model = modelMatch![0]
    // Should use enum `type PropertyType`, not `propertyType String`
    expect(model).not.toMatch(/propertyType\s+String/)
  })

  it('Property has @@index on userId', () => {
    const modelMatch = schema.match(/model Property \{[\s\S]*?\n\}/)
    expect(modelMatch![0]).toMatch(/@@index\(\[userId\]\)/)
  })

  it('Transaction model has propertyId field', () => {
    const txModelMatch = schema.match(/model Transaction \{[\s\S]*?\n\}/)
    expect(txModelMatch).not.toBeNull()

    const txModel = txModelMatch![0]
    expect(txModel).toMatch(/propertyId\s+String\?/)
    expect(txModel).toMatch(/property\s+Property\?/)
  })

  it('Transaction property relation has onDelete: SetNull', () => {
    const txModelMatch = schema.match(/model Transaction \{[\s\S]*?\n\}/)
    const txModel = txModelMatch![0]
    expect(txModel).toMatch(/property\s+Property\?.*onDelete:\s*SetNull/)
  })

  it('Transaction has @@index on propertyId', () => {
    const txModelMatch = schema.match(/model Transaction \{[\s\S]*?\n\}/)
    expect(txModelMatch![0]).toMatch(/@@index\(\[propertyId\]\)/)
  })
})

// ─── T2.2.2: Types verification ──────────────────────────────────────────────

describe('T2.2 — Types: Property interface and PropertyType', () => {
  const typesPath = path.resolve(__dirname, '../../src/types/index.ts')
  const types = fs.readFileSync(typesPath, 'utf-8')

  it('PropertyType type exists with correct values', () => {
    expect(types).toMatch(/export\s+type\s+PropertyType/)
    expect(types).toMatch(/PERSONAL/)
    expect(types).toMatch(/RENTAL/)
  })

  it('Property interface exists with correct properties', () => {
    const interfaceMatch = types.match(/export\s+interface\s+Property\s*\{[\s\S]*?\}/)
    expect(interfaceMatch).not.toBeNull()

    const iface = interfaceMatch![0]
    expect(iface).toMatch(/id:\s*string/)
    expect(iface).toMatch(/userId:\s*string/)
    expect(iface).toMatch(/name:\s*string/)
    expect(iface).toMatch(/type:\s*PropertyType/)
    expect(iface).toMatch(/isDefault:\s*boolean/)
  })

  it('Transaction interface has propertyId field', () => {
    const txInterfaceMatch = types.match(/export\s+interface\s+Transaction\s*\{[\s\S]*?\}/)
    expect(txInterfaceMatch).not.toBeNull()

    const txIface = txInterfaceMatch![0]
    expect(txIface).toMatch(/propertyId:\s*string\s*\|\s*null/)
    expect(txIface).toMatch(/property\?:\s*Property\s*\|\s*null/)
  })
})

// ─── T2.2.3: API route source verification ───────────────────────────────────

describe('T2.2 — API: properties route source', () => {
  it('GET /api/properties scopes by userId', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/properties/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/getSession\(\)/)
    expect(code).toMatch(/session\.userId/)
    expect(code).toMatch(/property\.findMany/)
  })

  it('POST /api/properties validates name and type', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/properties/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    // Name validation
    expect(code).toMatch(/Name is required/)
    // Type validation
    expect(code).toMatch(/PERSONAL/)
    expect(code).toMatch(/RENTAL/)
    expect(code).toMatch(/Type must be PERSONAL or RENTAL/)
  })

  it('POST /api/properties handles isDefault (unsets existing default)', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/properties/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/if\s*\(isDefault\)/)
    expect(code).toMatch(/property\.updateMany/)
    expect(code).toMatch(/isDefault:\s*false/)
  })
})

describe('T2.2 — API: properties/[id] route source', () => {
  it('PATCH validates ownership before updating', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/properties/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/property\.findFirst/)
    expect(code).toMatch(/userId:\s*session\.userId/)
    expect(code).toMatch(/Not found/)
    expect(code).toMatch(/property\.update/)
  })

  it('PATCH validates type if provided', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/properties/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/VALID_TYPES/)
    expect(code).toMatch(/Type must be PERSONAL or RENTAL/)
  })

  it('DELETE nulls out transactions then deletes property', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/properties/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/\$transaction/)
    expect(code).toMatch(/transaction\.updateMany/)
    expect(code).toMatch(/propertyId:\s*null/)
    expect(code).toMatch(/property\.delete/)
    expect(code).toMatch(/status:\s*204/)
  })
})

// ─── T2.2.4: Transaction tagging source verification ─────────────────────────

describe('T2.2 — Transaction tagging with propertyId', () => {
  it('GET /api/transactions includes property in response', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/include:.*property/)
  })

  it('GET /api/transactions supports propertyId filter', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/searchParams\.get\(['"]propertyId['"]\)/)
  })

  it('POST /api/transactions accepts propertyId', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/propertyId/)
  })

  it('PATCH /api/transactions/[id] accepts propertyId', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).toMatch(/propertyId/)
  })
})

// ─── T2.2.5: UI verification ────────────────────────────────────────────────

describe('T2.2 — UI: Property column and dropdown', () => {
  it('TransactionList has PropertyOption interface and Property column', () => {
    const listPath = path.resolve(__dirname, '../../src/components/transactions/TransactionList.tsx')
    const code = fs.readFileSync(listPath, 'utf-8')

    expect(code).toMatch(/PropertyOption/)
    expect(code).toMatch(/properties/)
    expect(code).toMatch(/Property/)
  })

  it('TransactionForm includes Property dropdown with default pre-selection', () => {
    const formPath = path.resolve(__dirname, '../../src/components/forms/TransactionForm.tsx')
    const code = fs.readFileSync(formPath, 'utf-8')

    expect(code).toMatch(/PropertyOption/)
    expect(code).toMatch(/properties/)
    expect(code).toMatch(/isDefault/)
  })

  it('transactions/page.tsx fetches properties and passes to components', () => {
    const pagePath = path.resolve(__dirname, '../../src/app/(dashboard)/transactions/page.tsx')
    const code = fs.readFileSync(pagePath, 'utf-8')

    expect(code).toMatch(/property/)
    expect(code).toMatch(/properties/)
  })

  it('transactions/new/page.tsx fetches properties for form', () => {
    const pagePath = path.resolve(__dirname, '../../src/app/(dashboard)/transactions/new/page.tsx')
    const code = fs.readFileSync(pagePath, 'utf-8')

    expect(code).toMatch(/propert/)
  })
})

// ─── T2.2.6: Mocked API behavior ────────────────────────────────────────────

const mockFindMany = vi.fn()
const mockCreate = vi.fn()
const mockFindFirst = vi.fn()
const mockUpdateMany = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    property: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(() => Promise.resolve({ userId: 'u1', email: 'a@b.com', name: 'Test' })),
}))

import { GET, POST } from '@/app/api/properties/route'

describe('T2.2 — API behavior: GET /api/properties', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns properties for authenticated user', async () => {
    const properties = [
      { id: 'p1', userId: 'u1', name: 'Personal', type: 'PERSONAL', isDefault: true },
      { id: 'p2', userId: 'u1', name: '123 Nicoll St', type: 'RENTAL', isDefault: false },
    ]
    mockFindMany.mockResolvedValue(properties)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0].type).toBe('PERSONAL')
    expect(data[1].type).toBe('RENTAL')
  })
})

describe('T2.2 — API behavior: POST /api/properties', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a property with valid type', async () => {
    mockCreate.mockResolvedValue({
      id: 'p1', userId: 'u1', name: 'Personal', type: 'PERSONAL', isDefault: true,
    })

    const req = new Request('http://localhost/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Personal', type: 'PERSONAL', isDefault: true }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.name).toBe('Personal')
    expect(data.type).toBe('PERSONAL')
  })

  it('rejects empty name', async () => {
    const req = new Request('http://localhost/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', type: 'PERSONAL' }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/Name is required/)
  })

  it('rejects invalid type', async () => {
    const req = new Request('http://localhost/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', type: 'COMMERCIAL' }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/Type must be PERSONAL or RENTAL/)
  })

  it('unsets existing default when creating with isDefault=true', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockCreate.mockResolvedValue({
      id: 'p1', userId: 'u1', name: 'Personal', type: 'PERSONAL', isDefault: true,
    })

    const req = new Request('http://localhost/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Personal', type: 'PERSONAL', isDefault: true }),
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

  it('creates rental property successfully', async () => {
    mockCreate.mockResolvedValue({
      id: 'p2', userId: 'u1', name: '123 Nicoll St', type: 'RENTAL', isDefault: false,
    })

    const req = new Request('http://localhost/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '123 Nicoll St', type: 'RENTAL' }),
    })

    const res = await POST(req as never)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.type).toBe('RENTAL')
  })
})
