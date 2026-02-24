import { NextRequest, NextResponse } from 'next/server'
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

  // Resolve category IDs by name — look for user or system defaults
  async function findCategoryId(name: string, type: string): Promise<string | null> {
    const cat = await db.category.findFirst({
      where: {
        OR: [{ userId: session!.userId }, { userId: null, isDefault: true }],
        name: { equals: name, mode: 'insensitive' },
        type,
      },
      orderBy: { userId: 'desc' }, // prefer user categories over defaults
    })
    return cat?.id ?? null
  }

  try {
    const results = await db.$transaction(async (tx) => {
      const created = { fixed: 0, flexible: 0, annual: 0 }

      // ── Fixed budgets ──
      for (const item of proposal.fixed) {
        const categoryId = await findCategoryId(item.category, 'expense')

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
        created.fixed++
      }

      // ── Flexible budgets ──
      for (const item of proposal.flexible) {
        const categoryId = await findCategoryId(item.category, 'expense')

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
        created.flexible++
      }

      // ── Annual budgets + AnnualExpense records ──
      for (const item of proposal.annual) {
        const categoryId = await findCategoryId(item.category, 'expense')

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
        created.annual++
      }

      return created
    })

    return NextResponse.json({
      message: 'Budget applied successfully',
      created: results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to apply budget'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
