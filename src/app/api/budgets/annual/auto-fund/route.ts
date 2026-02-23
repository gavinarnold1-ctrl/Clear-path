import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { allocations } = body as {
      allocations: { expenseId: string; amount: number }[]
    }

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json({ error: 'No allocations provided' }, { status: 400 })
    }

    let funded = 0
    let totalFunded = 0

    for (const { expenseId, amount } of allocations) {
      if (!amount || amount <= 0) continue

      const expense = await db.annualExpense.findFirst({
        where: { id: expenseId, userId: session.userId },
        include: { budget: true },
      })
      if (!expense) continue
      if (expense.status === 'spent' || expense.status === 'overspent') continue

      const newFunded = expense.funded + amount
      const remaining = Math.max(0, expense.annualAmount - newFunded)

      const now = new Date()
      const targetDate = new Date(expense.dueYear, expense.dueMonth - 1, 1)
      const monthsRemaining = Math.max(
        1,
        (targetDate.getFullYear() - now.getFullYear()) * 12 +
          (targetDate.getMonth() - now.getMonth())
      )
      const newSetAside = remaining > 0 ? Math.ceil((remaining / monthsRemaining) * 100) / 100 : 0

      await db.$transaction(async (tx) => {
        await tx.annualExpense.update({
          where: { id: expenseId },
          data: {
            funded: newFunded,
            monthlySetAside: newSetAside,
            status: newFunded >= expense.annualAmount ? 'funded' : expense.status,
          },
        })
        await tx.budget.update({
          where: { id: expense.budgetId },
          data: { amount: newSetAside },
        })
      })

      funded++
      totalFunded += amount
    }

    return NextResponse.json({ funded, totalFunded })
  } catch (error) {
    console.error('Auto-fund failed:', error)
    return NextResponse.json({ error: 'Failed to auto-fund' }, { status: 500 })
  }
}
