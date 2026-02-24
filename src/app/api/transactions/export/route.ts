import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

// GET export transactions as CSV
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const transactions = await db.transaction.findMany({
    where: { userId: session.userId },
    include: {
      category: { select: { name: true, group: true, type: true } },
      account: { select: { name: true } },
      householdMember: { select: { name: true } },
      property: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  })

  // Build CSV
  const headers = ['Date', 'Merchant', 'Amount', 'Category', 'Category Group', 'Type', 'Account', 'Person', 'Property', 'Notes']
  const rows = transactions.map((tx) => [
    tx.date.toISOString().split('T')[0],
    csvEscape(tx.merchant),
    tx.amount.toFixed(2),
    csvEscape(tx.category?.name ?? ''),
    csvEscape(tx.category?.group ?? ''),
    tx.category?.type ?? '',
    csvEscape(tx.account?.name ?? ''),
    csvEscape(tx.householdMember?.name ?? ''),
    csvEscape(tx.property?.name ?? ''),
    csvEscape(tx.notes ?? ''),
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="oversikt-transactions-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
