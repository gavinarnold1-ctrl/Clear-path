import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const budget = await db.budget.findFirst({
    where: { id, userId: session.userId },
    include: { category: true, annualExpense: true },
  })

  if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })

  return NextResponse.json(budget)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const budget = await db.budget.findFirst({
    where: { id, userId: session.userId },
  })
  if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })

  const { name, amount, categoryId, period, dueDay, isAutoPay, varianceLimit } = body

  if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
    return NextResponse.json({ error: 'Budget name is required' }, { status: 400 })
  }
  if (amount !== undefined && (!isFinite(amount) || amount <= 0)) {
    return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
  }
  if (dueDay !== undefined && dueDay !== null && (dueDay < 1 || dueDay > 31)) {
    return NextResponse.json({ error: 'Due day must be between 1 and 31' }, { status: 400 })
  }
  if (varianceLimit !== undefined && varianceLimit !== null && (!isFinite(varianceLimit) || varianceLimit < 0)) {
    return NextResponse.json({ error: 'Variance limit must be a non-negative number' }, { status: 400 })
  }

  if (categoryId !== undefined && categoryId !== null) {
    const category = await db.category.findFirst({
      where: { id: categoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name.trim()
  if (amount !== undefined) data.amount = amount
  if (categoryId !== undefined) data.categoryId = categoryId || null
  if (period !== undefined) data.period = period
  if (dueDay !== undefined) data.dueDay = dueDay
  if (isAutoPay !== undefined) data.isAutoPay = isAutoPay
  if (varianceLimit !== undefined) data.varianceLimit = varianceLimit

  const updated = await db.budget.update({
    where: { id },
    data,
    include: { category: true, annualExpense: true },
  })

  revalidatePath('/budgets')
  revalidatePath('/dashboard')
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const budget = await db.budget.findFirst({
    where: { id, userId: session.userId },
  })
  if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })

  await db.budget.delete({ where: { id } })

  revalidatePath('/budgets')
  revalidatePath('/dashboard')
  return NextResponse.json({ success: true })
}
