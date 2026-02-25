import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

// POST /api/reimport — Previously read from a bundled CSV file.
// That CSV has been removed from the deployment bundle for security.
// Users should import data through the CSV import wizard at /transactions/import.
export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  return NextResponse.json(
    {
      error: 'This endpoint has been retired. Please use the CSV import wizard at /transactions/import to import transaction data.',
    },
    { status: 410 },
  )
}
