import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from '@/lib/plaid'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: session.userId },
      client_name: 'Oversikt',
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: 'en',
    })

    return NextResponse.json({ link_token: response.data.link_token })
  } catch (error) {
    console.error('Plaid link token creation failed:', error)
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 })
  }
}
