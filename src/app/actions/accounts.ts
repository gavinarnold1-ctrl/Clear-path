'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

interface AccountState {
  error: string | null
}

export async function createAccount(
  prevState: AccountState,
  formData: FormData
): Promise<AccountState> {
  const session = await getSession()
  if (!session) redirect('/login')

  const name = (formData.get('name') as string)?.trim()
  const type = formData.get('type') as string
  const balance = parseFloat((formData.get('balance') as string) ?? '0')
  const currency = (formData.get('currency') as string)?.trim() || 'USD'
  const ownerId = (formData.get('ownerId') as string)?.trim() || null

  if (!name) return { error: 'Account name is required.' }
  if (!type) return { error: 'Account type is required.' }
  if (isNaN(balance)) return { error: 'Balance must be a valid number.' }

  const duplicate = await db.account.findFirst({
    where: { userId: session.userId, name: { equals: name, mode: 'insensitive' } },
  })
  if (duplicate) return { error: 'An account with this name already exists.' }

  await db.account.create({
    data: {
      userId: session.userId,
      name,
      type: type as 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH' | 'MORTGAGE' | 'AUTO_LOAN' | 'STUDENT_LOAN',
      balance,
      currency,
      ...(ownerId && { ownerId }),
    },
  })

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  redirect('/accounts')
}

export async function deleteAccount(id: string): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')

  // Unlink transactions first (set accountId to null), then delete the account.
  // Account→Transaction relation uses SetNull by default for optional FK,
  // but being explicit is safer and matches the API route behavior.
  await db.$transaction([
    db.transaction.updateMany({
      where: { accountId: id, userId: session.userId },
      data: { accountId: null },
    }),
    db.account.delete({ where: { id, userId: session.userId } }),
  ])

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
}
