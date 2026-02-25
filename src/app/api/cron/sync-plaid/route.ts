import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { plaidClient, mapPlaidCategory } from '@/lib/plaid'
import { classifyTransaction } from '@/lib/category-groups'
import { decrypt } from '@/lib/encryption'
import type { RemovedTransaction } from 'plaid'

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

        // Default property for this user
        const defaultProperty = await db.property.findFirst({
          where: { userId, isDefault: true },
        })

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
            const merchantName = tx.merchant_name || tx.name
            let categoryId: string | null = null
            let resolvedGroup: string | null = null
            let resolvedType: string | null = null

            // Merchant history
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

            // Plaid metadata
            if (!categoryId && tx.personal_finance_category?.primary) {
              const mapped = mapPlaidCategory(tx.personal_finance_category.primary)
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

            await db.transaction.create({
              data: {
                userId,
                accountId: ourAccountId,
                date: new Date(tx.date),
                merchant: merchantName,
                amount,
                classification,
                categoryId,
                originalStatement: tx.name,
                importSource: 'plaid',
                householdMemberId: account?.ownerId ?? null,
                propertyId: defaultProperty?.id ?? null,
              },
            })

            if (categoryId) {
              merchantCategoryMap.set(merchantKey, categoryId)
            }
            totalAdded++
          }

          for (const tx of modified) {
            const ourAccountId = accountIdMap.get(tx.account_id)
            if (!ourAccountId) continue

            const amount = -tx.amount
            const merchantName = tx.merchant_name || tx.name

            const existing = await db.transaction.findFirst({
              where: {
                userId,
                accountId: ourAccountId,
                originalStatement: tx.name,
                date: new Date(tx.date),
                importSource: 'plaid',
              },
            })

            if (existing) {
              const cat = existing.categoryId
                ? allCategories.find(c => c.id === existing.categoryId)
                : null
              const classification = classifyTransaction(cat?.group, cat?.type, amount)

              await db.transaction.update({
                where: { id: existing.id },
                data: { merchant: merchantName, amount, classification },
              })
              totalModified++
            }
          }

          for (const tx of removed as RemovedTransaction[]) {
            if (!tx.transaction_id) continue
            const deleted = await db.transaction.deleteMany({
              where: {
                userId,
                importSource: 'plaid',
                originalStatement: tx.transaction_id,
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
              data: { balance, plaidLastSynced: new Date() },
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
        }

        itemsSynced++
      } catch (itemErr) {
        console.error(`Sync failed for item ${itemId}:`, itemErr)
        errors.push(`Item ${itemId}: ${itemErr instanceof Error ? itemErr.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      itemsSynced,
      totalAdded,
      totalModified,
      totalRemoved,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Plaid cron sync failed:', error)
    return NextResponse.json({ error: 'Cron sync failed' }, { status: 500 })
  }
}
