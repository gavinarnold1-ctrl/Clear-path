'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

interface CategoryState {
  error: string | null
}

const VALID_TYPES = ['income', 'expense', 'transfer'] as const

export async function createCategory(
  prevState: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const session = await getSession()
  if (!session) redirect('/login')

  const name = (formData.get('name') as string)?.trim()
  const type = (formData.get('type') as string)?.toLowerCase()
  const group = (formData.get('group') as string)?.trim() || 'Other'
  const icon = (formData.get('icon') as string)?.trim() || null

  if (!name) return { error: 'Category name is required.' }
  if (!(VALID_TYPES as readonly string[]).includes(type)) return { error: 'Invalid category type.' }

  const existing = await db.category.findFirst({
    where: { userId: session.userId, name, type, group },
  })
  if (existing) return { error: `A ${type} category named "${name}" in group "${group}" already exists.` }

  await db.category.create({
    data: {
      userId: session.userId,
      name,
      type,
      group,
      icon,
      isDefault: false,
    },
  })

  revalidatePath('/categories')
  redirect('/categories')
}

export async function deleteCategory(id: string): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')

  await db.category.delete({ where: { id, userId: session.userId } })

  revalidatePath('/categories')
}
