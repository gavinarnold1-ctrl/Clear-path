import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex h-dvh min-h-screen flex-col items-center bg-gradient-to-br from-fjord to-midnight px-8 py-10">
      {/* Centered content */}
      <div className="flex flex-1 flex-col items-center justify-center">
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

          <div className="mt-4 flex items-center justify-center gap-3 text-xs">
            <Link href="/security" className="text-snow/30 hover:text-snow/60">
              Security
            </Link>
            <span className="text-snow/20">&middot;</span>
            <Link href="/privacy" className="text-snow/30 hover:text-snow/60">
              Privacy
            </Link>
            <span className="text-snow/20">&middot;</span>
            <Link href="/terms" className="text-snow/30 hover:text-snow/60">
              Terms
            </Link>
          </div>
        </div>
      </div>

      {/* Definition — anchored to bottom */}
      <div className="w-full max-w-[400px] text-center">
        <p className="font-display text-2xl tracking-tight text-snow/70">
          oversikt{' '}
          <span className="font-mono text-xs font-normal text-snow/40">/ˈoː.vər.sɪkt/</span>
        </p>
        <p className="mt-0.5 text-xs text-snow/40">noun — Norwegian</p>
        <p className="mt-2 text-sm leading-snug text-snow/50">
          A clear, comprehensive view of the whole;
          <br />
          the vantage point from which the full picture becomes visible.
        </p>
        <p className="mt-1.5 text-[13px] italic text-snow/35">
          &ldquo;å ha oversikt&rdquo; — to see the full picture.
        </p>
      </div>
    </main>
  )
}
