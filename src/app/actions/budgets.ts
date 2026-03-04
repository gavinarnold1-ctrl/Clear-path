'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { calculateMonthlySetAside } from '@/lib/budget-engine'
import type { BudgetTier } from '@/types'

interface BudgetState {
  error: string | null
}

const VALID_TIERS: BudgetTier[] = ['FIXED', 'FLEXIBLE', 'ANNUAL']

export async function createBudget(
  prevState: BudgetState,
  formData: FormData
): Promise<BudgetState> {
  const session = await getSession()
  if (!session) redirect('/login')

  const name = (formData.get('name') as string)?.trim()
  const amount = parseFloat(formData.get('amount') as string)
  const tier = (formData.get('tier') as string) || 'FLEXIBLE'
  const categoryId = (formData.get('categoryId') as string) || null
  const startDate = formData.get('startDate') as string

  if (!name) return { error: 'Budget name is required.' }
  if (!VALID_TIERS.includes(tier as BudgetTier)) return { error: 'Invalid budget tier.' }
  if (!startDate) return { error: 'Start date is required.' }
  if (tier !== 'ANNUAL' && (!isFinite(amount) || amount <= 0)) {
    return { error: 'Amount must be a positive number.' }
  }

  // Tier-specific validation and field extraction
  if (tier === 'FIXED') {
    if (!amount || amount <= 0) return { error: 'Amount must be a positive number.' }

    const rawDueDay = formData.get('dueDay') as string
    const dueDay = rawDueDay ? parseInt(rawDueDay, 10) : null
    const isAutoPay = formData.get('isAutoPay') === 'true'
    const rawVariance = formData.get('varianceLimit') as string
    const varianceLimit = rawVariance ? parseFloat(rawVariance) : null

    if (varianceLimit !== null && (!isFinite(varianceLimit) || varianceLimit < 0)) {
      return { error: 'Variance limit must be a non-negative number.' }
    }

    if (dueDay !== null && (dueDay < 1 || dueDay > 31)) {
      return { error: 'Due day must be between 1 and 31.' }
    }

    await db.budget.create({
      data: {
        userId: session.userId,
        name,
        amount,
        period: 'MONTHLY',
        tier: 'FIXED',
        categoryId,
        startDate: new Date(startDate),
        isAutoPay,
        dueDay,
        varianceLimit,
      },
    })
  } else if (tier === 'FLEXIBLE') {
    if (!amount || amount <= 0) return { error: 'Amount must be a positive number.' }

    const period = (formData.get('period') as string) || 'MONTHLY'
    const endDate = (formData.get('endDate') as string) || null

    await db.budget.create({
      data: {
        userId: session.userId,
        name,
        amount,
        period: period as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM',
        tier: 'FLEXIBLE',
        categoryId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      },
    })
  } else if (tier === 'ANNUAL') {
    const annualAmount = parseFloat(formData.get('annualAmount') as string)
    const dueMonth = parseInt(formData.get('dueMonth') as string, 10)
    const dueYear = parseInt(formData.get('dueYear') as string, 10)
    const isRecurring = formData.get('isRecurring') === 'true'
    const funded = parseFloat(formData.get('funded') as string) || 0
    const notes = (formData.get('notes') as string)?.trim() || null

    if (!annualAmount || annualAmount <= 0) return { error: 'Annual amount must be a positive number.' }
    if (!dueMonth || dueMonth < 1 || dueMonth > 12) return { error: 'Due month must be between 1 and 12.' }
    if (!dueYear || dueYear < 2024) return { error: 'Due year is required.' }

    const monthlySetAside = calculateMonthlySetAside(annualAmount, funded, dueMonth, dueYear)

    await db.$transaction(async (tx) => {
      const budget = await tx.budget.create({
        data: {
          userId: session.userId,
          name,
          amount: monthlySetAside,
          period: 'MONTHLY',
          tier: 'ANNUAL',
          categoryId,
          startDate: new Date(startDate),
        },
      })

      await tx.annualExpense.create({
        data: {
          userId: session.userId,
          budgetId: budget.id,
          name,
          annualAmount,
          dueMonth,
          dueYear,
          isRecurring,
          monthlySetAside,
          funded,
          notes,
        },
      })
    })
  }

  revalidatePath('/budgets')
  redirect('/budgets')
}

export async function fundAnnualExpense(
  budgetId: string,
  amount: number
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) redirect('/login')

  if (!isFinite(amount) || amount <= 0) return { error: 'Fund amount must be a positive number.' }

  const budget = await db.budget.findFirst({
    where: { id: budgetId, userId: session.userId, tier: 'ANNUAL' },
    include: { annualExpense: true },
  })

  if (!budget || !budget.annualExpense) return { error: 'Annual budget not found.' }

  const newFunded = budget.annualExpense.funded + amount
  const newMonthlySetAside = calculateMonthlySetAside(
    budget.annualExpense.annualAmount,
    newFunded,
    budget.annualExpense.dueMonth,
    budget.annualExpense.dueYear
  )

  const status = newFunded >= budget.annualExpense.annualAmount ? 'funded' : 'planned'

  await db.$transaction([
    db.annualExpense.update({
      where: { id: budget.annualExpense.id },
      data: {
        funded: newFunded,
        monthlySetAside: newMonthlySetAside,
        status,
      },
    }),
    db.budget.update({
      where: { id: budgetId },
      data: { amount: newMonthlySetAside },
    }),
  ])

  revalidatePath('/budgets')
  return { error: null }
}

export async function updateBudget(
  prevState: BudgetState,
  formData: FormData
): Promise<BudgetState> {
  const session = await getSession()
  if (!session) redirect('/login')

  const id = formData.get('id') as string
  if (!id) return { error: 'Budget ID is required.' }

  const budget = await db.budget.findFirst({
    where: { id, userId: session.userId },
  })
  if (!budget) return { error: 'Budget not found.' }

  const name = (formData.get('name') as string)?.trim()
  const amount = parseFloat(formData.get('amount') as string)
  const categoryId = (formData.get('categoryId') as string) || null

  if (!name) return { error: 'Budget name is required.' }
  if (!isFinite(amount) || amount <= 0) return { error: 'Amount must be a positive number.' }

  const data: Record<string, unknown> = { name, amount, categoryId }

  if (budget.tier === 'FIXED') {
    const rawDueDay = formData.get('dueDay') as string
    const dueDay = rawDueDay ? parseInt(rawDueDay, 10) : null
    const isAutoPay = formData.get('isAutoPay') === 'true'
    const rawVariance = formData.get('varianceLimit') as string
    const varianceLimit = rawVariance ? parseFloat(rawVariance) : null

    if (dueDay !== null && (dueDay < 1 || dueDay > 31)) {
      return { error: 'Due day must be between 1 and 31.' }
    }
    if (varianceLimit !== null && (!isFinite(varianceLimit) || varianceLimit < 0)) {
      return { error: 'Variance limit must be a non-negative number.' }
    }

    data.dueDay = dueDay
    data.isAutoPay = isAutoPay
    data.varianceLimit = varianceLimit
  } else if (budget.tier === 'FLEXIBLE') {
    const period = (formData.get('period') as string) || 'MONTHLY'
    const endDate = (formData.get('endDate') as string) || null
    data.period = period
    data.endDate = endDate ? new Date(endDate) : null
  }

  await db.budget.update({ where: { id }, data })

  revalidatePath('/budgets')
  redirect('/budgets')
}

export async function deleteBudget(id: string): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')

  await db.budget.delete({ where: { id, userId: session.userId } })

  revalidatePath('/budgets')
}
