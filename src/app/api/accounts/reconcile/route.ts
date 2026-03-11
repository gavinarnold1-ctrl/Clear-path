import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { reconcileAllAccounts } from '@/lib/balance-reconciliation'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const results = await reconcileAllAccounts(session.userId)

    const summary = {
      total: results.length,
      matched: results.filter(r => r.status === 'matched').length,
      discrepancies: results.filter(r => r.status === 'discrepancy').length,
    }

    return NextResponse.json({ results, summary })
  } catch (error) {
    console.error('Reconciliation failed:', error)
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 })
  }
}
