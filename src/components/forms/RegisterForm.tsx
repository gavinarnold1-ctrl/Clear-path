'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { register } from '@/app/actions/auth'

const initialState = { error: null }

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember" role="alert">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-fjord">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          className="input"
          placeholder="Your name"
        />
      </div>

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
          autoComplete="new-password"
          className="input"
          placeholder="Min. 8 characters"
          required
        />
      </div>

      <div className="flex items-start gap-2">
        <input
          id="tos"
          name="tos"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-mist text-pine focus:ring-pine"
          required
        />
        <label htmlFor="tos" className="text-sm text-stone">
          I agree to the{' '}
          <Link href="/terms" target="_blank" className="font-medium text-fjord hover:text-midnight">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" target="_blank" className="font-medium text-fjord hover:text-midnight">
            Privacy Policy
          </Link>
        </label>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={isPending}>
        {isPending ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-center text-sm text-stone">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-fjord hover:text-midnight">
          Sign in
        </Link>
      </p>
    </form>
  )
}
