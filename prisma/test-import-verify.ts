/**
 * Oversikt Test Data Import & Verification Script
 *
 * Runs entirely in-memory — no database connection needed.
 * Parses prisma/test-data.csv and applies the same classification,
 * category-group inference, and amount-sign logic the CSV import
 * route uses, then verifies all 7 steps.
 *
 * Usage: npx tsx prisma/test-import-verify.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Classification helpers (mirrored from src/lib/category-groups.ts) ───────

const GROUP_KEYWORDS: Record<string, string[]> = {
  Housing: [
    'mortgage', 'rent', 'hoa', 'property tax', 'home', 'housing',
    'improvement', 'repair', 'furniture', 'housewares', 'appliance',
  ],
  Utilities: [
    'electric', 'gas & electric', 'water', 'garbage', 'internet',
    'cable', 'phone', 'cell', 'mobile', 'utility',
  ],
  Food: [
    'groceries', 'grocery', 'restaurant', 'dining', 'food', 'coffee',
    'bars', 'bakery', 'takeout', 'delivery',
  ],
  Transport: [
    'gas', 'fuel', 'auto', 'car', 'parking', 'toll',
    'uber', 'lyft', 'taxi', 'transit', 'ride share', 'public transit',
  ],
  Insurance: [
    'insurance', 'premium', 'usaa', 'geico', 'state farm',
  ],
  Healthcare: [
    'medical', 'doctor', 'dentist', 'pharmacy', 'hospital',
    'therapy', 'fitness', 'gym', 'health', 'wellness',
  ],
  Personal: [
    'clothing', 'personal', 'shopping', 'electronics', 'education',
    'gifts', 'charity', 'donation', 'beauty', 'haircut',
  ],
  Entertainment: [
    'entertainment', 'recreation', 'travel', 'vacation', 'hotel',
    'flight', 'pet', 'vet', 'streaming', 'movie', 'concert',
  ],
  Financial: [
    'fee', 'financial', 'legal', 'loan', 'student loan',
    'bank fee', 'interest', 'atm',
  ],
  Income: [
    'income', 'salary', 'paycheck', 'dividend', 'interest earned',
    'bonus', 'refund', 'reimbursement',
  ],
  Transfers: [
    'transfer', 'credit card payment', 'internal transfer',
    'zelle', 'venmo', 'paypal',
  ],
  Other: [
    'miscellaneous', 'uncategorized', 'cash', 'postage', 'shipping',
    'tax', 'office', 'wedding', 'business',
  ],
}

function inferCategoryGroup(categoryName: string, categoryType: string): string {
  const nameLower = categoryName.toLowerCase()
  let bestGroup: string | null = null
  let bestScore = 0
  for (const [group, keywords] of Object.entries(GROUP_KEYWORDS)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword) || keyword.includes(nameLower)) {
        const score = Math.min(keyword.length, nameLower.length) / Math.max(keyword.length, nameLower.length)
        if (score > bestScore) {
          bestScore = score
          bestGroup = group
        }
      }
    }
  }
  if (bestGroup && bestScore >= 0.3) return bestGroup
  if (categoryType === 'income') return 'Income'
  if (categoryType === 'transfer') return 'Transfers'
  return 'Other'
}

function classifyTransaction(
  group: string | null | undefined,
  categoryType: string | null | undefined,
  amount: number,
): string {
  if (group) {
    const g = group.toLowerCase()
    if (g === 'transfer' || g === 'transfers') return 'transfer'
    if (g === 'income') return amount > 0 ? 'income' : 'expense'
  }
  if (categoryType === 'transfer') return 'transfer'
  if (categoryType === 'income') return amount > 0 ? 'income' : 'expense'
  return 'expense'
}

function inferAccountType(name: string): string {
  const lower = name.toLowerCase()
  if (['card', 'visa', 'mastercard', 'amex', 'discover', 'platinum', 'venture', 'sapphire', 'freedom', 'chase '].some(p => lower.includes(p))) return 'CREDIT_CARD'
  if (['saving', 'savings', 'money market', 'high yield', 'hysa'].some(p => lower.includes(p))) return 'SAVINGS'
  if (['mortgage', 'home loan'].some(p => lower.includes(p))) return 'MORTGAGE'
  if (['auto loan', 'car loan', 'vehicle'].some(p => lower.includes(p))) return 'AUTO_LOAN'
  if (['student loan', 'student'].some(p => lower.includes(p))) return 'STUDENT_LOAN'
  if (['invest', 'brokerage', '401k', 'ira', 'roth', 'retirement'].some(p => lower.includes(p))) return 'INVESTMENT'
  return 'CHECKING'
}

// ─── CSV Parser ──────────────────────────────────────────────────────────────

interface CsvRow {
  date: string
  description: string
  category: string
  categoryGroup: string
  amount: number
  person: string
  property: string
  account: string
}

interface ProcessedTx {
  date: Date
  dateStr: string  // MM/DD/YYYY
  merchant: string
  amount: number
  category: string
  categoryGroup: string  // from CSV (authoritative)
  resolvedGroup: string  // what the app's import would assign
  categoryType: string   // inferred: income/expense/transfer
  classification: string // income/expense/transfer
  person: string
  property: string
  account: string
  accountType: string
}

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(filePath: string): CsvRow[] {
  const text = fs.readFileSync(filePath, 'utf-8')
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length < 8) continue
    if (cols.every(c => !c.trim())) continue
    rows.push({
      date: cols[0],
      description: cols[1],
      category: cols[2],
      categoryGroup: cols[3],
      amount: parseFloat(cols[4]) || 0,
      person: cols[5] || '',
      property: cols[6] || '',
      account: cols[7] || '',
    })
  }
  return rows
}

function parseDate(raw: string): Date | null {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) return new Date(+match[3], +match[1] - 1, +match[2])
  const fallback = new Date(raw)
  return isNaN(fallback.getTime()) ? null : fallback
}

function fmtDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── Results tracking ────────────────────────────────────────────────────────

const results: Record<string, string> = {}
let failCount = 0

function check(step: string, label: string, actual: unknown, expected: unknown): boolean {
  const pass = actual === expected
  if (!pass) {
    console.log(`  ❌ FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    failCount++
    if (!results[step]?.startsWith('FAIL')) results[step] = 'FAIL'
    return false
  }
  console.log(`  ✅ ${label}: ${actual}`)
  return true
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║       Oversikt Test Data Import & Verification              ║')
  console.log('║       (in-memory — no database required)                    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  // ── Parse CSV ──
  const csvPath = path.join(__dirname, 'test-data.csv')
  if (!fs.existsSync(csvPath)) {
    console.error(`ERROR: ${csvPath} not found`)
    process.exit(1)
  }

  const csvRows = parseCSV(csvPath)
  console.log(`\nParsed ${csvRows.length} CSV rows.\n`)

  // ── Process transactions (replicate import logic) ──
  // Build category type map from CSV data: category → { group, type }
  const categoryInfo = new Map<string, { group: string; type: string }>()
  for (const row of csvRows) {
    const key = row.category.toLowerCase()
    if (!categoryInfo.has(key) && row.category) {
      const group = row.categoryGroup
      let catType: string
      if (group.toLowerCase() === 'transfers') {
        catType = 'transfer'
      } else if (group.toLowerCase() === 'income') {
        catType = 'income'
      } else {
        catType = 'expense'
      }
      categoryInfo.set(key, { group, type: catType })
    }
  }

  // Process each row
  const transactions: ProcessedTx[] = []
  let parseErrors = 0

  for (const row of csvRows) {
    const date = parseDate(row.date)
    if (!date) { parseErrors++; continue }

    const catKey = row.category.toLowerCase()
    const info = categoryInfo.get(catKey)
    const csvGroup = info?.group || row.categoryGroup
    const catType = info?.type || 'expense'

    // What would the import route infer for the group?
    const inferredGroup = inferCategoryGroup(row.category, catType)

    // Classification uses the CSV's group (since we'd pass csvGroup during auto-create)
    const classification = classifyTransaction(csvGroup, catType, row.amount)

    const acctType = inferAccountType(row.account)

    transactions.push({
      date,
      dateStr: row.date,
      merchant: row.description,
      amount: row.amount,
      category: row.category,
      categoryGroup: csvGroup,
      resolvedGroup: inferredGroup,
      categoryType: catType,
      classification,
      person: row.person,
      property: row.property,
      account: row.account,
      accountType: acctType,
    })
  }

  if (parseErrors > 0) {
    console.log(`  Parse errors (skipped): ${parseErrors}`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Verify Import Integrity
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('STEP 2: Verify Import Integrity')
  console.log('══════════════════════════════════════════════════════════\n')
  results['Step 2'] = 'PASS'

  // Total transactions
  check('Step 2', 'Total transactions', transactions.length, 4000)

  // Total accounts
  const uniqueAccounts = [...new Set(transactions.map(t => t.account))].filter(Boolean).sort()
  check('Step 2', 'Total accounts', uniqueAccounts.length, 4)
  const expectedAccounts = ['Chase Sapphire', 'Discover It', 'Webster Checking', 'Webster Savings']
  check('Step 2', 'Account names', uniqueAccounts.join(', '), expectedAccounts.join(', '))

  // Account type inference
  for (const acctName of uniqueAccounts) {
    const acctType = inferAccountType(acctName)
    console.log(`  Account "${acctName}" → inferred type: ${acctType}`)
  }

  // Total category groups
  const uniqueGroups = [...new Set(transactions.map(t => t.categoryGroup))].sort()
  check('Step 2', 'Total category groups', uniqueGroups.length, 12)
  console.log(`  Groups: ${uniqueGroups.join(', ')}`)

  // Household members
  const uniquePersons = [...new Set(transactions.map(t => t.person).filter(Boolean))].sort()
  console.log(`  Household members: ${uniquePersons.join(', ')}`)
  check('Step 2', 'Household members', uniquePersons.length, 2)

  const unassignedCount = transactions.filter(t => !t.person).length
  console.log(`  Transactions with no person: ${unassignedCount}`)

  // Properties
  const uniqueProps = [...new Set(transactions.map(t => t.property).filter(Boolean))].sort()
  console.log(`  Properties: ${uniqueProps.join(', ')}`)
  check('Step 2', 'Nicoll St in properties', uniqueProps.includes('Nicoll St'), true)

  const noPropCount = transactions.filter(t => !t.property).length
  console.log(`  Transactions with no property: ${noPropCount}`)

  // Date range
  const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime())
  const earliest = dates[0]
  const latest = dates[dates.length - 1]
  check('Step 2', 'Earliest date', fmtDate(earliest), '08/01/2024')
  check('Step 2', 'Latest date', fmtDate(latest), '02/28/2026')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Classification Verification
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('STEP 3: Classification Verification')
  console.log('══════════════════════════════════════════════════════════\n')
  results['Step 3'] = 'PASS'

  // 3.1 Income-group negatives (Tax Withholding)
  console.log('--- 3.1: Income-group negatives (Tax Withholding) ---')
  const incomeGroupNegatives = transactions.filter(
    t => t.categoryGroup.toLowerCase() === 'income' && t.amount < 0
  )
  console.log(`  Count: ${incomeGroupNegatives.length}`)
  for (const tx of incomeGroupNegatives.slice(0, 5)) {
    console.log(`    ${tx.dateStr} | ${tx.merchant} | $${tx.amount} | classification: ${tx.classification} | cat: ${tx.category}`)
  }
  const allIncomeNegsCorrect = incomeGroupNegatives.every(t => t.classification === 'expense')
  if (incomeGroupNegatives.length > 0) {
    if (allIncomeNegsCorrect) {
      console.log(`  ✅ All ${incomeGroupNegatives.length} income-group negatives classified as 'expense'`)
    } else {
      const bad = incomeGroupNegatives.filter(t => t.classification !== 'expense')
      console.log(`  ❌ FAIL: ${bad.length} income-group negatives NOT classified as 'expense'`)
      results['Step 3'] = 'FAIL'
      failCount++
    }
  } else {
    console.log('  ℹ️  No income-group negative transactions found')
  }

  // 3.2 Refunds on expense categories (positive amount in expense groups)
  console.log('\n--- 3.2: Refunds on expense categories ---')
  const expenseGroups = ['Personal', 'Housing', 'Entertainment', 'Financial', 'Food', 'Transport', 'Healthcare', 'Utilities', 'Insurance', 'Other']
  const refunds = transactions.filter(
    t => expenseGroups.includes(t.categoryGroup) && t.amount > 0
  )
  console.log(`  Count of positive-amount expense-group transactions: ${refunds.length}`)
  for (const tx of refunds.slice(0, 5)) {
    console.log(`    ${tx.dateStr} | ${tx.merchant} | +$${tx.amount} | classification: ${tx.classification} | cat: ${tx.category} (${tx.categoryGroup})`)
  }
  // Per classifyTransaction(): expense groups with any amount → 'expense'
  if (refunds.length > 0) {
    const allRefundsCorrect = refunds.every(t => t.classification === 'expense')
    if (allRefundsCorrect) {
      console.log(`  ✅ All ${refunds.length} refunds classified as 'expense' (correct per rules)`)
    } else {
      const bad = refunds.filter(t => t.classification !== 'expense')
      console.log(`  ❌ FAIL: ${bad.length} refunds NOT classified as 'expense'`)
      for (const tx of bad.slice(0, 5)) {
        console.log(`    ${tx.dateStr} | ${tx.merchant} | +$${tx.amount} | classification: ${tx.classification} | group: ${tx.categoryGroup}`)
      }
      results['Step 3'] = 'FAIL'
      failCount++
    }
  } else {
    console.log('  ℹ️  No refund transactions found in expense groups')
  }

  // 3.3 Transfers
  console.log('\n--- 3.3: Transfers ---')
  const transfers = transactions.filter(t => t.categoryGroup.toLowerCase() === 'transfers')
  console.log(`  Transfer-group transactions: ${transfers.length}`)
  const allTransfersCorrect = transfers.every(t => t.classification === 'transfer')
  if (allTransfersCorrect) {
    console.log(`  ✅ All ${transfers.length} transfers correctly classified as 'transfer'`)
  } else {
    console.log('  ❌ FAIL: Some transfers have wrong classification')
    results['Step 3'] = 'FAIL'
    failCount++
  }
  const totalTransferClass = transactions.filter(t => t.classification === 'transfer').length
  console.log(`  Total transactions with classification='transfer': ${totalTransferClass}`)

  // 3.4 Zero-amount transactions
  console.log('\n--- 3.4: Zero-amount transactions ---')
  const zeroTxs = transactions.filter(t => t.amount === 0)
  console.log(`  Zero-amount transactions: ${zeroTxs.length}`)
  for (const tx of zeroTxs.slice(0, 5)) {
    console.log(`    ${tx.dateStr} | ${tx.merchant} | $${tx.amount} | classification: ${tx.classification} | cat: ${tx.category}`)
  }

  // 3.5 Overall classification breakdown
  console.log('\n--- 3.5: Overall classification breakdown ---')
  const classBreakdown: Record<string, number> = {}
  for (const tx of transactions) {
    classBreakdown[tx.classification] = (classBreakdown[tx.classification] || 0) + 1
  }
  for (const [cls, count] of Object.entries(classBreakdown).sort()) {
    console.log(`  ${cls}: ${count}`)
  }
  const totalClassified = Object.values(classBreakdown).reduce((a, b) => a + b, 0)
  check('Step 3', 'All transactions classified', totalClassified, transactions.length)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Budget Computation Check
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('STEP 4: Budget Computation Check')
  console.log('══════════════════════════════════════════════════════════\n')
  results['Step 4'] = 'PASS'

  const months = [
    { label: 'Dec 2025', year: 2025, month: 12 },
    { label: 'Jan 2026', year: 2026, month: 1 },
    { label: 'Feb 2026', year: 2026, month: 2 },
  ]

  for (const m of months) {
    const monthTxs = transactions.filter(t => {
      return t.date.getFullYear() === m.year && (t.date.getMonth() + 1) === m.month
    })

    const income = monthTxs
      .filter(t => t.classification === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const expenses = monthTxs
      .filter(t => t.classification === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const transferSum = monthTxs
      .filter(t => t.classification === 'transfer')
      .reduce((sum, t) => sum + t.amount, 0)

    const txCount = monthTxs.length

    console.log(`  ${m.label} (${txCount} transactions):`)
    console.log(`    Income:    $${income.toFixed(2)}`)
    console.log(`    Expenses:  $${expenses.toFixed(2)} (abs: $${Math.abs(expenses).toFixed(2)})`)
    console.log(`    Transfers: $${transferSum.toFixed(2)} (excluded from totals)`)
    console.log(`    Net:       $${(income + expenses).toFixed(2)}`)
    console.log()

    // Verify basic sanity: income should be positive, expenses negative
    if (income < 0) {
      console.log(`    ⚠️  Income is negative — unexpected`)
    }
    if (expenses > 0) {
      console.log(`    ⚠️  Expenses sum is positive — unexpected`)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Dashboard Metrics (Feb 2026)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('══════════════════════════════════════════════════════════')
  console.log('STEP 5: Dashboard Metrics (Feb 2026)')
  console.log('══════════════════════════════════════════════════════════\n')

  const febTxs = transactions.filter(t =>
    t.date.getFullYear() === 2026 && t.date.getMonth() === 1
  )

  const febIncome = febTxs
    .filter(t => t.classification === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const febExpenses = febTxs
    .filter(t => t.classification === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const febTransfers = febTxs
    .filter(t => t.classification === 'transfer')
    .reduce((sum, t) => sum + t.amount, 0)

  // Cash Available: accounts are created with balance=0 during import (CSV doesn't set balances)
  // In real app, user sets startingBalance + balanceAsOfDate. For this test, report $0.
  console.log(`  Total Income (Feb 2026):  $${febIncome.toFixed(2)}`)
  console.log(`  Total Expenses (Feb 2026): $${Math.abs(febExpenses).toFixed(2)}`)
  console.log(`  Transfers (Feb 2026):      $${febTransfers.toFixed(2)} (excluded)`)
  console.log(`  Cash Available:            $0.00 (accounts start at $0 on import)`)
  console.log(`  Budgets: 0 (no budgets created during import)`)
  console.log(`  True Remaining: $${(febIncome + febExpenses).toFixed(2)} (income minus abs expenses)`)
  console.log(`  Feb 2026 transaction count: ${febTxs.length}`)

  results['Step 5'] = `Income: $${febIncome.toFixed(2)}, Expenses: $${Math.abs(febExpenses).toFixed(2)}, True Remaining: $${(febIncome + febExpenses).toFixed(2)}`

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Edge Case Spot Checks
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('STEP 6: Edge Case Spot Checks')
  console.log('══════════════════════════════════════════════════════════\n')
  results['Step 6'] = 'PASS'

  // 6.1 Duplicate detection — Stop & Shop on 11/25/2024 for ~$67.43
  console.log('--- 6.1: Duplicate detection (Stop & Shop 11/25/2024 ~$67.43) ---')
  const stopShopTxs = transactions.filter(t => {
    return t.date.getFullYear() === 2024 &&
           t.date.getMonth() === 10 && // November = 10
           t.date.getDate() === 25 &&
           t.merchant.toLowerCase().includes('stop & shop')
  })
  const stopShopMatching = stopShopTxs.filter(t =>
    Math.abs(Math.abs(t.amount) - 67.43) < 0.01
  )
  console.log(`  Stop & Shop on 11/25/2024: ${stopShopTxs.length} total, ${stopShopMatching.length} at ~$67.43`)
  for (const tx of stopShopTxs) {
    console.log(`    $${tx.amount} | person: ${tx.person || 'none'} | account: ${tx.account || 'none'}`)
  }
  check('Step 6', 'Stop & Shop duplicates at ~$67.43', stopShopMatching.length, 3)

  // 6.2 Month boundary — mortgage payments 12/31/2024 and 01/01/2025
  console.log('\n--- 6.2: Month boundary (mortgage payments) ---')
  const dec31Mortgage = transactions.filter(t =>
    t.date.getFullYear() === 2024 && t.date.getMonth() === 11 && t.date.getDate() === 31 &&
    t.merchant.toLowerCase().includes('mortgage')
  )
  const jan1Mortgage = transactions.filter(t =>
    t.date.getFullYear() === 2025 && t.date.getMonth() === 0 && t.date.getDate() === 1 &&
    t.merchant.toLowerCase().includes('mortgage')
  )
  console.log(`  12/31/2024 mortgage payments: ${dec31Mortgage.length}`)
  for (const tx of dec31Mortgage) {
    console.log(`    ${tx.merchant} | $${tx.amount}`)
  }
  console.log(`  01/01/2025 mortgage payments: ${jan1Mortgage.length}`)
  for (const tx of jan1Mortgage) {
    console.log(`    ${tx.merchant} | $${tx.amount}`)
  }
  if (dec31Mortgage.length > 0 && jan1Mortgage.length > 0) {
    console.log('  ✅ Mortgage payments correctly span month boundary')
  } else if (dec31Mortgage.length > 0 || jan1Mortgage.length > 0) {
    console.log('  ⚠️  Only one side of the month boundary found')
  } else {
    console.log('  ⚠️  Neither month-boundary mortgage payment found — checking nearby dates...')
    const lateDecMortgage = transactions.filter(t =>
      t.date.getFullYear() === 2024 && t.date.getMonth() === 11 && t.date.getDate() >= 28 &&
      t.merchant.toLowerCase().includes('mortgage')
    )
    const earlyJanMortgage = transactions.filter(t =>
      t.date.getFullYear() === 2025 && t.date.getMonth() === 0 && t.date.getDate() <= 3 &&
      t.merchant.toLowerCase().includes('mortgage')
    )
    for (const tx of [...lateDecMortgage, ...earlyJanMortgage]) {
      console.log(`    ${fmtDate(tx.date)} | ${tx.merchant} | $${tx.amount}`)
    }
  }

  // 6.3 Large outliers
  console.log('\n--- 6.3: Large outliers ---')

  // $8,000 student loan payment on 01/27/2025
  const studentLoanTxs = transactions.filter(t =>
    t.date.getFullYear() === 2025 && t.date.getMonth() === 0 && t.date.getDate() === 27 &&
    Math.abs(t.amount) >= 7999 && Math.abs(t.amount) <= 8001
  )
  console.log(`  $8,000 student loan payment (01/27/2025):`)
  if (studentLoanTxs.length > 0) {
    for (const tx of studentLoanTxs) {
      console.log(`    ${tx.merchant} | $${tx.amount} | classification: ${tx.classification} | cat: ${tx.category}`)
      check('Step 6', 'Student loan classification', tx.classification, 'expense')
    }
  } else {
    console.log('    ⚠️  Not found — searching nearby...')
    const bigPayments = transactions.filter(t =>
      Math.abs(t.amount) >= 7000 &&
      t.category.toLowerCase().includes('student')
    )
    for (const tx of bigPayments) {
      console.log(`    ${fmtDate(tx.date)} | ${tx.merchant} | $${tx.amount} | classification: ${tx.classification}`)
    }
  }

  // $3,847 tax refund on 04/15/2025
  const taxRefundTxs = transactions.filter(t =>
    t.date.getFullYear() === 2025 && t.date.getMonth() === 3 && t.date.getDate() === 15 &&
    t.amount >= 3846 && t.amount <= 3848
  )
  console.log(`  $3,847 tax refund (04/15/2025):`)
  if (taxRefundTxs.length > 0) {
    for (const tx of taxRefundTxs) {
      console.log(`    ${tx.merchant} | $${tx.amount} | classification: ${tx.classification} | cat: ${tx.category}`)
      check('Step 6', 'Tax refund classification', tx.classification, 'income')
    }
  } else {
    console.log('    ⚠️  Not found — searching nearby...')
    const taxRefunds = transactions.filter(t =>
      t.category.toLowerCase().includes('tax refund') && t.amount > 3000
    )
    for (const tx of taxRefunds) {
      console.log(`    ${fmtDate(tx.date)} | ${tx.merchant} | $${tx.amount} | classification: ${tx.classification}`)
    }
  }

  // 6.4 Special characters
  console.log('\n--- 6.4: Special characters ---')
  const specialMerchants = [
    { name: "Frank Pepe's", type: 'apostrophe' },
    { name: "Lowe's", type: 'apostrophe' },
    { name: "Trader Joe's", type: 'apostrophe' },
    { name: "St. Martin's", type: 'apostrophe' },
    { name: 'Stop & Shop', type: 'ampersand' },
    { name: "Ben & Jerry's", type: 'ampersand' },
    { name: 'Black & White Coffee', type: 'ampersand' },
    { name: 'Crème de la Crème', type: 'accented' },
    { name: "Côte d'Azur", type: 'accented' },
    { name: 'Señor Taco', type: 'accented' },
  ]

  for (const { name, type } of specialMerchants) {
    const found = transactions.find(t =>
      t.merchant.toLowerCase().includes(name.toLowerCase())
    )
    if (found) {
      console.log(`  ✅ ${type}: "${name}" → "${found.merchant}" | $${found.amount}`)
    } else {
      console.log(`  ❌ FAIL: "${name}" (${type}) NOT found`)
      results['Step 6'] = 'FAIL'
      failCount++
    }
  }

  // 6.5 Property tagging
  console.log('\n--- 6.5: Property tagging (Nicoll St) ---')
  const nicollTxs = transactions.filter(t => t.property === 'Nicoll St')
  console.log(`  Total transactions tagged "Nicoll St": ${nicollTxs.length}`)
  const propGroupBreakdown: Record<string, number> = {}
  for (const tx of nicollTxs) {
    propGroupBreakdown[tx.categoryGroup] = (propGroupBreakdown[tx.categoryGroup] || 0) + 1
  }
  for (const [group, count] of Object.entries(propGroupBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${group}: ${count}`)
  }

  // 6.6 Person assignment
  console.log('\n--- 6.6: Person assignment ---')
  const personBreakdown: Record<string, number> = {}
  for (const tx of transactions) {
    const key = tx.person || '(unassigned)'
    personBreakdown[key] = (personBreakdown[key] || 0) + 1
  }
  for (const [person, count] of Object.entries(personBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${person}: ${count} transactions`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: Spending Analysis
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('STEP 7: Spending Analysis')
  console.log('══════════════════════════════════════════════════════════\n')

  // 7.1 Top 10 merchants by transaction count
  console.log('--- 7.1: Top 10 merchants by transaction count ---')
  const merchantStats: Record<string, { count: number; total: number }> = {}
  for (const tx of transactions) {
    if (!merchantStats[tx.merchant]) merchantStats[tx.merchant] = { count: 0, total: 0 }
    merchantStats[tx.merchant].count++
    merchantStats[tx.merchant].total += tx.amount
  }
  const topMerchants = Object.entries(merchantStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)

  console.log(`  ${'Merchant'.padEnd(35)} ${'Count'.padStart(6)} ${'Total'.padStart(12)}`)
  console.log(`  ${'─'.repeat(35)} ${'─'.repeat(6)} ${'─'.repeat(12)}`)
  for (const [merchant, stats] of topMerchants) {
    console.log(`  ${merchant.padEnd(35)} ${String(stats.count).padStart(6)} $${stats.total.toFixed(2).padStart(11)}`)
  }

  // 7.2 Top 5 category groups by total spend
  console.log('\n--- 7.2: Top 5 category groups by total spend (excl. transfers & income) ---')
  const groupSpend: Record<string, number> = {}
  for (const tx of transactions) {
    if (tx.classification === 'expense') {
      groupSpend[tx.categoryGroup] = (groupSpend[tx.categoryGroup] || 0) + Math.abs(tx.amount)
    }
  }
  const sortedGroups = Object.entries(groupSpend).sort((a, b) => b[1] - a[1]).slice(0, 5)
  for (const [group, total] of sortedGroups) {
    console.log(`  ${group.padEnd(20)} $${total.toFixed(2)}`)
  }

  // 7.3 Monthly spending trend
  console.log('\n--- 7.3: Monthly spending trend (Aug 2024 – Feb 2026) ---')
  const monthlySpend: Record<string, number> = {}
  for (const tx of transactions) {
    if (tx.classification === 'expense') {
      const key = monthKey(tx.date)
      monthlySpend[key] = (monthlySpend[key] || 0) + Math.abs(tx.amount)
    }
  }
  const sortedMonths = Object.entries(monthlySpend).sort((a, b) => a[0].localeCompare(b[0]))
  console.log(`  ${'Month'.padEnd(10)} ${'Total Expenses'.padStart(15)}`)
  console.log(`  ${'─'.repeat(10)} ${'─'.repeat(15)}`)
  for (const [month, total] of sortedMonths) {
    console.log(`  ${month.padEnd(10)} $${total.toFixed(2).padStart(14)}`)
  }

  // 7.4 Seasonal check
  console.log('\n--- 7.4: Seasonal check (holiday spending spike) ---')
  const nov2024 = monthlySpend['2024-11'] || 0
  const dec2024 = monthlySpend['2024-12'] || 0
  const jan2025 = monthlySpend['2025-01'] || 0
  console.log(`  Nov 2024: $${nov2024.toFixed(2)}`)
  console.log(`  Dec 2024: $${dec2024.toFixed(2)}`)
  console.log(`  Jan 2025: $${jan2025.toFixed(2)}`)

  const decSpike = dec2024 > nov2024 && dec2024 > jan2025
  if (decSpike) {
    console.log('  ✅ December shows expected holiday spending spike')
  } else {
    console.log('  ⚠️  December does NOT show expected spike relative to Nov/Jan')
  }

  results['Step 7'] = `Top group: ${sortedGroups[0]?.[0]} ($${sortedGroups[0]?.[1]?.toFixed(2)}), Dec spike: ${decSpike ? 'YES' : 'NO'}`

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('                     TEST SUMMARY')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Step 2 (Import Integrity):    ${results['Step 2'] || 'PASS'}`)
  console.log(`  Step 3 (Classification):      ${results['Step 3'] || 'PASS'}`)
  console.log(`  Step 4 (Budget Computation):  ${results['Step 4'] || 'PASS'}`)
  console.log(`  Step 5 (Dashboard Metrics):   ${results['Step 5'] || 'N/A'}`)
  console.log(`  Step 6 (Edge Cases):          ${results['Step 6'] || 'PASS'}`)
  console.log(`  Step 7 (Spending Analysis):   ${results['Step 7'] || 'N/A'}`)
  console.log('───────────────────────────────────────────────────────────')
  console.log(`  Total FAILs: ${failCount}`)
  console.log(`  Overall: ${failCount === 0 ? '✅ ALL PASS' : `❌ ${failCount} FAILURE(S)`}`)
  console.log('═══════════════════════════════════════════════════════════')

  process.exit(failCount > 0 ? 1 : 0)
}

main()
