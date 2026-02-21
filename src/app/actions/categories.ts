'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

interface CategoryState {
  error: string | null
}

export async function createCategory(
  prevState: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const session = await getSession()
  if (!session) redirect('/login')

  const name = (formData.get('name') as string)?.trim()
  const type = formData.get('type') as string
  const color = (formData.get('color') as string) || '#6366f1'
  const icon = (formData.get('icon') as string)?.trim() || null

  const VALID_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const
  type CatType = (typeof VALID_TYPES)[number]

  if (!name) return { error: 'Category name is required.' }
  if (!(VALID_TYPES as readonly string[]).includes(type)) return { error: 'Invalid category type.' }
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return { error: 'Invalid color — use a 6-digit hex code like #6366f1.' }

  const validType = type as CatType

  const existing = await db.category.findFirst({
    where: { userId: session.userId, name, type: validType },
  })
  if (existing) return { error: `A ${validType.toLowerCase()} category named "${name}" already exists.` }

  await db.category.create({
    data: {
      userId: session.userId,
      name,
      type: validType,
      color,
      icon,
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
