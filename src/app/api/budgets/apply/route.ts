import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import type { BudgetProposal } from '@/lib/budget-builder'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as { proposal: BudgetProposal }
  const { proposal } = body

  if (!proposal) {
    return NextResponse.json({ error: 'Missing proposal' }, { status: 400 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Load all user + system default categories for fuzzy matching
  const allCategories = await db.category.findMany({
    where: {
      OR: [{ userId: session!.userId }, { userId: null, isDefault: true }],
    },
    orderBy: { userId: 'desc' }, // user categories first (preferred)
  })

  // Resolve category IDs by name — exact first, then fuzzy partial match
  function findCategoryId(name: string, type: string): string | null {
    const nameLower = name.toLowerCase()
    const filtered = allCategories.filter((c) => c.type === type)

    // 1. Exact match (case insensitive)
    const exact = filtered.find((c) => c.name.toLowerCase() === nameLower)
    if (exact) return exact.id

    // 2. Contains match: "Mortgage Payment" matches category "Mortgage"
    const containsMatch = filtered.find((c) => {
      const catLower = c.name.toLowerCase()
      return nameLower.includes(catLower) || catLower.includes(nameLower)
    })
    if (containsMatch) return containsMatch.id

    // 3. Word overlap: "Restaurants" matches "Restaurants & Bars"
    const nameWords = nameLower.split(/[\s&,]+/).filter((w) => w.length > 2)
    if (nameWords.length > 0) {
      let bestMatch: typeof filtered[0] | null = null
      let bestScore = 0
      for (const cat of filtered) {
        const catWords = cat.name.toLowerCase().split(/[\s&,]+/).filter((w) => w.length > 2)
        const overlap = nameWords.filter((w) => catWords.some((cw) => cw.includes(w) || w.includes(cw))).length
        const score = overlap / Math.max(nameWords.length, catWords.length)
        if (score > bestScore && score >= 0.4) {
          bestScore = score
          bestMatch = cat
        }
      }
      if (bestMatch) return bestMatch.id
    }

    return null
  }

  try {
    // Load existing budgets for deduplication (match by name + tier)
    const existingBudgets = await db.budget.findMany({
      where: { userId: session!.userId },
      include: { annualExpense: true },
    })
    const existingByKey = new Map(
      existingBudgets.map((b) => [`${b.name.toLowerCase()}::${b.tier}`, b])
    )

    const results = await db.$transaction(async (tx) => {
      const created = { fixed: 0, flexible: 0, annual: 0 }

      // ── Fixed budgets ──
      for (const item of proposal.fixed) {
        const categoryId = findCategoryId(item.category, 'expense')
        const key = `${item.name.toLowerCase()}::FIXED`
        const existing = existingByKey.get(key)

        if (existing) {
          await tx.budget.update({
            where: { id: existing.id },
            data: { amount: item.amount, categoryId, isAutoPay: item.isAutoPay, dueDay: item.dueDay },
          })
        } else {
          await tx.budget.create({
            data: {
              userId: session!.userId,
              name: item.name,
              amount: item.amount,
              period: 'MONTHLY',
              tier: 'FIXED',
              startDate: startOfMonth,
              categoryId,
              isAutoPay: item.isAutoPay,
              dueDay: item.dueDay,
            },
          })
        }
        created.fixed++
      }

      // ── Flexible budgets ──
      for (const item of proposal.flexible) {
        const categoryId = findCategoryId(item.category, 'expense')
        const key = `${item.name.toLowerCase()}::FLEXIBLE`
        const existing = existingByKey.get(key)

        if (existing) {
          await tx.budget.update({
            where: { id: existing.id },
            data: { amount: item.amount, categoryId },
          })
        } else {
          await tx.budget.create({
            data: {
              userId: session!.userId,
              name: item.name,
              amount: item.amount,
              period: 'MONTHLY',
              tier: 'FLEXIBLE',
              startDate: startOfMonth,
              categoryId,
            },
          })
        }
        created.flexible++
      }

      // ── Annual budgets + AnnualExpense records ──
      for (const item of proposal.annual) {
        const categoryId = findCategoryId(item.category, 'expense')

        // AI may return null/undefined for dueMonth on suggested items — default to 6 months out
        const dueMonth =
          typeof item.dueMonth === 'number' && item.dueMonth >= 1 && item.dueMonth <= 12
            ? item.dueMonth
            : ((now.getMonth() + 6) % 12) + 1

        const dueYear = now.getMonth() + 1 >= dueMonth ? now.getFullYear() + 1 : now.getFullYear()
        const targetDate = new Date(dueYear, dueMonth - 1, 1)
        const monthsLeft = Math.max(
          1,
          (targetDate.getFullYear() - now.getFullYear()) * 12 +
            (targetDate.getMonth() - now.getMonth())
        )
        const monthlySetAside = Math.ceil((item.annualAmount / monthsLeft) * 100) / 100

        const key = `${item.name.toLowerCase()}::ANNUAL`
        const existing = existingByKey.get(key)

        if (existing) {
          await tx.budget.update({
            where: { id: existing.id },
            data: { amount: monthlySetAside, categoryId },
          })
          if (existing.annualExpense) {
            await tx.annualExpense.update({
              where: { id: existing.annualExpense.id },
              data: { annualAmount: item.annualAmount, dueMonth, dueYear, monthlySetAside, isRecurring: item.isRecurring ?? false },
            })
          } else {
            await tx.annualExpense.create({
              data: {
                budgetId: existing.id,
                userId: session!.userId,
                name: item.name,
                annualAmount: item.annualAmount,
                dueMonth,
                dueYear,
                isRecurring: item.isRecurring ?? false,
                monthlySetAside,
                funded: 0,
                status: 'planned',
              },
            })
          }
        } else {
          const budget = await tx.budget.create({
            data: {
              userId: session!.userId,
              name: item.name,
              amount: monthlySetAside,
              period: 'MONTHLY',
              tier: 'ANNUAL',
              startDate: startOfMonth,
              categoryId,
            },
          })

          await tx.annualExpense.create({
            data: {
              budgetId: budget.id,
              userId: session!.userId,
              name: item.name,
              annualAmount: item.annualAmount,
              dueMonth,
              dueYear,
              isRecurring: item.isRecurring ?? false,
              monthlySetAside,
              funded: 0,
              status: 'planned',
            },
          })
        }
        created.annual++
      }

      return created
    })

    revalidatePath('/budgets')
    revalidatePath('/dashboard')
    return NextResponse.json({
      message: 'Budget applied successfully',
      created: results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to apply budget'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
