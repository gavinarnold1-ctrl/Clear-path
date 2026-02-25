/**
 * One-time migration script (R1.8):
 *   1. Fix sign on income transactions that have negative amounts
 *   2. Classify all existing transactions (transfer/income/expense)
 *
 * Run with: npx tsx prisma/migrate-classify.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

/** Category names that should be classified as 'transfer' */
const TRANSFER_NAMES = new Set([
  'transfer',
  'credit card payment',
  'credit card payments',
  'payment transfer',
  'internal transfer',
  'account transfer',
  'balance transfer',
])

const TRANSFER_KEYWORDS = /\b(transfer|credit card payment)\b/i

async function main() {
  console.log('=== R1.8 Migration: Fix signs + Classify transactions ===\n')

  // Step 1: Fix income transactions with negative amounts
  console.log('Step 1: Fixing income transactions with negative amounts...')
  const incomeWithNegative = await db.$queryRaw<{ id: string; amount: number; merchant: string }[]>`
    SELECT t.id, t.amount, t.merchant
    FROM "Transaction" t
    JOIN "Category" c ON t."categoryId" = c.id
    WHERE c.type = 'income' AND t.amount < 0
  `

  console.log(`  Found ${incomeWithNegative.length} income transactions with negative amounts`)

  for (const tx of incomeWithNegative) {
    await db.transaction.update({
      where: { id: tx.id },
      data: { amount: Math.abs(tx.amount) },
    })
    console.log(`  Fixed: ${tx.merchant} ${tx.amount} → ${Math.abs(tx.amount)}`)
  }

  // Step 2: Classify all transactions
  console.log('\nStep 2: Classifying all transactions...')

  // Load all categories for classification lookup
  const categories = await db.category.findMany({
    select: { id: true, name: true, type: true },
  })
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // Get all transactions that need classification
  const allTransactions = await db.transaction.findMany({
    select: { id: true, categoryId: true, amount: true },
  })

  let transferCount = 0
  let incomeCount = 0
  let expenseCount = 0

  // Batch updates by classification
  const updates: { ids: string[]; classification: string }[] = [
    { ids: [], classification: 'transfer' },
    { ids: [], classification: 'income' },
    { ids: [], classification: 'expense' },
  ]

  for (const tx of allTransactions) {
    let classification = 'expense'

    if (tx.categoryId) {
      const cat = categoryMap.get(tx.categoryId)
      if (cat) {
        const nameLower = cat.name.toLowerCase().trim()
        if (TRANSFER_NAMES.has(nameLower) || TRANSFER_KEYWORDS.test(nameLower) || cat.type === 'transfer') {
          classification = 'transfer'
        } else if (cat.type === 'income') {
          classification = 'income'
        }
      }
    } else {
      // No category — classify by amount sign
      if (tx.amount > 0) classification = 'income'
    }

    if (classification === 'transfer') {
      updates[0].ids.push(tx.id)
      transferCount++
    } else if (classification === 'income') {
      updates[1].ids.push(tx.id)
      incomeCount++
    } else {
      updates[2].ids.push(tx.id)
      expenseCount++
    }
  }

  // Apply batch updates
  for (const { ids, classification } of updates) {
    if (ids.length > 0) {
      // Batch in chunks of 1000 to avoid query size limits
      for (let i = 0; i < ids.length; i += 1000) {
        const chunk = ids.slice(i, i + 1000)
        await db.transaction.updateMany({
          where: { id: { in: chunk } },
          data: { classification },
        })
      }
    }
  }

  console.log(`  Classified: ${transferCount} transfers, ${incomeCount} income, ${expenseCount} expenses`)
  console.log(`  Total: ${allTransactions.length} transactions`)

  // Verify
  console.log('\n=== Verification ===')
  const wrongSign = await db.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) as count FROM "Transaction" t
    JOIN "Category" c ON t."categoryId" = c.id
    WHERE c.type = 'income' AND t.amount < 0
  `
  console.log(`Income with negative amount: ${wrongSign[0]?.count ?? 0} (should be 0)`)

  const classificationCounts = await db.transaction.groupBy({
    by: ['classification'],
    _count: true,
  })
  console.log('Classification breakdown:')
  for (const c of classificationCounts) {
    console.log(`  ${c.classification}: ${c._count}`)
  }

  console.log('\n=== Migration complete ===')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
