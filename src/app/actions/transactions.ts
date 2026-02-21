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
  const type = formData.get('type') as 'INCOME' | 'EXPENSE' | 'TRANSFER'
  const accountId = formData.get('accountId') as string
  const categoryId = (formData.get('categoryId') as string) || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!amount || amount <= 0) return { error: 'Amount must be a positive number.' }
  if (!description) return { error: 'Description is required.' }
  if (!date) return { error: 'Date is required.' }
  if (!accountId) return { error: 'Please select an account.' }

  await db.transaction.create({
    data: {
      userId: session.userId,
      accountId,
      categoryId,
      amount,
      description,
      date: new Date(date),
      type,
      notes,
    },
  })

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  redirect('/transactions')
}

export async function deleteTransaction(id: string): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')

  // userId guard prevents deleting another user's transaction
  await db.transaction.delete({ where: { id, userId: session.userId } })

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
}
