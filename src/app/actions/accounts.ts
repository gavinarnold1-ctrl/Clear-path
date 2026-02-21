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

  if (!name) return { error: 'Account name is required.' }
  if (!type) return { error: 'Account type is required.' }
  if (isNaN(balance)) return { error: 'Balance must be a valid number.' }

  await db.account.create({
    data: {
      userId: session.userId,
      name,
      type: type as 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH',
      balance,
      currency,
    },
  })

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  redirect('/accounts')
}

export async function deleteAccount(id: string): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')

  // Cascade delete removes transactions too (configured in schema)
  await db.account.delete({ where: { id, userId: session.userId } })

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
}
