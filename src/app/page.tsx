import Link from 'next/link'
import { WaitlistForm } from './WaitlistForm'
import { DemoButton } from './DemoButton'

export default function HomePage() {
  return (
    <main>
      {/* ── Section 1: Hero ────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center bg-gradient-to-br from-fjord to-midnight px-6 py-20 text-center">
        {/* Brand lockup */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-frost/15 font-display text-2xl text-snow">
            O
          </span>
          <span className="font-display text-4xl tracking-tight text-snow">oversikt</span>
        </div>

        <h1 className="mx-auto max-w-2xl font-display text-4xl leading-tight tracking-tight text-snow sm:text-5xl md:text-6xl">
          Your money. Your goals.
          <br />
          One clear view.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-lichen/90">
          Oversikt connects your accounts, tracks your real spending, and shows you
          exactly what&apos;s left after every commitment. No guessing. No spreadsheets.
          Just clarity.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-button bg-snow px-8 py-3 text-center text-sm font-medium text-fjord hover:bg-frost"
          >
            Get started free
          </Link>
          <DemoButton />
        </div>

        <p className="mt-6 text-xs text-snow/40">No credit card required.</p>

        {/* Definition — bottom of hero */}
        <div className="mt-auto pt-16 text-center">
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
        </div>
      </section>

      {/* ── Section 2: Problem Statement ───────────────────────────────────── */}
      <section className="bg-frost px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center font-display text-3xl tracking-tight text-fjord sm:text-4xl">
            The $200K household problem
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-stone">
            You earn well. You&apos;re not irresponsible. But your finances are genuinely complex
            — and no tool was built for that.
          </p>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="card">
              <div className="mb-3 text-3xl">&#x1F3E6;</div>
              <h3 className="mb-2 font-display text-lg text-fjord">Multiple accounts, no single view</h3>
              <p className="text-sm leading-relaxed text-stone">
                Checking, savings, credit cards, mortgage, student loans — and no single view
                of what&apos;s actually available to spend.
              </p>
            </div>
            <div className="card">
              <div className="mb-3 text-3xl">&#x1F4B3;</div>
              <h3 className="mb-2 font-display text-lg text-fjord">Premium cards gathering dust</h3>
              <p className="text-sm leading-relaxed text-stone">
                You pay $1,500+/yr in annual fees but forfeit 30–60% of the benefits
                you&apos;re paying for. Nobody tracks that.
              </p>
            </div>
            <div className="card">
              <div className="mb-3 text-3xl">&#x1F4C9;</div>
              <h3 className="mb-2 font-display text-lg text-fjord">Monthly surprises</h3>
              <p className="text-sm leading-relaxed text-stone">
                &ldquo;Where did my money go?&rdquo; isn&apos;t a question anyone earning six figures
                should still be asking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: How It Works ────────────────────────────────────────── */}
      <section className="bg-snow px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center font-display text-3xl tracking-tight text-fjord sm:text-4xl">
            Three steps to clarity
          </h2>

          <div className="grid gap-10 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pine/10">
                <svg className="h-7 w-7 text-pine" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.131l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-lg text-fjord">Connect your banks</h3>
              <p className="text-sm leading-relaxed text-stone">
                Plaid securely links your accounts in seconds. Checking, savings, credit cards, loans — all in one place.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pine/10">
                <svg className="h-7 w-7 text-pine" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-lg text-fjord">Set your goal</h3>
              <p className="text-sm leading-relaxed text-stone">
                Save more, pay off debt, spend smarter — you choose. We&apos;ll build a budget oriented toward what matters to you.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pine/10">
                <svg className="h-7 w-7 text-pine" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-lg text-fjord">See what&apos;s true</h3>
              <p className="text-sm leading-relaxed text-stone">
                True Remaining shows your real spending power — after every fixed bill, flexible budget, and annual set-aside.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Key Features ────────────────────────────────────────── */}
      <section className="bg-frost px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center font-display text-3xl tracking-tight text-fjord sm:text-4xl">
            Built for how money actually works
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-stone">
            Not another envelope app. Oversikt handles the complexity that real households deal with.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">True Remaining</h3>
              <p className="text-sm leading-relaxed text-stone">
                Not your balance. Not your budget. The actual money you can spend after every
                fixed bill, flexible budget, and annual set-aside.
              </p>
            </div>

            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">Goal-Driven Budgets</h3>
              <p className="text-sm leading-relaxed text-stone">
                Tell us what you&apos;re working toward. We&apos;ll build a budget that gets
                you there — and show you if you&apos;re on pace.
              </p>
            </div>

            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">Credit Card Benefits Tracker</h3>
              <p className="text-sm leading-relaxed text-stone">
                Stop leaving money on the table. Track every statement credit, travel perk,
                and subscription reimbursement across all your cards.
              </p>
            </div>

            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">Three-Tier Budgets</h3>
              <p className="text-sm leading-relaxed text-stone">
                Fixed bills, flexible spending, and annual expenses — each tracked the way
                they actually work, not crammed into one view.
              </p>
            </div>

            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">AI Financial Insights</h3>
              <p className="text-sm leading-relaxed text-stone">
                Personalized observations about your spending, oriented toward your specific
                goal. Not generic tips — real analysis of your money.
              </p>
            </div>

            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">Property &amp; Entity Tracking</h3>
              <p className="text-sm leading-relaxed text-stone">
                Rental properties, business expenses, split allocations — all connected
                to your budget and tax picture.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Competitive Positioning ─────────────────────────────── */}
      <section className="bg-snow px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 font-display text-3xl tracking-tight text-fjord sm:text-4xl">
            Built for financial complexity
          </h2>
          <p className="text-lg leading-relaxed text-stone">
            YNAB tells you what to do. Mint is gone. Copilot only works on Apple.
            Monarch doesn&apos;t track your card benefits.
          </p>
          <p className="mt-6 text-lg font-medium leading-relaxed text-fjord">
            Oversikt shows what&apos;s true and what it means.
            <br />
            You decide what to do about it.
          </p>
        </div>
      </section>

      {/* ── Section 6: Waitlist ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-fjord to-midnight px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="mb-4 font-display text-3xl tracking-tight text-snow sm:text-4xl">
            Join the waitlist
          </h2>
          <p className="mb-8 text-lichen/80">
            Be first to know when Oversikt opens to new users.
          </p>

          <WaitlistForm />

          <p className="mt-4 text-xs text-snow/40">
            We&apos;ll never spam you. Just one email when it&apos;s your turn.
          </p>
        </div>
      </section>

      {/* ── Section 7: Footer ──────────────────────────────────────────────── */}
      <footer className="bg-midnight px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
          <span className="font-display text-xl tracking-tight text-snow/70">oversikt</span>

          <div className="flex items-center gap-3 text-xs">
            <Link href="/security" className="text-snow/40 hover:text-snow/70">
              Security
            </Link>
            <span className="text-snow/20">&middot;</span>
            <Link href="/privacy" className="text-snow/40 hover:text-snow/70">
              Privacy
            </Link>
            <span className="text-snow/20">&middot;</span>
            <Link href="/terms" className="text-snow/40 hover:text-snow/70">
              Terms
            </Link>
          </div>

          <p className="text-xs text-snow/30">
            &copy; 2026 Oversikt LLC
          </p>
        </div>
      </footer>
    </main>
  )
}
