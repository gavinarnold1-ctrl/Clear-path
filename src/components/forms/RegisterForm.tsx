'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { register } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { FormInput } from '@/components/ui/FormInput'

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

      <FormInput
        label="Name"
        name="name"
        type="text"
        autoComplete="name"
        placeholder="Your name"
      />

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
        autoComplete="new-password"
        placeholder="Min. 8 characters"
        required
      />

      <div className="flex items-start gap-2">
        <input
          id="tos"
          name="tos"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded-badge border-mist text-fjord accent-fjord focus:ring-fjord"
          required
        />
        <label htmlFor="tos" className="text-sm text-stone">
          I agree to the{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-fjord hover:text-midnight underline"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-fjord hover:text-midnight underline"
          >
            Privacy Policy
          </a>
        </label>
      </div>

      <Button type="submit" fullWidth disabled={isPending} loading={isPending} loadingText="Creating account…">
        Create account
      </Button>

      <p className="text-center text-sm text-stone">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-fjord hover:text-midnight">
          Sign in
        </Link>
      </p>
    </form>
  )
}
