import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { plaidClient, mapPlaidCategory } from '@/lib/plaid'
import { classifyTransaction } from '@/lib/category-groups'
import { decrypt } from '@/lib/encryption'
import { normalizeMerchant } from '@/lib/normalize-merchant'
import type { RemovedTransaction } from 'plaid'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const { accountId, itemId } = body as { accountId?: string; itemId?: string }

    // Find all Plaid-connected accounts for this user, grouped by itemId
    const plaidAccounts = await db.account.findMany({
      where: {
        userId: session.userId,
        plaidItemId: { not: null },
        ...(accountId ? { id: accountId } : {}),
        ...(itemId ? { plaidItemId: itemId } : {}),
      },
    })

    if (plaidAccounts.length === 0) {
      return NextResponse.json({ error: 'No Plaid-connected accounts found' }, { status: 404 })
    }

    // Group accounts by itemId (each item shares one access token)
    const itemGroups = new Map<string, typeof plaidAccounts>()
    for (const acct of plaidAccounts) {
      const key = acct.plaidItemId!
      if (!itemGroups.has(key)) itemGroups.set(key, [])
      itemGroups.get(key)!.push(acct)
    }

    // Load user's categories for matching
    const allCategories = await db.category.findMany({
      where: {
        OR: [{ userId: session.userId }, { userId: null, isDefault: true }],
      },
    })
    const categoryByName = new Map(allCategories.map(c => [c.name.toLowerCase(), c]))

    // R1.8: Build merchant→category lookup from user's existing categorized transactions
    const merchantCatRows = await db.transaction.groupBy({
      by: ['merchant', 'categoryId'],
      where: { userId: session.userId, categoryId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })
    const merchantCategoryMap = new Map<string, string>()
    for (const row of merchantCatRows) {
      const key = row.merchant.toLowerCase()
      if (!merchantCategoryMap.has(key) && row.categoryId) {
        merchantCategoryMap.set(key, row.categoryId)
      }
    }

    // Get user's default property for new transactions
    const defaultProperty = await db.property.findFirst({
      where: { userId: session.userId, isDefault: true },
    })

    let totalAdded = 0
    let totalModified = 0
    let totalRemoved = 0

    for (const [itemKey, accounts] of itemGroups) {
      try {
        const representative = accounts[0]
        const accessToken = decrypt(representative.plaidAccessToken!)
        let cursor = representative.plaidCursor ?? ''
        const accountIdMap = new Map(accounts.map(a => [a.plaidAccountId!, a.id]))

        let hasMore = true
        while (hasMore) {
          const syncResponse = await plaidClient.transactionsSync({
            access_token: accessToken,
            cursor: cursor || undefined,
          })

          const { added, modified, removed, next_cursor, has_more } = syncResponse.data

          // Process added transactions — upsert by plaidTransactionId to prevent duplicates
          for (const tx of added) {
            const ourAccountId = accountIdMap.get(tx.account_id)
            if (!ourAccountId) continue

            // R1.10: Sign flip — Plaid positive = money out, we use negative = money out
            const amount = -tx.amount

            // R1.8: Auto-categorization hierarchy
            const rawMerchant = tx.merchant_name || tx.name
            const merchantName = normalizeMerchant(rawMerchant)
            let categoryId: string | null = null
            let resolvedGroup: string | null = null
            let resolvedType: string | null = null

            // 1. Merchant history — match to most recently categorized transaction
            const merchantKey = merchantName.toLowerCase()
            const histCatId = merchantCategoryMap.get(merchantKey)
            if (histCatId) {
              categoryId = histCatId
              const cat = allCategories.find(c => c.id === histCatId)
              if (cat) {
                resolvedGroup = cat.group
                resolvedType = cat.type
              }
            }

            // 2. Plaid metadata — use personal_finance_category as hint
            if (!categoryId && tx.personal_finance_category?.primary) {
              const mapped = mapPlaidCategory(tx.personal_finance_category.primary)
              const existing = categoryByName.get(mapped.name.toLowerCase())
              if (existing) {
                categoryId = existing.id
                resolvedGroup = existing.group
                resolvedType = existing.type
              } else {
                // Create the category
                const newCat = await db.category.create({
                  data: {
                    userId: session.userId,
                    name: mapped.name,
                    type: mapped.type,
                    group: mapped.group,
                    isDefault: false,
                  },
                })
                categoryId = newCat.id
                resolvedGroup = newCat.group
                resolvedType = newCat.type
                categoryByName.set(mapped.name.toLowerCase(), newCat)
                allCategories.push(newCat)
              }
            }

            // 3. Derive classification
            const classification = classifyTransaction(resolvedGroup, resolvedType, amount)

            // Get account owner for person tagging
            const account = accounts.find(a => a.plaidAccountId === tx.account_id)
            const householdMemberId = account?.ownerId ?? null

            // Upsert by plaidTransactionId — prevents duplicates on re-sync
            await db.transaction.upsert({
              where: { plaidTransactionId: tx.transaction_id },
              create: {
                userId: session.userId,
                accountId: ourAccountId,
                date: new Date(tx.date),
                merchant: merchantName,
                amount,
                classification,
                categoryId,
                originalStatement: tx.name,
                importSource: 'plaid',
                plaidTransactionId: tx.transaction_id,
                householdMemberId,
                propertyId: defaultProperty?.id ?? null,
              },
              update: {
                // Only update fields Plaid controls — preserve user edits to category, notes, etc.
                date: new Date(tx.date),
                merchant: merchantName,
                amount,
                originalStatement: tx.name,
              },
            })

            // Update merchant history for future lookups
            if (categoryId) {
              merchantCategoryMap.set(merchantKey, categoryId)
            }

            totalAdded++
          }

          // Process modified transactions — look up by plaidTransactionId
          for (const tx of modified) {
            const ourAccountId = accountIdMap.get(tx.account_id)
            if (!ourAccountId) continue

            const amount = -tx.amount
            const rawMerchant = tx.merchant_name || tx.name
            const merchantName = normalizeMerchant(rawMerchant)

            const existing = await db.transaction.findUnique({
              where: { plaidTransactionId: tx.transaction_id },
            })

            if (existing) {
              const cat = existing.categoryId
                ? allCategories.find(c => c.id === existing.categoryId)
                : null
              const classification = classifyTransaction(cat?.group, cat?.type, amount)

              await db.transaction.update({
                where: { id: existing.id },
                data: {
                  merchant: merchantName,
                  amount,
                  classification,
                  originalStatement: tx.name,
                },
              })
              totalModified++
            }
          }

          // Process removed transactions — look up by plaidTransactionId
          for (const tx of removed as RemovedTransaction[]) {
            if (!tx.transaction_id) continue
            const deleted = await db.transaction.deleteMany({
              where: {
                userId: session.userId,
                plaidTransactionId: tx.transaction_id,
              },
            })
            totalRemoved += deleted.count
          }

          cursor = next_cursor
          hasMore = has_more
        }

        // Update cursor and sync timestamp for all accounts in this item group
        await db.account.updateMany({
          where: {
            id: { in: accounts.map(a => a.id) },
          },
          data: {
            plaidCursor: cursor,
            plaidLastSynced: new Date(),
          },
        })
      } catch (itemError) {
        console.error(`Plaid sync failed for item ${itemKey}:`, itemError)
        // Continue syncing other items — don't let one stale item break the whole sync
      }
    }

    return NextResponse.json({
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
    })
  } catch (error) {
    console.error('Plaid sync failed:', error)
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 })
  }
}
