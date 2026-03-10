'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { classifyTransaction } from '@/lib/category-groups'
import { applyPropertyAttribution } from '@/lib/apply-splits'

interface TransactionState {
  error: string | null
}

export async function createTransaction(
  prevState: TransactionState,
  formData: FormData
): Promise<TransactionState> {
  const session = await getSession()
  if (!session) redirect('/login')

  const amount = parseFloat(formData.get('amount') as string)
  const merchant = (formData.get('merchant') as string)?.trim()
  const date = formData.get('date') as string
  const accountId = (formData.get('accountId') as string) || null
  const categoryId = (formData.get('categoryId') as string) || null
  const householdMemberId = (formData.get('householdMemberId') as string) || null
  let propertyId = (formData.get('propertyId') as string) || null
  // Strip group: prefix if accidentally sent — splits handle group attribution
  if (propertyId?.startsWith('group:')) {
    propertyId = null
  }
  const notes = (formData.get('notes') as string)?.trim() || null
  const tags = (formData.get('tags') as string)?.trim() || null
  const splitAllocationsRaw = (formData.get('splitAllocations') as string) || null

  if (isNaN(amount) || amount === 0) return { error: 'Amount must be a non-zero number.' }
  if (!merchant) return { error: 'Merchant is required.' }
  if (!date) return { error: 'Date is required.' }

  // Auto-apply learned category if none provided — use merchant→category mappings
  let resolvedCategoryId = categoryId
  if (!resolvedCategoryId && merchant) {
    const normalizedMerchant = merchant.toLowerCase().trim()
    const direction = amount > 0 ? 'credit' : 'debit'
    const absAmount = Math.abs(amount)

    try {
      const mappings = await db.userCategoryMapping.findMany({
        where: { userId: session.userId, merchantName: normalizedMerchant },
        orderBy: { timesApplied: 'desc' },
      })

      let bestMapping: (typeof mappings)[0] | null = null
      let bestScore = 0

      for (const m of mappings) {
        let score = 0.7
        if (m.direction) {
          if (m.direction === direction) score += 0.15
          else score -= 0.5
        }
        if (m.amountMin != null && m.amountMax != null) {
          if (absAmount >= m.amountMin && absAmount <= m.amountMax) score += 0.15
          else score -= 0.2
        }
        if (score > bestScore) {
          bestScore = score
          bestMapping = m
        }
      }

      if (bestMapping && bestScore >= 0.7) {
        resolvedCategoryId = bestMapping.categoryId
        db.userCategoryMapping.update({
          where: { id: bestMapping.id },
          data: { timesApplied: { increment: 1 } },
        }).catch(() => { /* non-critical */ })
      }
    } catch {
      // Non-critical — proceed without auto-category
    }
  }

  // Determine sign and classification based on category group + type
  let finalAmount = amount
  let resolvedCategory: { type: string; group: string | null } | null = null
  if (resolvedCategoryId) {
    const category = await db.category.findUnique({ where: { id: resolvedCategoryId } })
    if (category) {
      resolvedCategory = category
      if (category.type === 'expense') {
        finalAmount = -Math.abs(amount)
      } else if (category.type === 'income') {
        finalAmount = Math.abs(amount)
      } else if (category.type === 'perk_reimbursement') {
        finalAmount = Math.abs(amount)
      }
    }
  }
  // Derive classification from category group (deterministic hierarchy).
  // Perk reimbursements bypass the normal hierarchy — classified directly from category type.
  const classification = resolvedCategory?.type === 'perk_reimbursement'
    ? 'perk_reimbursement'
    : classifyTransaction(
        resolvedCategory?.group,
        resolvedCategory?.type,
        finalAmount,
      )

  // Append time component to date-only strings so they parse as local time, not UTC midnight
  const txDate = new Date(date.includes('T') ? date : `${date}T12:00:00`)

  // Parse split allocations if provided
  let parsedSplitAllocations: Array<{ propertyId: string; percentage: number }> | null = null
  if (splitAllocationsRaw) {
    try {
      const parsed = JSON.parse(splitAllocationsRaw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsedSplitAllocations = parsed
      }
    } catch {
      // Ignore invalid JSON — just skip splits
    }
  }

  await db.$transaction(async (tx) => {
    // 1. Create the transaction record
    // When split allocations are provided, don't set propertyId on the transaction itself —
    // the property attribution comes from the split records to avoid double-counting.
    const effectivePropertyId = parsedSplitAllocations && parsedSplitAllocations.length > 0
      ? null
      : propertyId
    const created = await tx.transaction.create({
      data: { userId: session.userId, accountId, categoryId: resolvedCategoryId || null, householdMemberId, propertyId: effectivePropertyId, amount: finalAmount, classification, merchant, date: txDate, notes, tags },
    })

    // 2. Adjust account balance (amount sign already correct)
    if (accountId) {
      await tx.account.update({ where: { id: accountId }, data: { balance: { increment: finalAmount } } })
    }

    // 3. Create split records if split allocations were provided
    if (parsedSplitAllocations && parsedSplitAllocations.length > 0) {
      const splitData = parsedSplitAllocations
        .filter(a => a.percentage > 0)
        .map(a => ({
          transactionId: created.id,
          propertyId: a.propertyId,
          amount: Math.round(finalAmount * a.percentage / 100 * 100) / 100,
        }))
      if (splitData.length > 0) {
        await tx.transactionSplit.createMany({ data: splitData })
      }
    } else {
      // 4. Auto-apply property attribution if no manual splits provided
      await applyPropertyAttribution(
        created.id,
        propertyId,
        finalAmount,
        merchant,
        resolvedCategory?.group,
        null,
        tx
      )
    }
  })

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/budgets')
  redirect('/transactions')
}

export async function deleteTransaction(id: string): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')

  await db.$transaction(async (tx) => {
    // Fetch first so we can reverse the effects
    const existing = await tx.transaction.findFirst({ where: { id, userId: session.userId } })
    if (!existing) return

    await tx.transaction.delete({ where: { id } })

    // Reverse account balance
    if (existing.accountId) {
      await tx.account.update({ where: { id: existing.accountId }, data: { balance: { increment: -existing.amount } } })
    }
  })

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/budgets')
}
