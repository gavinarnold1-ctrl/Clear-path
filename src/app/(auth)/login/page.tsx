import type { Metadata } from 'next'
import Link from 'next/link'
import LoginForm from '@/components/forms/LoginForm'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-snow px-4 py-8">
      <div className="card mx-auto w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fjord font-display text-base text-snow">
            O
          </span>
          <Link href="/" className="font-display text-lg text-fjord">
            oversikt
          </Link>
        </div>
        <h1 className="mb-6 font-display text-2xl font-medium text-fjord">Sign in</h1>
        <LoginForm />
      </div>
    </div>
  )
}
