'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trackLogin, trackCtaClicked } from '@/lib/analytics'

export function DemoButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDemo() {
    setLoading(true)
    trackCtaClicked('Try the demo', 'hero')
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' })
      if (res.ok) {
        trackLogin('demo')
        router.push('/dashboard')
        return
      }
      // If demo login fails, fall back to login page
      router.push('/login')
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDemo}
      disabled={loading}
      className="rounded-button border border-white/20 bg-transparent px-8 py-3 text-center text-sm font-medium text-snow hover:bg-frost/10 disabled:opacity-50"
    >
      {loading ? 'Loading demo…' : 'Try the demo'}
    </button>
  )
}
