import type { Metadata } from 'next'
import RegisterForm from '@/components/forms/RegisterForm'

export const metadata: Metadata = { title: 'Create account' }

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Create your account</h1>
        <RegisterForm />
      </div>
    </div>
  )
}
