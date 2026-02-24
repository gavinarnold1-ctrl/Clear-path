/**
 * R1.6 Migration: Fix income transaction signs
 *
 * Flips the sign on all existing transactions where:
 *   - The linked category has type = 'income'
 *   - The transaction amount is negative (should be positive)
 *
 * Run once: npx tsx prisma/fix-income-signs.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('R1.6 Migration: Fixing income transaction signs...\n')

  // Find all transactions linked to income categories with negative amounts
  const badTransactions = await prisma.transaction.findMany({
    where: {
      amount: { lt: 0 },
      category: { type: 'income' },
    },
    include: { category: { select: { name: true, type: true } } },
  })

  console.log(`Found ${badTransactions.length} income transactions with negative amounts.\n`)

  if (badTransactions.length === 0) {
    console.log('Nothing to fix. All income transactions already have positive amounts.')
    return
  }

  // Show what we're fixing
  for (const tx of badTransactions) {
    console.log(
      `  ${tx.merchant} | ${tx.category?.name} | ${tx.amount} → ${Math.abs(tx.amount)}`
    )
  }

  // Flip signs in a transaction
  const updates = badTransactions.map((tx) =>
    prisma.transaction.update({
      where: { id: tx.id },
      data: { amount: Math.abs(tx.amount) },
    })
  )

  await prisma.$transaction(updates)

  console.log(`\nFixed ${badTransactions.length} transactions.`)

  // Verify: no more income transactions with negative amounts
  const remaining = await prisma.transaction.count({
    where: {
      amount: { lt: 0 },
      category: { type: 'income' },
    },
  })
  console.log(`Verification: ${remaining} income transactions still have negative amounts.`)
  if (remaining === 0) {
    console.log('Migration complete.')
  } else {
    console.error('WARNING: Some transactions were not fixed!')
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
