'use client'

import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { FormInput } from '@/components/ui/FormInput'
import { trackLogin, trackDemoPhysicianLoaded } from '@/lib/analytics'

const initialState = { error: null }

export default function LoginForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(login, initialState)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)

  async function handleDemo() {
    setDemoLoading(true)
    setDemoError(null)
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Demo login failed')
      }
      trackLogin('demo')
      trackDemoPhysicianLoaded()
      router.push('/dashboard')
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : 'Demo login failed')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        {(state?.error || demoError) && (
          <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember" role="alert">
            {state?.error || demoError}
          </p>
        )}

        <FormInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />

        <FormInput
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        <Button type="submit" loading={isPending} loadingText="Signing in…" fullWidth>
          Sign in
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-mist" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-frost px-2 text-stone">or</span>
        </div>
      </div>

      <Button
        variant="outline"
        type="button"
        onClick={handleDemo}
        loading={demoLoading}
        loadingText="Loading demo…"
        fullWidth
      >
        Explore with demo data
      </Button>

      <p className="text-center text-sm text-stone">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-fjord hover:text-midnight">
          Create one
        </Link>
      </p>
    </div>
  )
}
