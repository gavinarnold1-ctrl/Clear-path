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
  const merchant = (formData.get('merchant') as string)?.trim()
  const date = formData.get('date') as string
  const accountId = (formData.get('accountId') as string) || null
  const categoryId = (formData.get('categoryId') as string) || null
  const householdMemberId = (formData.get('householdMemberId') as string) || null
  const propertyId = (formData.get('propertyId') as string) || null
  const notes = (formData.get('notes') as string)?.trim() || null
  const tags = (formData.get('tags') as string)?.trim() || null

  if (isNaN(amount) || amount === 0) return { error: 'Amount must be a non-zero number.' }
  if (!merchant) return { error: 'Merchant is required.' }
  if (!date) return { error: 'Date is required.' }

  // Determine sign based on category type
  let finalAmount = amount
  if (categoryId) {
    const category = await db.category.findUnique({ where: { id: categoryId } })
    if (category) {
      if (category.type === 'expense') {
        finalAmount = -Math.abs(amount)
      } else if (category.type === 'income') {
        finalAmount = Math.abs(amount)
      }
      // transfer: keep user-provided sign
    }
  }

  const txDate = new Date(date)

  await db.$transaction(async (tx) => {
    // 1. Create the transaction record
    await tx.transaction.create({
      data: { userId: session.userId, accountId, categoryId, householdMemberId, propertyId, amount: finalAmount, merchant, date: txDate, notes, tags },
    })

    // 2. Adjust account balance (amount sign already correct)
    if (accountId) {
      await tx.account.update({ where: { id: accountId }, data: { balance: { increment: finalAmount } } })
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
    if (existing.accountId) {
      await tx.account.update({ where: { id: existing.accountId }, data: { balance: { increment: -existing.amount } } })
    }
  })

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/budgets')
}
