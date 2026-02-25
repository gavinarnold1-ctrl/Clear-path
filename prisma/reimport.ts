/**
 * NUKE AND REIMPORT — Data Integrity Rebuild
 *
 * Deletes all existing transactions, categories, accounts, budgets,
 * and household members for the user, then reimports from the CSV.
 *
 * Run with: npx tsx prisma/reimport.ts
 */
import { PrismaClient, AccountType } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const db = new PrismaClient()

// ─── Account mapping ─────────────────────────────────────────────────────────

const ACCOUNT_MAP: Record<string, AccountType> = {
  'Platinum Card® (...3008)': 'CREDIT_CARD',
  'Platinum Card (...3008)': 'CREDIT_CARD',
  'Adv Plus Banking (...6809)': 'CHECKING',
  'CREDIT CARD (...9318)': 'CREDIT_CARD',
  'Delta SkyMiles® Platinum Card (...1007)': 'CREDIT_CARD',
  'Delta SkyMiles Platinum Card (...1007)': 'CREDIT_CARD',
  'CREDIT CARD (...6798)': 'CREDIT_CARD',
  'Rewards Checking (...8503)': 'CHECKING',
  'Delta SkyMiles® Gold Card (...1006)': 'CREDIT_CARD',
  'Delta SkyMiles Gold Card (...1006)': 'CREDIT_CARD',
  'Venture X (...3346)': 'CREDIT_CARD',
  'CHECKING (...0282)': 'CHECKING',
  'SAVINGS (...6118)': 'SAVINGS',
  'Individual (...*****6265)': 'INVESTMENT',
  'WEBSTER BANK RETIREMENT SAVINGS PLAN (...*****4690)': 'INVESTMENT',
  'Customized Cash Rewards Visa Signature (...0391)': 'CREDIT_CARD',
}

// ─── Category → Group mapping (Task 2) ───────────────────────────────────────

const CATEGORY_GROUP_MAP: Record<string, string> = {
  // Housing
  'Mortgage': 'Housing',
  'Rent': 'Housing',
  'Home Improvement': 'Housing',
  'Furniture & Housewares': 'Housing',

  // Utilities
  'Gas & Electric': 'Utilities',
  'Water': 'Utilities',
  'Garbage': 'Utilities',
  'Internet & Cable': 'Utilities',
  'Phone': 'Utilities',

  // Food
  'Groceries': 'Food',
  'Restaurants & Bars': 'Food',
  'Coffee Shops': 'Food',

  // Transport
  'Gas': 'Transport',
  'Auto Maintenance': 'Transport',
  'Auto Payment': 'Transport',
  'Parking & Tolls': 'Transport',
  'Taxi & Ride Shares': 'Transport',
  'Public Transit': 'Transport',

  // Insurance
  'Insurance': 'Insurance',

  // Healthcare
  'Medical': 'Healthcare',
  'Dentist': 'Healthcare',
  'Fitness': 'Healthcare',

  // Personal
  'Clothing': 'Personal',
  'Personal': 'Personal',
  'Shopping': 'Personal',
  'Electronics': 'Personal',
  'Education': 'Personal',
  'Gifts': 'Personal',
  'Charity': 'Personal',

  // Entertainment
  'Entertainment & Recreation': 'Entertainment',
  'Travel & Vacation': 'Entertainment',
  'Pets': 'Entertainment',

  // Financial
  'Financial Fees': 'Financial',
  'Financial & Legal Services': 'Financial',
  'Loan Repayment': 'Financial',
  'Student Loans': 'Financial',

  // Income
  'Paychecks': 'Income',
  'Other Income': 'Income',
  'Interest': 'Income',
  'Dividends & Capital Gains': 'Income',

  // Transfers
  'Transfer': 'Transfers',
  'Credit Card Payment': 'Transfers',

  // Other
  'Miscellaneous': 'Other',
  'Cash & ATM': 'Other',
  'Uncategorized': 'Other',
  'Postage & Shipping': 'Other',
  'Office Supplies & Expenses': 'Other',
  'Taxes': 'Other',
  'Wedding': 'Other',
  'Business Utilities & Communication': 'Other',
  'Buy': 'Other',
}

// ─── Classification rules (Task 3) ───────────────────────────────────────────

function classifyTransaction(categoryName: string, group: string, amount: number): string {
  // Rule: Transfer group → always "transfer"
  if (group === 'Transfers') return 'transfer'

  // Rule: Income group AND amount > 0 → "income"
  if (group === 'Income' && amount > 0) return 'income'

  // Edge case: Income group but negative amount → "expense"
  // (e.g., "Other Income" with negative amounts like Ui Web Payment)
  if (group === 'Income' && amount <= 0) return 'expense'

  // Everything else → "expense"
  return 'expense'
}

// ─── Category type from group ────────────────────────────────────────────────

function categoryTypeFromGroup(group: string): string {
  if (group === 'Income') return 'income'
  if (group === 'Transfers') return 'transfer'
  return 'expense'
}

// ─── CSV parser ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  fields.push(current)
  return fields
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Find the target user (most recently created, or the first one)
  const user = await db.user.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!user) {
    console.error('No user found in database. Please register a user first.')
    process.exit(1)
  }
  console.log(`Target user: ${user.email} (${user.id})`)

  // ─── Step 0: Read CSV ────────────────────────────────────────────────────
  const csvPath = path.join(__dirname, '../docs/Transactions_2026-02-21T21-30-39.csv')
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at ${csvPath}`)
    process.exit(1)
  }
  const rawCSV = fs.readFileSync(csvPath, 'utf-8')
  const lines = rawCSV.split('\n').filter(l => l.trim())
  const header = parseCSVLine(lines[0])
  console.log(`CSV columns: ${header.join(', ')}`)
  console.log(`CSV rows: ${lines.length - 1}`)

  // Map column indices
  const colIdx: Record<string, number> = {}
  header.forEach((h, i) => { colIdx[h.trim()] = i })

  // Parse all rows
  const rows = lines.slice(1).map(line => {
    const fields = parseCSVLine(line)
    return {
      date: fields[colIdx['Date']]?.trim() ?? '',
      merchant: fields[colIdx['Merchant']]?.trim() ?? '',
      category: fields[colIdx['Category']]?.trim() ?? '',
      account: fields[colIdx['Account']]?.trim() ?? '',
      originalStatement: fields[colIdx['Original Statement']]?.trim() ?? '',
      notes: fields[colIdx['Notes']]?.trim() ?? '',
      amount: parseFloat(fields[colIdx['Amount']]?.trim() ?? '0'),
      tags: fields[colIdx['Tags']]?.trim() ?? '',
      owner: fields[colIdx['Owner']]?.trim() ?? '',
    }
  }).filter(r => r.date && !isNaN(r.amount))

  console.log(`Parsed ${rows.length} valid transactions`)

  // ─── Step 1: NUKE all user data ──────────────────────────────────────────
  console.log('\n=== NUKING existing user data ===')

  // Delete in dependency order
  await db.monthlySnapshot.deleteMany({ where: { userId: user.id } })
  await db.efficiencyScore.deleteMany({ where: { userId: user.id } })
  await db.insightFeedback.deleteMany({ where: { userId: user.id } })
  await db.insight.deleteMany({ where: { userId: user.id } })
  // AnnualExpenses reference budgets, transactions reference annualExpenses
  await db.transaction.deleteMany({ where: { userId: user.id } })
  await db.annualExpense.deleteMany({ where: { userId: user.id } })
  await db.budget.deleteMany({ where: { userId: user.id } })
  await db.debt.deleteMany({ where: { userId: user.id } })
  await db.account.deleteMany({ where: { userId: user.id } })
  // Categories: delete user-created ones (userId = user.id)
  await db.category.deleteMany({ where: { userId: user.id } })
  await db.property.deleteMany({ where: { userId: user.id } })
  await db.householdMember.deleteMany({ where: { userId: user.id } })
  console.log('All user data deleted.')

  // ─── Step 2: Create household members (Task 7) ───────────────────────────
  console.log('\n=== Creating household members ===')
  const gavinMember = await db.householdMember.create({
    data: { userId: user.id, name: 'Gavin Arnold', isDefault: true },
  })
  const carolineMember = await db.householdMember.create({
    data: { userId: user.id, name: 'Caroline', isDefault: false },
  })
  console.log(`Created: Gavin Arnold (${gavinMember.id}), Caroline (${carolineMember.id})`)

  // Owner mapping
  const ownerMap: Record<string, string> = {
    'Gavin Arnold': gavinMember.id,
    'gavin arnold': gavinMember.id,
    'Cgrubbs14': carolineMember.id,
    'cgrubbs14': carolineMember.id,
  }

  // ─── Step 3: Create accounts from CSV (Task 1) ───────────────────────────
  console.log('\n=== Creating accounts ===')
  const uniqueAccounts = [...new Set(rows.map(r => r.account).filter(Boolean))]
  const accountIdMap = new Map<string, string>()

  for (const acctName of uniqueAccounts) {
    // Find matching type
    let acctType: AccountType = 'CHECKING'
    for (const [pattern, type] of Object.entries(ACCOUNT_MAP)) {
      if (acctName === pattern || acctName.replace(/[®™]/g, '') === pattern) {
        acctType = type
        break
      }
    }
    // Fallback type inference from name
    const lower = acctName.toLowerCase()
    if (lower.includes('credit card') || lower.includes('platinum card') || lower.includes('gold card') || lower.includes('venture') || lower.includes('rewards visa')) {
      acctType = 'CREDIT_CARD'
    } else if (lower.includes('savings')) {
      acctType = 'SAVINGS'
    } else if (lower.includes('individual') || lower.includes('retirement')) {
      acctType = 'INVESTMENT'
    }

    const account = await db.account.create({
      data: {
        userId: user.id,
        name: acctName,
        type: acctType,
        balance: 0,
      },
    })
    accountIdMap.set(acctName, account.id)
    console.log(`  ${acctName} → ${acctType} (${account.id})`)
  }

  // ─── Step 4: Create categories with groups (Task 2) ───────────────────────
  console.log('\n=== Creating categories ===')
  const uniqueCategories = [...new Set(rows.map(r => r.category).filter(Boolean))]
  const categoryIdMap = new Map<string, string>()

  for (const catName of uniqueCategories) {
    const group = CATEGORY_GROUP_MAP[catName] ?? 'Other'
    const type = categoryTypeFromGroup(group)

    const category = await db.category.create({
      data: {
        userId: user.id,
        name: catName,
        type,
        group,
        isDefault: false,
      },
    })
    categoryIdMap.set(catName, category.id)
    console.log(`  ${catName} → ${group} (${type})`)
  }

  // ─── Step 5: Import transactions (Task 1 + Task 3) ────────────────────────
  console.log('\n=== Importing transactions ===')

  const BATCH_SIZE = 500
  let imported = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    const data = batch.map(row => {
      const categoryId = categoryIdMap.get(row.category) ?? null
      const accountId = accountIdMap.get(row.account) ?? null
      const group = CATEGORY_GROUP_MAP[row.category] ?? 'Other'

      // Classification (Task 3) — store amounts exactly as they appear in CSV
      const classification = classifyTransaction(row.category, group, row.amount)

      // Map owner
      const ownerId = ownerMap[row.owner] ?? ownerMap[row.owner.toLowerCase()] ?? null

      return {
        userId: user.id,
        date: new Date(row.date),
        merchant: row.merchant,
        amount: row.amount, // Store exactly as CSV — NO sign flipping
        classification,
        categoryId,
        accountId,
        originalStatement: row.originalStatement || null,
        originalCategory: row.category || null,
        notes: row.notes || null,
        tags: row.tags || null,
        householdMemberId: ownerId,
        importSource: 'csv',
      }
    })

    await db.transaction.createMany({ data })
    imported += batch.length
    console.log(`  Imported ${imported}/${rows.length}`)
  }

  // ─── Step 6: Verification ─────────────────────────────────────────────────
  console.log('\n=== Verification ===')

  const totalTx = await db.transaction.count({ where: { userId: user.id } })
  console.log(`Total transactions: ${totalTx}`)

  const totalAccounts = await db.account.count({ where: { userId: user.id } })
  console.log(`Total accounts: ${totalAccounts}`)

  const totalCategories = await db.category.count({ where: { userId: user.id } })
  console.log(`Total categories: ${totalCategories}`)

  const totalMembers = await db.householdMember.count({ where: { userId: user.id } })
  console.log(`Total household members: ${totalMembers}`)

  // Feb 2026 numbers
  const feb2026Start = new Date('2026-02-01')
  const feb2026End = new Date('2026-02-28T23:59:59.999Z')

  const febIncome = await db.transaction.aggregate({
    where: { userId: user.id, date: { gte: feb2026Start, lte: feb2026End }, classification: 'income' },
    _sum: { amount: true },
  })
  console.log(`Feb 2026 income (classification=income): $${(febIncome._sum.amount ?? 0).toFixed(2)}`)

  const febExpense = await db.transaction.aggregate({
    where: { userId: user.id, date: { gte: feb2026Start, lte: feb2026End }, classification: 'expense' },
    _sum: { amount: true },
  })
  console.log(`Feb 2026 expenses (classification=expense): $${(febExpense._sum.amount ?? 0).toFixed(2)}`)

  const febTransfer = await db.transaction.count({
    where: { userId: user.id, date: { gte: feb2026Start, lte: feb2026End }, classification: 'transfer' },
  })
  console.log(`Feb 2026 transfer transactions: ${febTransfer}`)

  // Jan 2026 paychecks
  const jan2026Start = new Date('2026-01-01')
  const jan2026End = new Date('2026-01-31T23:59:59.999Z')
  const janPaychecks = await db.transaction.aggregate({
    where: {
      userId: user.id,
      date: { gte: jan2026Start, lte: jan2026End },
      category: { name: 'Paychecks' },
    },
    _sum: { amount: true },
    _count: true,
  })
  console.log(`Jan 2026 Paychecks: $${(janPaychecks._sum.amount ?? 0).toFixed(2)} (${janPaychecks._count} transactions)`)

  // Jan 2026 student loan
  const janStudentLoan = await db.transaction.findMany({
    where: {
      userId: user.id,
      date: { gte: jan2026Start, lte: jan2026End },
      category: { name: 'Student Loans' },
    },
    select: { date: true, merchant: true, amount: true },
  })
  console.log(`Jan 2026 Student Loans:`)
  for (const sl of janStudentLoan) {
    console.log(`  ${sl.date.toISOString().split('T')[0]} ${sl.merchant}: $${sl.amount.toFixed(2)}`)
  }

  // Classification counts
  const classificationCounts = await db.transaction.groupBy({
    by: ['classification'],
    where: { userId: user.id },
    _count: true,
  })
  console.log('\nClassification breakdown:')
  for (const c of classificationCounts) {
    console.log(`  ${c.classification}: ${c._count}`)
  }

  // Category group counts
  const groups = await db.category.groupBy({
    by: ['group'],
    where: { userId: user.id },
    _count: true,
  })
  console.log(`\nCategory groups (${groups.length}):`)
  for (const g of groups) {
    console.log(`  ${g.group}: ${g._count} categories`)
  }

  console.log('\n=== Import complete ===')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
