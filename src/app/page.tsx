import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/JsonLd'
import { DemoButton } from './DemoButton'

export const metadata: Metadata = {
  title: 'Oversikt — Budgeting for Households with Real Financial Complexity',
  description:
    'Free budgeting app with True Remaining, goal-driven budgets, property tracking, and AI insights. Built for dual-income households earning $110K–$200K who have outgrown YNAB and Mint.',
  keywords: [
    'budgeting app',
    'personal finance',
    'budget tracker',
    'YNAB alternative',
    'household budget',
    'rental property budget',
    'True Remaining',
    'goal-driven budgeting',
    'dual income budget',
  ],
  openGraph: {
    title: 'Oversikt — Budgeting for Real Financial Complexity',
    description:
      'See what\'s true about your money. Free budgeting with True Remaining, property tracking, and AI insights.',
    url: 'https://oversikt.io',
    siteName: 'Oversikt',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Oversikt — Budgeting for Real Financial Complexity',
    description:
      'Free budgeting app with True Remaining, goal-driven budgets, and property tracking. Built for households that have outgrown YNAB.',
  },
  alternates: {
    canonical: 'https://oversikt.io',
  },
}

export default function HomePage() {
  return (
    <main>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Oversikt',
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Web',
          url: 'https://oversikt.io',
          description:
            'Personal budgeting app for households with real financial complexity. Features True Remaining calculation, goal-driven budgets, property tracking, credit card benefits engine, and AI financial insights.',
          featureList: [
            'True Remaining calculation',
            'Goal-driven budgeting',
            'Property and rental income tracking',
            'Credit card benefits optimization',
            'AI financial insights',
            'Bank sync via Plaid',
            'Three-tier budget system',
            'Monthly financial review',
          ],
          author: {
            '@type': 'Person',
            name: 'Gavin Arnold',
          },
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            description: 'Free during early access. No credit card required.',
          },
        }}
      />

      {/* ── Section 1: Hero ──────────────────────────────────────────────── */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center bg-gradient-to-br from-fjord to-midnight px-6 py-20 text-center">
        {/* Brand lockup */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-frost/15 font-display text-2xl text-snow">
            O
          </span>
          <span className="font-display text-4xl tracking-tight text-snow">oversikt</span>
        </div>

        <h1 className="mx-auto max-w-2xl font-display text-4xl leading-tight tracking-tight text-snow sm:text-5xl md:text-6xl">
          Your money has a purpose.
          <br />
          Oversikt helps you see it.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-lichen/90">
          Start with your goal &mdash; saving, paying off debt, optimizing spending &mdash;
          and Oversikt builds a budget that gets you there. Then it tracks your
          progress, shows what&apos;s working, and tells you what&apos;s left to spend.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-button bg-pine px-8 py-3 text-base font-medium text-snow shadow-sm transition-colors hover:bg-pine/90"
          >
            Start budgeting — free
          </Link>
          <DemoButton />
        </div>
        <p className="mt-4 text-xs text-snow/50">No credit card required</p>

        {/* Norwegian etymology */}
        <div className="mt-auto pt-16 text-center">
          <p className="font-display text-2xl tracking-tight text-snow/70">
            oversikt{' '}
            <span className="font-mono text-xs font-normal text-snow/40">/&#x2C8;o&#x2D0;.v&#x259;r.s&#x26A;kt/</span>
          </p>
          <p className="mt-0.5 text-xs text-snow/40">noun &mdash; Norwegian</p>
          <p className="mt-2 text-sm leading-snug text-snow/50">
            A clear, comprehensive view of the whole;
            <br />
            the vantage point from which the full picture becomes visible.
          </p>
        </div>
      </section>

      {/* ── Section 2: The Five Goals ────────────────────────────────────── */}
      <section className="bg-frost px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center font-display text-3xl tracking-tight text-fjord sm:text-4xl">
            Start with why you&apos;re budgeting
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-stone">
            Every budget should serve a purpose. Pick yours, and Oversikt
            orients everything &mdash; your dashboard, your budgets, your insights &mdash;
            toward making it happen.
          </p>

          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {GOALS.map((goal) => (
              <div key={goal.name} className="card flex flex-col">
                <div className="mb-3 text-2xl">{goal.icon}</div>
                <h3 className="mb-2 font-display text-lg text-fjord">{goal.name}</h3>
                <p className="mb-3 text-sm leading-relaxed text-stone">{goal.description}</p>
                <p className="mt-auto font-mono text-xs text-pine">{goal.example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: How It Works ──────────────────────────────────────── */}
      <section className="bg-snow px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center font-display text-3xl tracking-tight text-fjord sm:text-4xl">
            Three steps to clarity
          </h2>

          <div className="grid gap-10 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pine/10">
                <svg className="h-7 w-7 text-pine" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-lg text-fjord">Pick your goal</h3>
              <p className="text-sm leading-relaxed text-stone">
                Save more, pay off debt, spend smarter &mdash; you choose the destination.
                Oversikt builds a budget oriented toward getting you there.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pine/10">
                <svg className="h-7 w-7 text-pine" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.131l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-lg text-fjord">Connect your accounts</h3>
              <p className="text-sm leading-relaxed text-stone">
                Plaid securely links your banks, credit cards, and loans in seconds.
                Everything in one place &mdash; no spreadsheets, no manual entry.
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
                True Remaining shows your real spending power &mdash; after every fixed bill,
                flexible budget, and annual set-aside. Not your balance. Not your budget.
                What you can actually spend and still hit your goal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Key Features ──────────────────────────────────────── */}
      <section className="bg-frost px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center font-display text-3xl tracking-tight text-fjord sm:text-4xl">
            Built for how money actually works
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-stone">
            Not another envelope app. Oversikt handles the complexity
            that real financial lives involve.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">True Remaining</h3>
              <p className="text-sm leading-relaxed text-stone">
                The money you can spend after every bill, budget, and set-aside &mdash;
                contextualized for your goal. Not a balance. Not a guess.
              </p>
            </div>

            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">Goal-Driven Budgets</h3>
              <p className="text-sm leading-relaxed text-stone">
                Your goal determines your budget, not the other way around. Change a budget
                and see the impact: &ldquo;Cutting dining by $100 gets you to your target
                one month sooner.&rdquo;
              </p>
            </div>

            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">Credit Card Benefits Tracker</h3>
              <p className="text-sm leading-relaxed text-stone">
                Stop leaving money on the table. Track statement credits, travel perks,
                and subscription reimbursements across all your cards.
              </p>
            </div>

            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">Three-Tier Budgets</h3>
              <p className="text-sm leading-relaxed text-stone">
                Fixed bills, flexible spending, and annual expenses &mdash; each tracked the way
                they actually work, not crammed into one view.
              </p>
            </div>

            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">AI Financial Insights</h3>
              <p className="text-sm leading-relaxed text-stone">
                Personalized observations oriented toward your specific goal. Not generic
                tips &mdash; real analysis of your money and what it means for your progress.
              </p>
            </div>

            <div className="card">
              <h3 className="mb-2 font-display text-lg text-fjord">Property &amp; Entity Tracking</h3>
              <p className="text-sm leading-relaxed text-stone">
                Rental properties, business expenses, split allocations &mdash; all connected
                to your budget and tax picture.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Competitive Positioning ───────────────────────────── */}
      <section className="bg-snow px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 font-display text-3xl tracking-tight text-fjord sm:text-4xl">
            A different kind of budgeting app
          </h2>
          <p className="text-lg leading-relaxed text-stone">
            Most budgeting apps are built around categories and rules.
            Oversikt is built around your goal. You tell us what you&apos;re
            working toward, and we show you whether your money is getting
            you there. That&apos;s it. No prescriptive systems. No judgment.
            Just clarity &mdash; and the freedom to decide what to do with it.
          </p>
          <p className="mx-auto mt-6 max-w-lg text-sm text-stone/70">
            Works on any device. Connects via Plaid. Tracks what others don&apos;t &mdash;
            credit card benefits, property equity, annual expenses.
          </p>
        </div>
      </section>

      {/* ── Section 6: Final CTA ─────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-fjord to-midnight px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="mb-4 font-display text-3xl tracking-tight text-snow sm:text-4xl">
            Ready to budget with purpose?
          </h2>
          <p className="mb-8 text-lichen/80">
            Ready to see what&apos;s true? Join the early access community.
          </p>

          <div className="mb-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-button bg-pine px-8 py-3 text-base font-medium text-snow shadow-sm transition-colors hover:bg-pine/90"
            >
              Start budgeting — free
            </Link>
            <DemoButton />
          </div>
          <p className="text-xs text-snow/50">Free during early access</p>
        </div>
      </section>

      {/* ── Section 7: Footer ────────────────────────────────────────────── */}
      <footer className="bg-midnight px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
          <span className="font-display text-xl tracking-tight text-snow/70">oversikt</span>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <Link href="/faq" className="text-snow/40 hover:text-snow/70">
              FAQ
            </Link>
            <span className="text-snow/20">&middot;</span>
            <Link href="/compare/ynab" className="text-snow/40 hover:text-snow/70">
              vs YNAB
            </Link>
            <span className="text-snow/20">&middot;</span>
            <Link href="/compare/monarch" className="text-snow/40 hover:text-snow/70">
              vs Monarch
            </Link>
            <span className="text-snow/20">&middot;</span>
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

const GOALS = [
  {
    icon: '\u{1F4B0}',
    name: 'Save More',
    description:
      'Build an emergency fund, save for a house, or just stop living paycheck to paycheck.',
    example: '"Save $20,000 by December"',
  },
  {
    icon: '\u{1F4C9}',
    name: 'Pay Off Debt',
    description:
      'See your payoff timeline, find extra cash in your budget, and watch balances drop.',
    example: '"Pay off Chase Visa by March"',
  },
  {
    icon: '\u{1F6D2}',
    name: 'Spend Smarter',
    description:
      'Find where you\u2019re overspending compared to people like you, and redirect the difference.',
    example: '"Get dining under $600/month"',
  },
  {
    icon: '\u{1F50D}',
    name: 'Gain Visibility',
    description:
      'Finally understand where your money goes. No judgments \u2014 just clarity.',
    example: '"Categorize 95% of transactions"',
  },
  {
    icon: '\u{1F4C8}',
    name: 'Build Wealth',
    description:
      'Track net worth across accounts, properties, and investments. See the full picture.',
    example: '"Grow net worth by $30K this year"',
  },
]
