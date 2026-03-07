'use client'

import { useEffect } from 'react'
import { identifyUser } from '@/lib/analytics'

interface Props {
  userId: string
  email?: string
  name?: string
  goal?: string | null
  householdType?: string | null
  incomeRange?: string | null
  accountCount: number
  hasPlaid: boolean
  hasProperties: boolean
  isDemo: boolean
}

export function PostHogIdentify(props: Props) {
  useEffect(() => {
    identifyUser(props.userId, {
      email: props.email,
      name: props.name,
      goal: props.goal,
      household_type: props.householdType,
      income_range: props.incomeRange,
      account_count: props.accountCount,
      has_plaid: props.hasPlaid,
      has_properties: props.hasProperties,
      is_demo: props.isDemo,
    })
  }, [props.userId])

  return null
}
