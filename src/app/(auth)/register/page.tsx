import type { Metadata } from 'next'
import Link from 'next/link'
import RegisterForm from '@/components/forms/RegisterForm'

export const metadata: Metadata = { title: 'Create account' }

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-snow px-4">
      <div className="card w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fjord font-display text-sm text-snow">
            O
          </span>
          <Link href="/" className="font-display text-base text-fjord">
            oversikt
          </Link>
        </div>
        <h1 className="mb-6 font-display text-2xl font-medium text-fjord">Create your account</h1>
        <RegisterForm />
      </div>
    </div>
  )
}
