'use client'

import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/app/actions/auth'

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
          <p className="rounded-lg bg-ember/10 p-3 text-sm text-red-700" role="alert">
            {state?.error || demoError}
          </p>
        )}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-fjord">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-fjord">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="input"
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={isPending}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-mist" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-frost px-2 text-stone">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDemo}
        disabled={demoLoading}
        className="w-full rounded-button border border-fjord/30 bg-transparent px-4 py-2.5 text-sm font-medium text-fjord hover:bg-fjord/5 disabled:opacity-50"
      >
        {demoLoading ? 'Loading demo…' : 'Explore with demo data'}
      </button>

      <p className="text-center text-sm text-stone">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-fjord hover:text-midnight">
          Create one
        </Link>
      </p>
    </div>
  )
}
