import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import type { AccountType } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

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

// ─── Category → Group mapping ────────────────────────────────────────────────

const CATEGORY_GROUP_MAP: Record<string, string> = {
  'Mortgage': 'Housing',
  'Rent': 'Housing',
  'Home Improvement': 'Housing',
  'Furniture & Housewares': 'Housing',
  'Gas & Electric': 'Utilities',
  'Water': 'Utilities',
  'Garbage': 'Utilities',
  'Internet & Cable': 'Utilities',
  'Phone': 'Utilities',
  'Groceries': 'Food',
  'Restaurants & Bars': 'Food',
  'Coffee Shops': 'Food',
  'Gas': 'Transport',
  'Auto Maintenance': 'Transport',
  'Auto Payment': 'Transport',
  'Parking & Tolls': 'Transport',
  'Taxi & Ride Shares': 'Transport',
  'Public Transit': 'Transport',
  'Insurance': 'Insurance',
  'Medical': 'Healthcare',
  'Dentist': 'Healthcare',
  'Fitness': 'Healthcare',
  'Clothing': 'Personal',
  'Personal': 'Personal',
  'Shopping': 'Personal',
  'Electronics': 'Personal',
  'Education': 'Personal',
  'Gifts': 'Personal',
  'Charity': 'Personal',
  'Entertainment & Recreation': 'Entertainment',
  'Travel & Vacation': 'Entertainment',
  'Pets': 'Entertainment',
  'Financial Fees': 'Financial',
  'Financial & Legal Services': 'Financial',
  'Loan Repayment': 'Financial',
  'Student Loans': 'Financial',
  'Paychecks': 'Income',
  'Other Income': 'Income',
  'Interest': 'Income',
  'Dividends & Capital Gains': 'Income',
  'Transfer': 'Transfers',
  'Credit Card Payment': 'Transfers',
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

function classifyTransaction(group: string, amount: number): string {
  if (group === 'Transfers') return 'transfer'
  if (group === 'Income' && amount > 0) return 'income'
  if (group === 'Income' && amount <= 0) return 'expense'
  return 'expense'
}

function categoryTypeFromGroup(group: string): string {
  if (group === 'Income') return 'income'
  if (group === 'Transfers') return 'transfer'
  return 'expense'
}

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

// POST /api/reimport — Nuke all user data and reimport from CSV
export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const userId = session.userId

  const log: string[] = []
  const addLog = (msg: string) => {
    log.push(msg)
    console.log(msg)
  }

  try {
    // ─── Read CSV ──────────────────────────────────────────────────────────
    // Try multiple paths — process.cwd() differs between local dev and Vercel serverless
    const csvName = 'docs/Transactions_2026-02-21T21-30-39.csv'
    const candidates = [
      path.join(process.cwd(), csvName),
      path.resolve(csvName),
      path.join(__dirname, '..', '..', '..', '..', csvName),
    ]
    const csvPath = candidates.find(p => fs.existsSync(p))
    if (!csvPath) {
      return NextResponse.json({
        error: 'CSV file not found',
        tried: candidates,
        cwd: process.cwd(),
      }, { status: 404 })
    }
    const rawCSV = fs.readFileSync(csvPath, 'utf-8')
    const lines = rawCSV.split('\n').filter(l => l.trim())
    const header = parseCSVLine(lines[0])
    addLog(`CSV columns: ${header.join(', ')}`)
    addLog(`CSV rows: ${lines.length - 1}`)

    const colIdx: Record<string, number> = {}
    header.forEach((h, i) => { colIdx[h.trim()] = i })

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

    addLog(`Parsed ${rows.length} valid transactions`)

    // ─── NUKE all user data ────────────────────────────────────────────────
    addLog('=== NUKING existing user data ===')
    await db.monthlySnapshot.deleteMany({ where: { userId } })
    await db.efficiencyScore.deleteMany({ where: { userId } })
    await db.insightFeedback.deleteMany({ where: { userId } })
    await db.insight.deleteMany({ where: { userId } })
    await db.transaction.deleteMany({ where: { userId } })
    await db.annualExpense.deleteMany({ where: { userId } })
    await db.budget.deleteMany({ where: { userId } })
    await db.debt.deleteMany({ where: { userId } })
    await db.account.deleteMany({ where: { userId } })
    await db.category.deleteMany({ where: { userId } })
    await db.property.deleteMany({ where: { userId } })
    await db.householdMember.deleteMany({ where: { userId } })
    addLog('All user data deleted.')

    // ─── Create household members ──────────────────────────────────────────
    addLog('=== Creating household members ===')
    const gavinMember = await db.householdMember.create({
      data: { userId, name: 'Gavin Arnold', isDefault: true },
    })
    const carolineMember = await db.householdMember.create({
      data: { userId, name: 'Caroline', isDefault: false },
    })
    addLog(`Created: Gavin Arnold (${gavinMember.id}), Caroline (${carolineMember.id})`)

    const ownerMap: Record<string, string> = {
      'Gavin Arnold': gavinMember.id,
      'gavin arnold': gavinMember.id,
      'Cgrubbs14': carolineMember.id,
      'cgrubbs14': carolineMember.id,
    }

    // ─── Create accounts ───────────────────────────────────────────────────
    addLog('=== Creating accounts ===')
    const uniqueAccounts = [...new Set(rows.map(r => r.account).filter(Boolean))]
    const accountIdMap = new Map<string, string>()

    for (const acctName of uniqueAccounts) {
      let acctType: AccountType = 'CHECKING'
      for (const [pattern, type] of Object.entries(ACCOUNT_MAP)) {
        if (acctName === pattern || acctName.replace(/[®™]/g, '') === pattern) {
          acctType = type
          break
        }
      }
      const lower = acctName.toLowerCase()
      if (lower.includes('credit card') || lower.includes('platinum card') || lower.includes('gold card') || lower.includes('venture') || lower.includes('rewards visa')) {
        acctType = 'CREDIT_CARD'
      } else if (lower.includes('savings')) {
        acctType = 'SAVINGS'
      } else if (lower.includes('individual') || lower.includes('retirement')) {
        acctType = 'INVESTMENT'
      }

      const account = await db.account.create({
        data: { userId, name: acctName, type: acctType, balance: 0 },
      })
      accountIdMap.set(acctName, account.id)
      addLog(`  ${acctName} → ${acctType}`)
    }

    // ─── Create categories with groups ─────────────────────────────────────
    addLog('=== Creating categories ===')
    const uniqueCategories = [...new Set(rows.map(r => r.category).filter(Boolean))]
    const categoryIdMap = new Map<string, string>()

    for (const catName of uniqueCategories) {
      const group = CATEGORY_GROUP_MAP[catName] ?? 'Other'
      const type = categoryTypeFromGroup(group)

      const category = await db.category.create({
        data: { userId, name: catName, type, group, isDefault: false },
      })
      categoryIdMap.set(catName, category.id)
      addLog(`  ${catName} → ${group} (${type})`)
    }

    // ─── Import transactions ───────────────────────────────────────────────
    addLog('=== Importing transactions ===')
    const BATCH_SIZE = 500
    let imported = 0

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)

      const data = batch.map(row => {
        const categoryId = categoryIdMap.get(row.category) ?? null
        const accountId = accountIdMap.get(row.account) ?? null
        const group = CATEGORY_GROUP_MAP[row.category] ?? 'Other'
        const classification = classifyTransaction(group, row.amount)
        const ownerId = ownerMap[row.owner] ?? ownerMap[row.owner.toLowerCase()] ?? null

        return {
          userId,
          date: new Date(row.date),
          merchant: row.merchant,
          amount: row.amount,
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
      addLog(`  Imported ${imported}/${rows.length}`)
    }

    // ─── Verification ──────────────────────────────────────────────────────
    addLog('=== Verification ===')

    const totalTx = await db.transaction.count({ where: { userId } })
    addLog(`Total transactions: ${totalTx}`)

    const totalAccounts = await db.account.count({ where: { userId } })
    addLog(`Total accounts: ${totalAccounts}`)

    const totalCategories = await db.category.count({ where: { userId } })
    addLog(`Total categories: ${totalCategories}`)

    const totalMembers = await db.householdMember.count({ where: { userId } })
    addLog(`Total household members: ${totalMembers}`)

    const feb2026Start = new Date('2026-02-01')
    const feb2026End = new Date('2026-02-28T23:59:59.999Z')

    const febIncome = await db.transaction.aggregate({
      where: { userId, date: { gte: feb2026Start, lte: feb2026End }, classification: 'income' },
      _sum: { amount: true },
    })
    addLog(`Feb 2026 income: $${(febIncome._sum.amount ?? 0).toFixed(2)}`)

    const febExpense = await db.transaction.aggregate({
      where: { userId, date: { gte: feb2026Start, lte: feb2026End }, classification: 'expense' },
      _sum: { amount: true },
    })
    addLog(`Feb 2026 expenses: $${(febExpense._sum.amount ?? 0).toFixed(2)}`)

    const jan2026Start = new Date('2026-01-01')
    const jan2026End = new Date('2026-01-31T23:59:59.999Z')
    const janPaychecks = await db.transaction.aggregate({
      where: { userId, date: { gte: jan2026Start, lte: jan2026End }, category: { name: 'Paychecks' } },
      _sum: { amount: true },
      _count: true,
    })
    addLog(`Jan 2026 Paychecks: $${(janPaychecks._sum.amount ?? 0).toFixed(2)} (${janPaychecks._count} transactions)`)

    const classificationCounts = await db.transaction.groupBy({
      by: ['classification'],
      where: { userId },
      _count: true,
    })
    addLog('Classification breakdown:')
    for (const c of classificationCounts) {
      addLog(`  ${c.classification}: ${c._count}`)
    }

    const groups = await db.category.groupBy({
      by: ['group'],
      where: { userId },
      _count: true,
    })
    addLog(`Category groups (${groups.length}):`)
    for (const g of groups) {
      addLog(`  ${g.group}: ${g._count} categories`)
    }

    addLog('=== Import complete ===')

    return NextResponse.json({
      success: true,
      summary: {
        transactions: totalTx,
        accounts: totalAccounts,
        categories: totalCategories,
        householdMembers: totalMembers,
        febIncome: febIncome._sum.amount ?? 0,
        febExpenses: febExpense._sum.amount ?? 0,
        janPaychecks: janPaychecks._sum.amount ?? 0,
        classificationCounts: classificationCounts.map(c => ({ classification: c.classification, count: c._count })),
        categoryGroups: groups.length,
      },
      log,
    })
  } catch (error) {
    console.error('Reimport failed:', error)
    return NextResponse.json(
      { error: 'Reimport failed', details: String(error), log },
      { status: 500 }
    )
  }
}
