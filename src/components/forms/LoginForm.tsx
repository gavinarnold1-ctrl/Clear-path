'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'

const initialState = { error: null }

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="rounded-lg bg-ember/10 p-3 text-sm text-red-700" role="alert">
          {state.error}
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

      <p className="text-center text-sm text-stone">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-fjord hover:text-midnight">
          Create one
        </Link>
      </p>
    </form>
  )
}
