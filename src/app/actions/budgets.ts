'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

interface BudgetState {
  error: string | null
}

const VALID_TIERS = ['fixed', 'flexible', 'annual'] as const

export async function createBudget(
  prevState: BudgetState,
  formData: FormData
): Promise<BudgetState> {
  const session = await getSession()
  if (!session) redirect('/login')

  const name = (formData.get('name') as string)?.trim()
  const amount = parseFloat(formData.get('amount') as string)
  const tier = formData.get('tier') as string
  const categoryId = (formData.get('categoryId') as string) || null
  const startDate = formData.get('startDate') as string
  const endDate = (formData.get('endDate') as string) || null

  if (!name) return { error: 'Budget name is required.' }
  if (!amount || amount <= 0) return { error: 'Amount must be a positive number.' }
  if (!(VALID_TIERS as readonly string[]).includes(tier)) return { error: 'Tier is required (fixed, flexible, or annual).' }
  if (!startDate) return { error: 'Start date is required.' }

  await db.budget.create({
    data: {
      userId: session.userId,
      name,
      amount,
      tier,
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
