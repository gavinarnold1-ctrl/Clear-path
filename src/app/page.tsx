import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-white p-8">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-2 text-5xl font-bold tracking-tight text-brand-700">Clear-path</h1>
        <p className="mb-10 text-lg text-gray-500">
          Simple, honest budgeting — see where your money goes and build the future you want.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/register" className="btn-primary text-center">
            Get started — it&apos;s free
          </Link>
          <Link href="/login" className="btn-secondary text-center">
            Sign in
          </Link>
        </div>

        <p className="mt-8 text-xs text-gray-400">No credit card required.</p>
      </div>
    </main>
  )
}
