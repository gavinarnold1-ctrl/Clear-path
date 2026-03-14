'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const QUICK_PICKS = [
  { goal: 'save_more', label: 'Save $20,000 by Dec 2027', sub: 'Emergency fund target' },
  { goal: 'pay_off_debt', label: 'Pay off credit cards by June 2027', sub: 'Debt freedom target' },
  { goal: 'build_wealth', label: 'Reach $100K net worth', sub: 'Wealth building milestone' },
  { goal: 'spend_smarter', label: 'Cut dining to $400/mo', sub: 'Spending reduction target' },
] as const

export default function GoalQuickPick() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handlePick(goal: string) {
    setLoading(goal)
    try {
      // Step 1: Set the primary goal
      const goalRes = await fetch('/api/profile/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryGoal: goal }),
      })
      if (!goalRes.ok) return

      // Step 2: Auto-propose a goal target based on real data
      const targetRes = await fetch('/api/profile/goal-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!targetRes.ok) return

      // Refresh the page — forecast should now render
      router.refresh()
    } catch {
      // Fall back to settings page
      router.push('/settings')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {QUICK_PICKS.map((pick) => (
        <button
          key={pick.goal}
          onClick={() => handlePick(pick.goal)}
          disabled={loading !== null}
          className={`rounded-card border border-mist bg-frost/50 px-4 py-3 text-left text-sm transition-colors hover:border-pine hover:bg-frost ${
            loading === pick.goal ? 'opacity-60' : ''
          }`}
        >
          <p className="font-medium text-fjord">{pick.label}</p>
          <p className="text-xs text-stone">
            {loading === pick.goal ? 'Setting up your forecast...' : pick.sub}
          </p>
        </button>
      ))}
    </div>
  )
}
