/**
 * T1.4 — CSV column mapping: Person and Property (Phase 1, Step 4)
 * T1.5 — CSV account linking (Phase 1, Step 5)
 *
 * T1.4 verifies:
 * - AppField type includes 'person' and 'property'
 * - FIELD_OPTIONS in ColumnMapper.tsx includes Person and Property entries
 * - autoDetectColumns maps "owner" column to 'person' field
 * - autoDetectColumns maps "property" column to 'property' field
 * - transformRows extracts person and property from mapped columns
 *
 * T1.5 verifies:
 * - Import route auto-creates accounts when CSV account name doesn't match existing
 * - Per-row account values take priority over "Import into account" dropdown
 * - Non-Monarch CSV mapping passes account through from transformRows
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ─── T1.4.1: AppField type includes 'person' and 'property' ────────────────

describe('T1.4 — AppField type includes person and property', () => {
  it('column-mapping.ts exports AppField with person and property', () => {
    const codePath = path.resolve(__dirname, '../../src/lib/column-mapping.ts')
    const code = fs.readFileSync(codePath, 'utf-8')

    // AppField type must include 'person' and 'property'
    expect(code).toMatch(/export\s+type\s+AppField\s*=/)
    expect(code).toMatch(/'person'/)
    expect(code).toMatch(/'property'/)
  })

  it('COLUMN_PATTERNS includes person patterns with "owner"', () => {
    const codePath = path.resolve(__dirname, '../../src/lib/column-mapping.ts')
    const code = fs.readFileSync(codePath, 'utf-8')

    // person patterns must include 'owner'
    expect(code).toMatch(/person:\s*\[/)
    expect(code).toMatch(/'owner'/)
  })

  it('COLUMN_PATTERNS includes property patterns with "property"', () => {
    const codePath = path.resolve(__dirname, '../../src/lib/column-mapping.ts')
    const code = fs.readFileSync(codePath, 'utf-8')

    // property patterns must include 'property'
    expect(code).toMatch(/property:\s*\[/)
    expect(code).toMatch(/'property'/)
  })
})

// ─── T1.4.2: FIELD_OPTIONS in ColumnMapper.tsx ──────────────────────────────

describe('T1.4 — FIELD_OPTIONS includes Person and Property', () => {
  it('ColumnMapper.tsx FIELD_OPTIONS includes person entry', () => {
    const codePath = path.resolve(__dirname, '../../src/components/import/ColumnMapper.tsx')
    const code = fs.readFileSync(codePath, 'utf-8')

    // Must have a FIELD_OPTIONS entry for person
    expect(code).toMatch(/value:\s*'person'/)
    expect(code).toMatch(/label:\s*'Person'/)
  })

  it('ColumnMapper.tsx FIELD_OPTIONS includes property entry', () => {
    const codePath = path.resolve(__dirname, '../../src/components/import/ColumnMapper.tsx')
    const code = fs.readFileSync(codePath, 'utf-8')

    // Must have a FIELD_OPTIONS entry for property
    expect(code).toMatch(/value:\s*'property'/)
    expect(code).toMatch(/label:\s*'Property'/)
  })
})

// ─── T1.4.3: autoDetectColumns maps "owner" → person, "property" → property ─

describe('T1.4 — autoDetectColumns person and property detection', () => {
  // Import the real function for unit testing
  let autoDetectColumns: typeof import('@/lib/column-mapping').autoDetectColumns

  beforeEach(async () => {
    const mod = await import('@/lib/column-mapping')
    autoDetectColumns = mod.autoDetectColumns
  })

  it('maps "owner" column to person field', () => {
    const headers = ['Date', 'Amount', 'Description', 'Owner']
    const sampleRows = [
      ['2026-01-15', '-50.00', 'Grocery Store', 'Alice'],
      ['2026-01-16', '-25.00', 'Gas Station', 'Bob'],
    ]

    const mappings = autoDetectColumns(headers, sampleRows)
    const ownerMapping = mappings.find((m) => m.csvColumn === 'Owner')

    expect(ownerMapping).toBeDefined()
    expect(ownerMapping!.appField).toBe('person')
    expect(ownerMapping!.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('maps "person" column to person field', () => {
    const headers = ['Date', 'Amount', 'Description', 'Person']
    const sampleRows = [
      ['2026-01-15', '-50.00', 'Grocery Store', 'Alice'],
    ]

    const mappings = autoDetectColumns(headers, sampleRows)
    const personMapping = mappings.find((m) => m.csvColumn === 'Person')

    expect(personMapping).toBeDefined()
    expect(personMapping!.appField).toBe('person')
    expect(personMapping!.confidence).toBe(1.0)
  })

  it('maps "property" column to property field', () => {
    const headers = ['Date', 'Amount', 'Description', 'Property']
    const sampleRows = [
      ['2026-01-15', '-1500.00', 'Mortgage Payment', 'Main House'],
      ['2026-01-16', '-800.00', 'Rent Income', 'Rental Unit A'],
    ]

    const mappings = autoDetectColumns(headers, sampleRows)
    const propertyMapping = mappings.find((m) => m.csvColumn === 'Property')

    expect(propertyMapping).toBeDefined()
    expect(propertyMapping!.appField).toBe('property')
    expect(propertyMapping!.confidence).toBe(1.0)
  })

  it('maps "property name" column to property field', () => {
    const headers = ['Date', 'Amount', 'Property Name']
    const sampleRows = [
      ['2026-01-15', '-1500.00', '123 Main St'],
    ]

    const mappings = autoDetectColumns(headers, sampleRows)
    const propertyMapping = mappings.find((m) => m.csvColumn === 'Property Name')

    expect(propertyMapping).toBeDefined()
    expect(propertyMapping!.appField).toBe('property')
  })

  it('maps "household member" column to person field', () => {
    const headers = ['Date', 'Amount', 'Household Member']
    const sampleRows = [
      ['2026-01-15', '-50.00', 'Alice'],
    ]

    const mappings = autoDetectColumns(headers, sampleRows)
    const memberMapping = mappings.find((m) => m.csvColumn === 'Household Member')

    expect(memberMapping).toBeDefined()
    expect(memberMapping!.appField).toBe('person')
  })

  it('maps "paid by" column to person field', () => {
    const headers = ['Date', 'Amount', 'Paid By']
    const sampleRows = [
      ['2026-01-15', '-50.00', 'Bob'],
    ]

    const mappings = autoDetectColumns(headers, sampleRows)
    const paidByMapping = mappings.find((m) => m.csvColumn === 'Paid By')

    expect(paidByMapping).toBeDefined()
    expect(paidByMapping!.appField).toBe('person')
  })
})

// ─── T1.4.4: transformRows extracts person and property ─────────────────────

describe('T1.4 — transformRows extracts person and property from mapped columns', () => {
  let transformRows: typeof import('@/lib/csv-parser').transformRows

  beforeEach(async () => {
    const mod = await import('@/lib/csv-parser')
    transformRows = mod.transformRows
  })

  it('extracts person value from a mapped person column', () => {
    const headers = ['Date', 'Amount', 'Description', 'Owner']
    const rows = [['2026-01-15', '-50.00', 'Grocery Store', 'Alice']]
    const mapping: Record<string, string> = {
      Date: 'date',
      Amount: 'amount',
      Description: 'merchant',
      Owner: 'person',
    }

    const result = transformRows(rows, headers, mapping)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].person).toBe('Alice')
  })

  it('extracts property value from a mapped property column', () => {
    const headers = ['Date', 'Amount', 'Description', 'Property']
    const rows = [['2026-01-15', '-1500.00', 'Mortgage', 'Main House']]
    const mapping: Record<string, string> = {
      Date: 'date',
      Amount: 'amount',
      Description: 'merchant',
      Property: 'property',
    }

    const result = transformRows(rows, headers, mapping)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].property).toBe('Main House')
  })

  it('extracts both person and property when both are mapped', () => {
    const headers = ['Date', 'Amount', 'Description', 'Person', 'Property']
    const rows = [['2026-01-15', '-50.00', 'Groceries', 'Alice', 'Main House']]
    const mapping: Record<string, string> = {
      Date: 'date',
      Amount: 'amount',
      Description: 'merchant',
      Person: 'person',
      Property: 'property',
    }

    const result = transformRows(rows, headers, mapping)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].person).toBe('Alice')
    expect(result.transactions[0].property).toBe('Main House')
  })

  it('omits person when column is empty', () => {
    const headers = ['Date', 'Amount', 'Description', 'Person']
    const rows = [['2026-01-15', '-50.00', 'Groceries', '']]
    const mapping: Record<string, string> = {
      Date: 'date',
      Amount: 'amount',
      Description: 'merchant',
      Person: 'person',
    }

    const result = transformRows(rows, headers, mapping)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].person).toBeUndefined()
  })

  it('omits property when column is empty', () => {
    const headers = ['Date', 'Amount', 'Description', 'Property']
    const rows = [['2026-01-15', '-50.00', 'Groceries', '']]
    const mapping: Record<string, string> = {
      Date: 'date',
      Amount: 'amount',
      Description: 'merchant',
      Property: 'property',
    }

    const result = transformRows(rows, headers, mapping)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].property).toBeUndefined()
  })

  it('omits person and property when no columns are mapped', () => {
    const headers = ['Date', 'Amount', 'Description']
    const rows = [['2026-01-15', '-50.00', 'Groceries']]
    const mapping: Record<string, string> = {
      Date: 'date',
      Amount: 'amount',
      Description: 'merchant',
    }

    const result = transformRows(rows, headers, mapping)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].person).toBeUndefined()
    expect(result.transactions[0].property).toBeUndefined()
  })
})

// ─── T1.4.5: ParsedTransaction interface includes person and property ───────

describe('T1.4 — ParsedTransaction interface includes person and property', () => {
  it('csv-parser.ts ParsedTransaction has person and property fields', () => {
    const codePath = path.resolve(__dirname, '../../src/lib/csv-parser.ts')
    const code = fs.readFileSync(codePath, 'utf-8')

    // ParsedTransaction must have optional person and property fields
    expect(code).toMatch(/interface\s+ParsedTransaction/)
    expect(code).toMatch(/person\?\s*:\s*string/)
    expect(code).toMatch(/property\?\s*:\s*string/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// T1.5 — CSV account linking
// ═══════════════════════════════════════════════════════════════════════════════

// ─── T1.5.1: Import route auto-creates accounts ─────────────────────────────

describe('T1.5 — Import route: auto-creates accounts (source verification)', () => {
  it('import/route.ts auto-creates accounts when CSV name does not match', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // Must auto-create accounts (R1.5)
    expect(code).toMatch(/Auto-create account/)
    expect(code).toMatch(/db\.account\.create/)

    // Must set defaults for auto-created accounts
    expect(code).toMatch(/type:\s*'CHECKING'/)
    expect(code).toMatch(/balance:\s*0/)
  })

  it('import/route.ts loads user accounts for matching', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // Must load user accounts into a map
    expect(code).toMatch(/db\.account\.findMany/)
    expect(code).toMatch(/accountMap/)
  })

  it('import/route.ts tries partial match before auto-creating', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // Must attempt partial match (contains) before auto-creating
    expect(code).toMatch(/csvAccountKey\.includes\(userKey\)/)
    expect(code).toMatch(/userKey\.includes\(csvAccountKey\)/)
  })
})

// ─── T1.5.2: Per-row account priority over dropdown ─────────────────────────

describe('T1.5 — Per-row account values take priority over dropdown', () => {
  it('import/route.ts resolves per-row account before falling back to accountId', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // The default resolvedAccountId is the dropdown accountId
    expect(code).toMatch(/resolvedAccountId.*=.*accountId/)

    // But if tx.account exists, it overrides
    expect(code).toMatch(/if\s*\(tx\.account\)/)
  })

  it('import/route.ts uses resolvedAccountId (not raw accountId) in final data', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // The toImport push must use resolvedAccountId, not accountId directly
    expect(code).toMatch(/accountId:\s*resolvedAccountId/)
  })
})

// ─── T1.5.3: Non-Monarch CSV passes account from transformRows ──────────────

describe('T1.5 — Non-Monarch CSV passes account through from transformRows', () => {
  it('transformRows extracts account from mapped account column', async () => {
    const { transformRows } = await import('@/lib/csv-parser')

    const headers = ['Date', 'Amount', 'Description', 'Account']
    const rows = [
      ['2026-01-15', '-50.00', 'Grocery Store', 'Chase Checking'],
      ['2026-01-16', '-25.00', 'Gas Station', 'Amex Gold'],
    ]
    const mapping: Record<string, string> = {
      Date: 'date',
      Amount: 'amount',
      Description: 'merchant',
      Account: 'account',
    }

    const result = transformRows(rows, headers, mapping)

    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0].account).toBe('Chase Checking')
    expect(result.transactions[1].account).toBe('Amex Gold')
  })

  it('import/route.ts maps tx.account for non-Monarch path', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // Non-Monarch path must pass account through from transformRows result
    expect(code).toMatch(/account:\s*tx\.account/)
  })

  it('import/route.ts also maps person and property for non-Monarch path', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // Non-Monarch path must include person and property in the mapped data
    expect(code).toMatch(/person:\s*tx\.person/)
    expect(code).toMatch(/property:\s*tx\.property/)
  })
})

// ─── T1.5.4: Import route auto-creates household members and properties ─────

describe('T1.5 — Import route: auto-creates household members and properties', () => {
  it('import/route.ts auto-creates household members from CSV person column', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // Must auto-create household members
    expect(code).toMatch(/db\.householdMember\.create/)
    expect(code).toMatch(/memberMap/)
  })

  it('import/route.ts auto-creates properties from CSV property column', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // Must auto-create properties
    expect(code).toMatch(/db\.property\.create/)
    expect(code).toMatch(/propertyMap/)
  })

  it('import/route.ts stores householdMemberId and propertyId on imported transactions', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // The toImport data must include these resolved IDs
    expect(code).toMatch(/householdMemberId:\s*resolvedMemberId/)
    expect(code).toMatch(/propertyId:\s*resolvedPropertyId/)
  })
})
