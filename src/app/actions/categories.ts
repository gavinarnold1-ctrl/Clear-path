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
  const budgetTier = (formData.get('budgetTier') as string) || null
  const validTiers = ['FIXED', 'FLEXIBLE', 'ANNUAL']

  if (!name) return { error: 'Category name is required.' }
  if (!(VALID_TYPES as readonly string[]).includes(type)) return { error: 'Invalid category type.' }
  if (budgetTier && !validTiers.includes(budgetTier)) return { error: 'Invalid budget tier.' }

  // Case-insensitive duplicate check: Prisma 'insensitive' mode on PostgreSQL
  const existing = await db.category.findFirst({
    where: {
      userId: session.userId,
      name: { equals: name, mode: 'insensitive' },
      type,
      group: { equals: group, mode: 'insensitive' },
    },
  })
  if (existing) return { error: `A ${type} category named "${existing.name}" in group "${existing.group}" already exists.` }

  await db.category.create({
    data: {
      userId: session.userId,
      name,
      type,
      group,
      icon,
      isDefault: false,
      budgetTier: budgetTier as 'FIXED' | 'FLEXIBLE' | 'ANNUAL' | null,
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
