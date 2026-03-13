import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { plaidClient, mapPlaidCategory, detectCreditCardPayment } from '@/lib/plaid'
import { classifyTransaction } from '@/lib/category-groups'
import { decrypt } from '@/lib/encryption'
import { normalizeMerchant } from '@/lib/normalize-merchant'
import { detectPerkCredit } from '@/lib/engines/perk-detection'
import type { BenefitForMatching } from '@/lib/engines/perk-detection'
import type { RemovedTransaction } from 'plaid'

async function getBalancesWithRetry(accessToken: string, maxRetries = 1): Promise<Awaited<ReturnType<typeof plaidClient.accountsBalanceGet>>> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await plaidClient.accountsBalanceGet({ access_token: accessToken })
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
    }
  }
  throw lastError
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const { accountId, itemId, itemIds } = body as { accountId?: string; itemId?: string; itemIds?: string[] }

    // Find all Plaid-connected accounts for this user, grouped by itemId
    const where: Record<string, unknown> = {
      userId: session.userId,
      plaidItemId: { not: null },
    }
    if (accountId) where.id = accountId
    if (itemId) where.plaidItemId = itemId
    if (itemIds && itemIds.length > 0) where.plaidItemId = { in: itemIds }

    const plaidAccounts = await db.account.findMany({ where })

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

    // Get account-level property links for auto-tagging (not global default)
    const accountPropertyLinks = await db.accountPropertyLink.findMany({
      where: { account: { userId: session.userId } },
      select: { accountId: true, propertyId: true },
    })
    const accountPropertyMap = new Map(
      accountPropertyLinks.map(link => [link.accountId, link.propertyId])
    )

    // R3B: Load confirmed UserCards with benefits for perk credit detection
    // Map accountId → benefits for fast lookup during transaction processing
    const userCards = await db.userCard.findMany({
      where: { userId: session.userId, isActive: true, accountId: { not: null } },
      include: {
        benefits: {
          include: { cardBenefit: true },
          where: { isOptedIn: true },
        },
      },
    })
    const accountBenefitsMap = new Map<string, BenefitForMatching[]>()
    for (const card of userCards) {
      if (!card.accountId) continue
      const benefits: BenefitForMatching[] = card.benefits
        .filter(b => b.cardBenefit.isTransactionTrackable && b.cardBenefit.isActive)
        .map(b => ({
          id: b.cardBenefit.id,
          name: b.cardBenefit.name,
          type: b.cardBenefit.type,
          creditAmount: b.cardBenefit.creditAmount,
          creditCycle: b.cardBenefit.creditCycle,
          eligibleMerchants: b.cardBenefit.eligibleMerchants as string[] | null,
          merchantMatchType: b.cardBenefit.merchantMatchType,
          creditMerchantPatterns: b.cardBenefit.creditMerchantPatterns as string[] | null,
          isTransactionTrackable: b.cardBenefit.isTransactionTrackable,
        }))
      if (benefits.length > 0) {
        accountBenefitsMap.set(card.accountId, benefits)
      }
    }
    // Get the "Card Perk Credits" category for perk reimbursement tagging
    const perkCategory = categoryByName.get('card perk credits') ?? null

    let totalAdded = 0
    let totalModified = 0
    let totalRemoved = 0
    let balanceSyncedCount = 0
    const balanceFailedItems: string[] = []
    const balanceFailureReasons: string[] = []

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

            // Backfill: check for existing transaction without plaidTransactionId
            // (created before the @unique constraint was added) to avoid duplicates
            const backfillMatch = await db.transaction.findFirst({
              where: {
                userId: session.userId,
                accountId: ourAccountId,
                plaidTransactionId: null,
                date: new Date(tx.date),
                amount,
                importSource: 'plaid',
              },
            })
            if (backfillMatch) {
              await db.transaction.update({
                where: { id: backfillMatch.id },
                data: { plaidTransactionId: tx.transaction_id },
              })
              totalAdded++
              continue
            }

            // R1.8: Auto-categorization hierarchy
            const rawMerchant = tx.merchant_name || tx.name
            const merchantName = normalizeMerchant(rawMerchant)
            let categoryId: string | null = null
            let resolvedGroup: string | null = null
            let resolvedType: string | null = null

            // 0. Credit card payment detection — force as transfer
            if (detectCreditCardPayment(tx.name) && amount < 0) {
              const ccCat = categoryByName.get('credit card payment')
              if (ccCat) {
                categoryId = ccCat.id
                resolvedGroup = ccCat.group
                resolvedType = ccCat.type
              }
            }

            // 0.5. R3B: Perk credit detection — positive amount on credit card with confirmed card program
            let perkBenefitTag: string | null = null
            if (!categoryId && amount > 0 && perkCategory) {
              const accountBenefits = accountBenefitsMap.get(ourAccountId)
              if (accountBenefits) {
                const perkMatch = detectPerkCredit(merchantName, amount, accountBenefits)
                if (perkMatch && perkMatch.confidence >= 0.7) {
                  categoryId = perkCategory.id
                  resolvedGroup = perkCategory.group
                  resolvedType = perkCategory.type
                  perkBenefitTag = `card_benefit:${perkMatch.benefitName}`
                }
              }
            }

            // 1. Merchant history — match to most recently categorized transaction
            if (!categoryId) {
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
            }

            const merchantKey = merchantName.toLowerCase()

            // 2. Plaid metadata — use personal_finance_category with detailed + amount context
            if (!categoryId) {
              const pfc = tx.personal_finance_category
              const mapped = pfc?.primary
                ? mapPlaidCategory(pfc.primary, pfc.detailed ?? null, amount)
                : (amount > 0 ? { group: 'Income', name: 'Other Income', type: 'income' } : null)
              if (mapped) {
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
            }

            // 3. Derive classification (perk_reimbursement bypasses normal hierarchy)
            const classification = resolvedType === 'perk_reimbursement'
              ? 'perk_reimbursement'
              : classifyTransaction(resolvedGroup, resolvedType, amount)

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
                propertyId: (ourAccountId ? accountPropertyMap.get(ourAccountId) : null) ?? null,
                tags: perkBenefitTag,
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

              // Update Plaid-controlled fields only
              // PRESERVE user-set fields: categoryId, annualExpenseId, notes, propertyId, householdMemberId
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

        // Balance refresh for this item (with retry for rate limits/timeouts)
        try {
          const balanceResponse = await getBalancesWithRetry(accessToken)
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
            balanceSyncedCount++

            // Sync linked Debt balance
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
        } catch (balErr: unknown) {
          // Extract Plaid error details for debugging
          const plaidError = (balErr as { response?: { data?: { error_code?: string; error_message?: string } } })?.response?.data
          const errorDetail = plaidError
            ? `Plaid ${plaidError.error_code}: ${plaidError.error_message}`
            : (balErr instanceof Error ? balErr.message : String(balErr))
          console.error(`Balance refresh failed for item ${itemKey}: ${errorDetail}`, balErr)
          balanceFailedItems.push(itemKey)
          balanceFailureReasons.push(errorDetail)
          // Increment sync fail count for all accounts in this item
          await db.account.updateMany({
            where: { id: { in: accounts.map(a => a.id) } },
            data: { syncFailCount: { increment: 1 } },
          })
        }
      } catch (itemError) {
        console.error(`Plaid sync failed for item ${itemKey}:`, itemError)
        // Continue syncing other items — don't let one stale item break the whole sync
      }
    }

    // AI categorization pass — runs for any uncategorized Plaid transactions
    let aiCategorized = 0
    try {
      const uncategorized = await db.transaction.findMany({
        where: {
          userId: session.userId,
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
          where: { userId: session.userId, isActive: true },
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
          session.userId,
        )

        for (const suggestion of suggestions) {
          if (suggestion.confidence >= 0.85) {
            const cat = userCategories.find(c =>
              c.name.toLowerCase() === suggestion.categoryName.toLowerCase()
            )
            if (cat) {
              // Find the original transaction to get the actual amount for classification
              const tx = uncategorized.find(t => t.id === suggestion.transactionId)
              const classification = classifyTransaction(cat.group, cat.type, tx?.amount ?? 0)
              await db.transaction.update({
                where: { id: suggestion.transactionId },
                data: { categoryId: cat.id, classification },
              })
              aiCategorized++
            }
          }
        }
      }
    } catch (aiErr) {
      console.error('AI categorization pass failed (non-fatal):', aiErr)
    }

    return NextResponse.json({
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
      aiCategorized,
      balancesSynced: balanceSyncedCount,
      balancesFailed: balanceFailedItems.length,
      balanceFailureReason: balanceFailureReasons[0] ?? null,
    })
  } catch (error) {
    console.error('Plaid sync failed:', error)
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 })
  }
}
