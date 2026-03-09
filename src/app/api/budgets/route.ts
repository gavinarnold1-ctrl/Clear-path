import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_TIERS = new Set(['FIXED', 'FLEXIBLE', 'ANNUAL'])

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = req.nextUrl.searchParams.get('tier')

  const budgets = await db.budget.findMany({
    where: {
      userId: session.userId,
      ...(tier && VALID_TIERS.has(tier) ? { tier: tier as 'FIXED' | 'FLEXIBLE' | 'ANNUAL' } : {}),
    },
    select: {
      id: true,
      name: true,
      amount: true,
      tier: true,
      period: true,
      startDate: true,
      endDate: true,
      categoryId: true,
      isAutoPay: true,
      dueDay: true,
      varianceLimit: true,
      sortOrder: true,
      category: {
        select: { id: true, name: true, group: true, icon: true },
      },
      annualExpense: {
        select: {
          id: true,
          name: true,
          annualAmount: true,
          dueMonth: true,
          dueYear: true,
          isRecurring: true,
          funded: true,
          status: true,
          monthlySetAside: true,
        },
      },
    },
    orderBy: { startDate: 'desc' },
  })

  return NextResponse.json(budgets, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { categoryId, name, amount, period, tier, startDate, endDate } = body

  if (!name || !amount || !startDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (tier && !VALID_TIERS.has(tier)) {
    return NextResponse.json({ error: 'Invalid budget tier' }, { status: 400 })
  }

  if (categoryId) {
    const category = await db.category.findFirst({
      where: { id: categoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  const budget = await db.budget.create({
    data: {
      userId: session.userId,
      categoryId: categoryId ?? null,
      name,
      amount,
      period: period ?? 'MONTHLY',
      tier: tier ?? 'FLEXIBLE',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
    include: { category: true, annualExpense: true },
  })

  revalidatePath('/budgets')
  revalidatePath('/dashboard')
  return NextResponse.json(budget, { status: 201 })
}
