/**
 * Cleanup script: remove duplicate Plaid transactions.
 *
 * Before the plaidTransactionId unique constraint was added, duplicate
 * transactions could be imported. This script finds and removes them,
 * keeping the oldest record (first imported).
 *
 * Usage: npx tsx scripts/cleanup-plaid-duplicates.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function cleanup() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===')

  // Find all transactions with a plaidTransactionId
  const plaidTxs = await db.transaction.findMany({
    where: { plaidTransactionId: { not: null } },
    select: { id: true, plaidTransactionId: true, createdAt: true, userId: true, merchant: true, amount: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by plaidTransactionId
  const groups = new Map<string, typeof plaidTxs>()
  for (const tx of plaidTxs) {
    const key = tx.plaidTransactionId!
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(tx)
  }

  // Find duplicates (groups with more than 1 entry)
  const duplicateIds: string[] = []
  let duplicateGroups = 0

  for (const [plaidId, txs] of groups) {
    if (txs.length <= 1) continue
    duplicateGroups++

    // Keep the oldest (first), delete the rest
    const [keep, ...dupes] = txs
    console.log(`  Plaid ID ${plaidId}: ${txs.length} copies — keeping ${keep.id} (${keep.merchant} ${keep.amount}), removing ${dupes.length}`)
    for (const dupe of dupes) {
      duplicateIds.push(dupe.id)
    }
  }

  console.log(`\nFound ${duplicateGroups} duplicate groups, ${duplicateIds.length} transactions to remove`)

  // Also find potential duplicates without plaidTransactionId
  // (same user, account, date, amount, merchant, importSource=plaid)
  const nullIdTxs = await db.transaction.findMany({
    where: { importSource: 'plaid', plaidTransactionId: null },
    select: { id: true, userId: true, accountId: true, date: true, amount: true, merchant: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const nullIdGroups = new Map<string, typeof nullIdTxs>()
  for (const tx of nullIdTxs) {
    const key = `${tx.userId}|${tx.accountId}|${tx.date.toISOString().split('T')[0]}|${tx.amount}|${tx.merchant.toLowerCase()}`
    if (!nullIdGroups.has(key)) nullIdGroups.set(key, [])
    nullIdGroups.get(key)!.push(tx)
  }

  let nullIdDupeGroups = 0
  for (const [key, txs] of nullIdGroups) {
    if (txs.length <= 1) continue
    nullIdDupeGroups++
    const [keep, ...dupes] = txs
    console.log(`  Null-ID group ${key}: ${txs.length} copies — keeping ${keep.id}, removing ${dupes.length}`)
    for (const dupe of dupes) {
      duplicateIds.push(dupe.id)
    }
  }

  console.log(`Found ${nullIdDupeGroups} potential duplicate groups without plaidTransactionId`)
  console.log(`Total transactions to remove: ${duplicateIds.length}`)

  if (duplicateIds.length === 0) {
    console.log('No duplicates found. Database is clean.')
    return
  }

  if (dryRun) {
    console.log('Dry run complete. Run without --dry-run to delete.')
    return
  }

  // Delete in batches of 100
  const batchSize = 100
  let deleted = 0
  for (let i = 0; i < duplicateIds.length; i += batchSize) {
    const batch = duplicateIds.slice(i, i + batchSize)
    const result = await db.transaction.deleteMany({
      where: { id: { in: batch } },
    })
    deleted += result.count
    console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}: ${result.count} transactions`)
  }

  console.log(`\nDone. Removed ${deleted} duplicate transactions.`)
}

cleanup()
  .catch(console.error)
  .finally(() => db.$disconnect())
