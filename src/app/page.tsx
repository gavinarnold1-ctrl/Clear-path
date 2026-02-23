import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-fjord to-midnight p-8">
      <div className="w-full max-w-md text-center">
        {/* Brand lockup */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-frost/15 font-display text-2xl text-snow">
            O
          </span>
          <span className="font-display text-4xl tracking-tight text-snow">oversikt</span>
        </div>

        <p className="mb-10 text-lg text-lichen">
          See your whole financial picture.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="rounded-button bg-snow px-6 py-3 text-center text-sm font-medium text-fjord hover:bg-frost"
          >
            Get started — it&apos;s free
          </Link>
          <Link
            href="/login"
            className="rounded-button border border-white/20 bg-transparent px-6 py-3 text-center text-sm font-medium text-snow hover:bg-frost/10"
          >
            Sign in
          </Link>
        </div>

        <p className="mt-8 text-xs text-snow/40">No credit card required.</p>
      </div>
    </main>
  )
}
