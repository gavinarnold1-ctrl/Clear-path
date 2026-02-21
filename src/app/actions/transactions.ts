'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

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
  const description = (formData.get('description') as string)?.trim()
  const date = formData.get('date') as string
  const type = formData.get('type') as string
  const accountId = formData.get('accountId') as string
  const categoryId = (formData.get('categoryId') as string) || null
  const notes = (formData.get('notes') as string)?.trim() || null

  const VALID_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const
  type TxType = (typeof VALID_TYPES)[number]

  if (!amount || amount <= 0) return { error: 'Amount must be a positive number.' }
  if (!description) return { error: 'Description is required.' }
  if (!date) return { error: 'Date is required.' }
  if (!accountId) return { error: 'Please select an account.' }
  if (!(VALID_TYPES as readonly string[]).includes(type)) return { error: 'Invalid transaction type.' }

  const validType = type as TxType
  const txDate = new Date(date)

  await db.$transaction(async (tx) => {
    // 1. Create the transaction record
    await tx.transaction.create({
      data: { userId: session.userId, accountId, categoryId, amount, description, date: txDate, type: validType, notes },
    })

    // 2. Adjust account balance
    if (validType === 'INCOME') {
      await tx.account.update({ where: { id: accountId }, data: { balance: { increment: amount } } })
    } else if (validType === 'EXPENSE') {
      await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: amount } } })
    }

    // 3. Update matching active budget's spent counter
    if (categoryId && validType === 'EXPENSE') {
      const budget = await tx.budget.findFirst({
        where: {
          userId: session.userId,
          categoryId,
          startDate: { lte: txDate },
          OR: [{ endDate: null }, { endDate: { gte: txDate } }],
        },
      })
      if (budget) {
        await tx.budget.update({ where: { id: budget.id }, data: { spent: { increment: amount } } })
      }
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
    const existing = await tx.transaction.findUnique({ where: { id, userId: session.userId } })
    if (!existing) return

    await tx.transaction.delete({ where: { id } })

    // Reverse account balance
    if (existing.type === 'INCOME') {
      await tx.account.update({ where: { id: existing.accountId }, data: { balance: { decrement: existing.amount } } })
    } else if (existing.type === 'EXPENSE') {
      await tx.account.update({ where: { id: existing.accountId }, data: { balance: { increment: existing.amount } } })
    }

    // Reverse budget spent
    if (existing.categoryId && existing.type === 'EXPENSE') {
      const budget = await tx.budget.findFirst({
        where: {
          userId: session.userId,
          categoryId: existing.categoryId,
          startDate: { lte: existing.date },
          OR: [{ endDate: null }, { endDate: { gte: existing.date } }],
        },
      })
      if (budget) {
        await tx.budget.update({
          where: { id: budget.id },
          data: { spent: { decrement: existing.amount } },
        })
      }
    }
  })

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/budgets')
}
