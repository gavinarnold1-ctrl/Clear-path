import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { plaidClient, mapPlaidCategory, detectCreditCardPayment } from '@/lib/plaid'
import { classifyTransaction } from '@/lib/category-groups'
import { decrypt } from '@/lib/encryption'
import { normalizeMerchant, canonicalizeMerchant } from '@/lib/normalize-merchant'
import type { RemovedTransaction } from 'plaid'

// TODO: Vercel Hobby crons are unreliable (0 executions observed).
// Phase A fallback: BackgroundSyncTrigger.tsx syncs stale items on dashboard load.
// Phase B (webhooks) will replace polling entirely.
// External backup: cron-job.org → GET this route with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  // Verify request is from Vercel Cron (production) or allow in development
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    console.error('CRON_SECRET is not set in production')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find all unique Plaid item groups across all users
    const plaidAccounts = await db.account.findMany({
      where: { plaidItemId: { not: null } },
      select: {
        id: true,
        userId: true,
        plaidAccountId: true,
        plaidItemId: true,
        plaidAccessToken: true,
        plaidCursor: true,
        ownerId: true,
      },
    })

    if (plaidAccounts.length === 0) {
      return NextResponse.json({ success: true, message: 'No Plaid accounts to sync' })
    }

    // Group by itemId
    const itemGroups = new Map<string, typeof plaidAccounts>()
    for (const acct of plaidAccounts) {
      const key = acct.plaidItemId!
      if (!itemGroups.has(key)) itemGroups.set(key, [])
      itemGroups.get(key)!.push(acct)
    }

    let totalAdded = 0
    let totalModified = 0
    let totalRemoved = 0
    let itemsSynced = 0
    const errors: string[] = []

    for (const [itemId, accounts] of itemGroups) {
      try {
        const representative = accounts[0]
        const accessToken = decrypt(representative.plaidAccessToken!)
        const userId = representative.userId
        let cursor = representative.plaidCursor ?? ''
        const accountIdMap = new Map(accounts.map(a => [a.plaidAccountId!, a.id]))

        // Load categories for this user
        const allCategories = await db.category.findMany({
          where: {
            OR: [{ userId }, { userId: null, isDefault: true }],
          },
        })
        const categoryByName = new Map(allCategories.map(c => [c.name.toLowerCase(), c]))

        // Merchant history for this user
        const merchantCatRows = await db.transaction.groupBy({
          by: ['merchant', 'categoryId'],
          where: { userId, categoryId: { not: null } },
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

        // Account-level property links for auto-tagging (not global default)
        const accountPropertyLinks = await db.accountPropertyLink.findMany({
          where: { account: { userId } },
          select: { accountId: true, propertyId: true },
        })
        const accountPropertyMap = new Map(
          accountPropertyLinks.map(link => [link.accountId, link.propertyId])
        )

        // Transaction sync
        let hasMore = true
        while (hasMore) {
          const syncResponse = await plaidClient.transactionsSync({
            access_token: accessToken,
            cursor: cursor || undefined,
          })

          const { added, modified, removed, next_cursor, has_more } = syncResponse.data

          for (const tx of added) {
            const ourAccountId = accountIdMap.get(tx.account_id)
            if (!ourAccountId) continue

            const amount = -tx.amount
            const rawMerchant = tx.merchant_name || tx.name
            const merchantName = normalizeMerchant(rawMerchant)
            const isPending = tx.pending ?? false
            let categoryId: string | null = null
            let resolvedGroup: string | null = null
            let resolvedType: string | null = null

            // Pending → posted continuity: check if this posted transaction
            // replaces a previously-synced pending one (via pending_transaction_id)
            let pendingPlaidId: string | null = null
            let inheritedFromPending: {
              categoryId: string | null
              householdMemberId: string | null
              propertyId: string | null
              notes: string | null
              tags: string | null
              debtId: string | null
              annualExpenseId: string | null
            } | null = null

            if (!isPending && tx.pending_transaction_id) {
              // Plaid tells us which pending transaction this posted one replaces
              const pendingTx = await db.transaction.findUnique({
                where: { plaidTransactionId: tx.pending_transaction_id },
              })
              if (pendingTx) {
                pendingPlaidId = tx.pending_transaction_id
                // Inherit user edits from the pending transaction
                inheritedFromPending = {
                  categoryId: pendingTx.categoryId,
                  householdMemberId: pendingTx.householdMemberId,
                  propertyId: pendingTx.propertyId,
                  notes: pendingTx.notes,
                  tags: pendingTx.tags,
                  debtId: pendingTx.debtId,
                  annualExpenseId: pendingTx.annualExpenseId,
                }
                // Delete the pending transaction — the posted one replaces it
                await db.transaction.delete({ where: { id: pendingTx.id } })
              }
            }

            // If we didn't find via pending_transaction_id, try fuzzy match
            // (same account, similar amount within 10%, date within 4 days, same merchant)
            if (!isPending && !inheritedFromPending) {
              const fuzzyPending = await db.transaction.findFirst({
                where: {
                  userId,
                  accountId: ourAccountId,
                  isPending: true,
                  merchant: merchantName,
                  date: {
                    gte: new Date(new Date(tx.date).getTime() - 4 * 24 * 60 * 60 * 1000),
                    lte: new Date(new Date(tx.date).getTime() + 4 * 24 * 60 * 60 * 1000),
                  },
                },
              })
              if (fuzzyPending && Math.abs(fuzzyPending.amount - amount) <= Math.abs(amount) * 0.1) {
                pendingPlaidId = fuzzyPending.plaidTransactionId
                inheritedFromPending = {
                  categoryId: fuzzyPending.categoryId,
                  householdMemberId: fuzzyPending.householdMemberId,
                  propertyId: fuzzyPending.propertyId,
                  notes: fuzzyPending.notes,
                  tags: fuzzyPending.tags,
                  debtId: fuzzyPending.debtId,
                  annualExpenseId: fuzzyPending.annualExpenseId,
                }
                await db.transaction.delete({ where: { id: fuzzyPending.id } })
              }
            }

            // Use inherited category from pending if available
            if (inheritedFromPending?.categoryId) {
              categoryId = inheritedFromPending.categoryId
              const cat = allCategories.find(c => c.id === categoryId)
              if (cat) {
                resolvedGroup = cat.group
                resolvedType = cat.type
              }
            }

            // Tier 0: Credit card payment detection
            const merchantKey = merchantName.toLowerCase()
            if (!categoryId && detectCreditCardPayment(rawMerchant)) {
              const ccCat = categoryByName.get('credit card payment')
              if (ccCat) {
                categoryId = ccCat.id
                resolvedGroup = ccCat.group
                resolvedType = ccCat.type
              }
            }

            // Tier 1: Merchant history
            if (!categoryId) {
              const histCatId = merchantCategoryMap.get(merchantKey)
              if (histCatId) {
                categoryId = histCatId
                const cat = allCategories.find(c => c.id === histCatId)
                if (cat) {
                  resolvedGroup = cat.group
                  resolvedType = cat.type
                }
              }
            }

            // Tier 2: Plaid metadata
            if (!categoryId && tx.personal_finance_category?.primary) {
              const mapped = mapPlaidCategory(
                tx.personal_finance_category.primary,
                tx.personal_finance_category.detailed ?? null,
                amount,
                rawMerchant,
              )
              const existing = categoryByName.get(mapped.name.toLowerCase())
              if (existing) {
                categoryId = existing.id
                resolvedGroup = existing.group
                resolvedType = existing.type
              } else {
                const newCat = await db.category.create({
                  data: {
                    userId,
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

            const classification = classifyTransaction(resolvedGroup, resolvedType, amount)
            const account = accounts.find(a => a.plaidAccountId === tx.account_id)

            // Cross-source dedup: skip if a CSV transaction already exists
            // with the same canonical merchant, amount, and date (±1 day)
            const canonicalKey = canonicalizeMerchant(merchantName)
            const csvDuplicate = await db.transaction.findFirst({
              where: {
                userId,
                importSource: 'csv',
                amount,
                date: {
                  gte: new Date(new Date(tx.date).getTime() - 24 * 60 * 60 * 1000),
                  lte: new Date(new Date(tx.date).getTime() + 24 * 60 * 60 * 1000),
                },
              },
            })
            if (csvDuplicate && canonicalizeMerchant(csvDuplicate.merchant) === canonicalKey) {
              // Plaid duplicate of CSV — skip but adopt plaidTransactionId onto the CSV record
              await db.transaction.update({
                where: { id: csvDuplicate.id },
                data: { plaidTransactionId: tx.transaction_id, importSource: 'plaid' },
              })
              continue
            }

            // Upsert by plaidTransactionId — prevents duplicates on re-sync
            await db.transaction.upsert({
              where: { plaidTransactionId: tx.transaction_id },
              create: {
                userId,
                accountId: ourAccountId,
                date: new Date(tx.date),
                merchant: merchantName,
                amount,
                classification,
                categoryId: categoryId ?? inheritedFromPending?.categoryId ?? null,
                originalStatement: tx.name,
                importSource: 'plaid',
                plaidTransactionId: tx.transaction_id,
                isPending,
                pendingPlaidId,
                householdMemberId: inheritedFromPending?.householdMemberId ?? account?.ownerId ?? null,
                propertyId: inheritedFromPending?.propertyId ?? (ourAccountId ? accountPropertyMap.get(ourAccountId) : null) ?? null,
                notes: inheritedFromPending?.notes ?? null,
                tags: inheritedFromPending?.tags ?? null,
                debtId: inheritedFromPending?.debtId ?? null,
                annualExpenseId: inheritedFromPending?.annualExpenseId ?? null,
              },
              update: {
                date: new Date(tx.date),
                merchant: merchantName,
                amount,
                originalStatement: tx.name,
                isPending,
                pendingPlaidId,
              },
            })

            if (categoryId) {
              merchantCategoryMap.set(merchantKey, categoryId)
            }
            totalAdded++
          }

          // Modified — look up by plaidTransactionId
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
                data: { merchant: merchantName, amount, classification, originalStatement: tx.name },
              })
              totalModified++
            }
          }

          // Removed — look up by plaidTransactionId
          for (const tx of removed as RemovedTransaction[]) {
            if (!tx.transaction_id) continue
            const deleted = await db.transaction.deleteMany({
              where: {
                userId,
                plaidTransactionId: tx.transaction_id,
              },
            })
            totalRemoved += deleted.count
          }

          cursor = next_cursor
          hasMore = has_more
        }

        // Update cursor for all accounts in this group
        await db.account.updateMany({
          where: { id: { in: accounts.map(a => a.id) } },
          data: { plaidCursor: cursor, plaidLastSynced: new Date() },
        })

        // Balance refresh for this item
        try {
          const balanceResponse = await plaidClient.accountsBalanceGet({
            access_token: accessToken,
          })
          for (const plaidAccount of balanceResponse.data.accounts) {
            const ourAccount = accounts.find(a => a.plaidAccountId === plaidAccount.account_id)
            if (!ourAccount) continue

            const balance = plaidAccount.type === 'depository'
              ? (plaidAccount.balances.available ?? plaidAccount.balances.current ?? 0)
              : (plaidAccount.balances.current ?? 0)

            await db.account.update({
              where: { id: ourAccount.id },
              data: { balance, plaidLastSynced: new Date(), balanceSource: 'plaid', syncFailCount: 0 },
            })

            // Sync linked Debt balance (update only — don't overwrite user-edited fields)
            const linkedDebt = await db.debt.findUnique({
              where: { accountId: ourAccount.id },
            })
            if (linkedDebt) {
              await db.debt.update({
                where: { id: linkedDebt.id },
                data: { currentBalance: Math.abs(balance) },
              })
            }
          }
        } catch (balErr) {
          console.error(`Balance refresh failed for item ${itemId}:`, balErr)
          // Increment sync fail count for all accounts in this item (triggers dashboard warning banner)
          await db.account.updateMany({
            where: { id: { in: accounts.map(a => a.id) } },
            data: { syncFailCount: { increment: 1 } },
          })
        }

        itemsSynced++
      } catch (itemErr) {
        console.error(`Sync failed for item ${itemId}:`, itemErr)
        errors.push(`Item ${itemId}: ${itemErr instanceof Error ? itemErr.message : 'Unknown error'}`)
      }
    }

    // AI categorization pass — run per-user for any uncategorized Plaid transactions
    let totalAiCategorized = 0
    if (totalAdded > 0) {
      // Get distinct user IDs that had new transactions
      const userIds = [...new Set(plaidAccounts.map(a => a.userId))]
      for (const userId of userIds) {
        try {
          const uncategorized = await db.transaction.findMany({
            where: {
              userId,
              importSource: 'plaid',
              OR: [
                { categoryId: null },
                { category: { name: { equals: 'Uncategorized', mode: 'insensitive' } } },
              ],
              date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
            },
            include: { account: { select: { name: true } } },
            take: 50,
          })

          if (uncategorized.length > 0) {
            const { aiCategorizeBatch } = await import('@/lib/ai-categorize')
            const userCategories = await db.category.findMany({
              where: { userId, isActive: true },
            })

            const suggestions = await aiCategorizeBatch(
              uncategorized.map(t => ({
                id: t.id,
                merchant: t.merchant,
                amount: t.amount,
                date: t.date.toISOString().split('T')[0],
                originalStatement: t.originalStatement,
                accountName: t.account?.name || 'Unknown',
              })),
              userCategories,
              userId,
            )

            for (const suggestion of suggestions) {
              if (suggestion.confidence >= 0.85) {
                const cat = userCategories.find(c =>
                  c.name.toLowerCase() === suggestion.categoryName.toLowerCase()
                )
                if (cat) {
                  const tx = uncategorized.find(t => t.id === suggestion.transactionId)
                  const classification = classifyTransaction(cat.group, cat.type, tx?.amount ?? 0)
                  await db.transaction.update({
                    where: { id: suggestion.transactionId },
                    data: { categoryId: cat.id, classification },
                  })
                  totalAiCategorized++
                }
              }
            }
          }
        } catch (aiErr) {
          console.error(`AI categorization failed for user ${userId} (non-fatal):`, aiErr)
        }
      }
    }

    return NextResponse.json({
      success: true,
      itemsSynced,
      totalAdded,
      totalModified,
      totalRemoved,
      aiCategorized: totalAiCategorized,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Plaid cron sync failed:', error)
    return NextResponse.json({ error: 'Cron sync failed' }, { status: 500 })
  }
}
