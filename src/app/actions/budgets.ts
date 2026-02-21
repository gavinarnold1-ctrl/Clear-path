'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

interface BudgetState {
  error: string | null
}

export async function createBudget(
  prevState: BudgetState,
  formData: FormData
): Promise<BudgetState> {
  const session = await getSession()
  if (!session) redirect('/login')

  const name = (formData.get('name') as string)?.trim()
  const amount = parseFloat(formData.get('amount') as string)
  const period = formData.get('period') as string
  const categoryId = (formData.get('categoryId') as string) || null
  const startDate = formData.get('startDate') as string
  const endDate = (formData.get('endDate') as string) || null

  if (!name) return { error: 'Budget name is required.' }
  if (!amount || amount <= 0) return { error: 'Amount must be a positive number.' }
  if (!period) return { error: 'Period is required.' }
  if (!startDate) return { error: 'Start date is required.' }

  // Pre-calculate spent from existing transactions in this period/category
  const spent = categoryId
    ? (
        await db.transaction.aggregate({
          where: {
            userId: session.userId,
            categoryId,
            type: 'EXPENSE',
            date: {
              gte: new Date(startDate),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          },
          _sum: { amount: true },
        })
      )._sum.amount ?? 0
    : 0

  await db.budget.create({
    data: {
      userId: session.userId,
      name,
      amount,
      spent,
      period: period as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM',
      categoryId,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
  })

  revalidatePath('/budgets')
  redirect('/budgets')
}

export async function deleteBudget(id: string): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')

  await db.budget.delete({ where: { id, userId: session.userId } })

  revalidatePath('/budgets')
}
