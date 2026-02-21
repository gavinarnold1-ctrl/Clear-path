import type { Metadata } from 'next'
import LoginForm from '@/components/forms/LoginForm'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Sign in to Clear-path</h1>
        <LoginForm />
      </div>
    </div>
  )
}
