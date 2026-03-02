import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import TransactionForm from '@/components/forms/TransactionForm'

export const metadata: Metadata = { title: 'New Transaction' }

export default async function NewTransactionPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [accounts, categories, householdMembers, properties, propertyGroups] = await Promise.all([
    db.account.findMany({ where: { userId: session.userId }, orderBy: { name: 'asc' } }),
    db.category.findMany({
      where: { OR: [{ userId: session.userId }, { userId: null, isDefault: true }], isActive: true },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    }),
    db.householdMember.findMany({
      where: { userId: session.userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
    db.property.findMany({
      where: { userId: session.userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true, groupId: true, splitPct: true, taxSchedule: true },
    }),
    db.propertyGroup.findMany({
      where: { userId: session.userId },
      include: {
        properties: { select: { id: true, name: true, splitPct: true, taxSchedule: true } },
      },
    }),
  ])

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-fjord">New transaction</h1>
      <div className="card">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          householdMembers={householdMembers}
          properties={properties.map(p => ({
            id: p.id,
            name: p.name,
            isDefault: p.isDefault,
            groupId: p.groupId,
            splitPct: p.splitPct ? Number(p.splitPct) : null,
            taxSchedule: p.taxSchedule,
          }))}
          propertyGroups={propertyGroups.map(g => ({
            id: g.id,
            name: g.name,
            properties: g.properties.map(p => ({
              id: p.id,
              name: p.name,
              splitPct: p.splitPct ? Number(p.splitPct) : null,
              taxSchedule: p.taxSchedule,
            })),
          }))}
        />
      </div>
    </div>
  )
}
