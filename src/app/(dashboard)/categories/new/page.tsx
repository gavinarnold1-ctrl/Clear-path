import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import CategoryForm from '@/components/forms/CategoryForm'

export const metadata: Metadata = { title: 'New Category' }

export default async function NewCategoryPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">New category</h1>
      <div className="card">
        <CategoryForm />
      </div>
    </div>
  )
}
