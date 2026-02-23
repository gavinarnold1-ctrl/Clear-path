import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const expense = await db.annualExpense.findFirst({
    where: { id, userId: session.userId },
    include: { budget: { include: { category: true } } },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(expense)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action } = body

  const expense = await db.annualExpense.findFirst({
    where: { id, userId: session.userId },
    include: { budget: true },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  switch (action) {
    case 'fund': {
      const { amount } = body
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
      }

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

      const updated = await db.$transaction(async (tx) => {
        const ae = await tx.annualExpense.update({
          where: { id },
          data: {
            funded: newFunded,
            monthlySetAside: newSetAside,
            status: newFunded >= expense.annualAmount ? 'funded' : expense.status,
          },
          include: { budget: { include: { category: true } } },
        })

        await tx.budget.update({
          where: { id: expense.budgetId },
          data: { amount: newSetAside },
        })

        return ae
      })

      return NextResponse.json(updated)
    }

    case 'markSpent': {
      const { actualCost, actualDate, notes } = body

      if (!actualCost || actualCost <= 0) {
        return NextResponse.json({ error: 'Actual cost must be positive' }, { status: 400 })
      }

      const status = actualCost > expense.annualAmount ? 'overspent' : 'spent'

      const updated = await db.annualExpense.update({
        where: { id },
        data: {
          status,
          actualCost,
          actualDate: actualDate ? new Date(actualDate) : new Date(),
          notes: notes?.trim() || expense.notes,
          monthlySetAside: 0,
        },
        include: { budget: { include: { category: true } } },
      })

      // Update parent budget set-aside to 0
      await db.budget.update({
        where: { id: expense.budgetId },
        data: { amount: 0 },
      })

      // If recurring, create next year's expense
      if (expense.isRecurring) {
        const nextYear = expense.dueYear + 1
        const now = new Date()
        const nextTargetDate = new Date(nextYear, expense.dueMonth - 1, 1)
        const monthsUntilNext = Math.max(
          1,
          (nextTargetDate.getFullYear() - now.getFullYear()) * 12 +
            (nextTargetDate.getMonth() - now.getMonth())
        )
        const nextSetAside =
          Math.ceil((expense.annualAmount / monthsUntilNext) * 100) / 100

        await db.$transaction(async (tx) => {
          const newBudget = await tx.budget.create({
            data: {
              name: expense.name,
              amount: expense.annualAmount,
              spent: 0,
              period: 'YEARLY',
              tier: 'ANNUAL',
              startDate: new Date(now.getFullYear(), 0, 1),
              endDate: nextTargetDate,
              userId: session.userId,
              categoryId: expense.budget.categoryId,
            },
          })

          await tx.annualExpense.create({
            data: {
              budgetId: newBudget.id,
              name: expense.name,
              annualAmount: expense.annualAmount,
              dueMonth: expense.dueMonth,
              dueYear: nextYear,
              isRecurring: true,
              monthlySetAside: nextSetAside,
              funded: 0,
              status: 'planned',
              notes: expense.notes,
              userId: session.userId,
            },
          })
        })
      }

      return NextResponse.json(updated)
    }

    case 'edit': {
      const {
        name,
        annualAmount,
        dueMonth,
        dueYear,
        isRecurring,
        notes: editNotes,
        categoryId,
      } = body

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name.trim()
      if (annualAmount !== undefined) updateData.annualAmount = annualAmount
      if (dueMonth !== undefined) updateData.dueMonth = dueMonth
      if (dueYear !== undefined) updateData.dueYear = dueYear
      if (isRecurring !== undefined) updateData.isRecurring = isRecurring
      if (editNotes !== undefined) updateData.notes = editNotes?.trim() || null

      // Recalculate monthlySetAside if amount or due date changed
      if (annualAmount !== undefined || dueMonth !== undefined || dueYear !== undefined) {
        const newAmount = (annualAmount as number) ?? expense.annualAmount
        const newDueMonth = (dueMonth as number) ?? expense.dueMonth
        const newDueYear = (dueYear as number) ?? expense.dueYear
        const now = new Date()
        const targetDate = new Date(newDueYear, newDueMonth - 1, 1)
        const monthsRemaining = Math.max(
          1,
          (targetDate.getFullYear() - now.getFullYear()) * 12 +
            (targetDate.getMonth() - now.getMonth())
        )
        const remaining = Math.max(0, newAmount - expense.funded)
        updateData.monthlySetAside = Math.ceil((remaining / monthsRemaining) * 100) / 100
      }

      const updated = await db.annualExpense.update({
        where: { id },
        data: updateData,
        include: { budget: { include: { category: true } } },
      })

      // Also update parent budget if amount, category, or name changed
      const budgetUpdate: Record<string, unknown> = {}
      if (name !== undefined) budgetUpdate.name = name.trim()
      if (annualAmount !== undefined) budgetUpdate.amount = annualAmount
      if (categoryId !== undefined) budgetUpdate.categoryId = categoryId || null

      if (Object.keys(budgetUpdate).length > 0) {
        await db.budget.update({
          where: { id: expense.budgetId },
          data: budgetUpdate,
        })
      }

      return NextResponse.json(updated)
    }

    case 'linkTransaction': {
      const { transactionId } = body
      if (!transactionId) {
        return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 })
      }

      const transaction = await db.transaction.findFirst({
        where: { id: transactionId, userId: session.userId },
      })
      if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
      }

      const txAmount = Math.abs(transaction.amount)

      const updated = await db.$transaction(async (tx) => {
        // Link transaction to annual expense
        await tx.transaction.update({
          where: { id: transactionId },
          data: { annualExpenseId: id },
        })

        // Increase funded amount by the transaction amount
        const newFunded = expense.funded + txAmount
        const remaining = Math.max(0, expense.annualAmount - newFunded)

        const now = new Date()
        const targetDate = new Date(expense.dueYear, expense.dueMonth - 1, 1)
        const monthsRemaining = Math.max(
          1,
          (targetDate.getFullYear() - now.getFullYear()) * 12 +
            (targetDate.getMonth() - now.getMonth())
        )
        const newSetAside = remaining > 0 ? Math.ceil((remaining / monthsRemaining) * 100) / 100 : 0

        const ae = await tx.annualExpense.update({
          where: { id },
          data: {
            funded: newFunded,
            monthlySetAside: newSetAside,
            status: newFunded >= expense.annualAmount ? 'funded' : expense.status,
          },
          include: { budget: { include: { category: true } } },
        })

        await tx.budget.update({
          where: { id: expense.budgetId },
          data: { amount: newSetAside },
        })

        return ae
      })

      return NextResponse.json(updated)
    }

    case 'unlinkTransaction': {
      const { transactionId: unlinkTxId } = body
      if (!unlinkTxId) {
        return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 })
      }

      const unlinkTx = await db.transaction.findFirst({
        where: { id: unlinkTxId, userId: session.userId, annualExpenseId: id },
      })
      if (!unlinkTx) {
        return NextResponse.json({ error: 'Transaction not found or not linked' }, { status: 404 })
      }

      const txAmt = Math.abs(unlinkTx.amount)

      const updated = await db.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: unlinkTxId },
          data: { annualExpenseId: null },
        })

        const newFunded = Math.max(0, expense.funded - txAmt)
        const remaining = Math.max(0, expense.annualAmount - newFunded)

        const now = new Date()
        const targetDate = new Date(expense.dueYear, expense.dueMonth - 1, 1)
        const monthsRemaining = Math.max(
          1,
          (targetDate.getFullYear() - now.getFullYear()) * 12 +
            (targetDate.getMonth() - now.getMonth())
        )
        const newSetAside = remaining > 0 ? Math.ceil((remaining / monthsRemaining) * 100) / 100 : 0

        const ae = await tx.annualExpense.update({
          where: { id },
          data: {
            funded: newFunded,
            monthlySetAside: newSetAside,
            status: newFunded >= expense.annualAmount ? 'funded' : 'planned',
          },
          include: { budget: { include: { category: true } } },
        })

        await tx.budget.update({
          where: { id: expense.budgetId },
          data: { amount: newSetAside },
        })

        return ae
      })

      return NextResponse.json(updated)
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const expense = await db.annualExpense.findFirst({
    where: { id, userId: session.userId },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.$transaction(async (tx) => {
    await tx.annualExpense.delete({ where: { id } })
    await tx.budget.delete({ where: { id: expense.budgetId } })
  })

  return NextResponse.json({ success: true })
}
