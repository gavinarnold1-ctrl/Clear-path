import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/JsonLd'

export const metadata: Metadata = {
  title: 'Oversikt vs YNAB — Budgeting App Comparison',
  description:
    'Compare Oversikt and YNAB side by side. True Remaining vs envelope method, goal-driven budgets vs every-dollar-has-a-job, and which works better for complex household finances.',
  alternates: {
    canonical: 'https://oversikt.io/compare/ynab',
  },
}

const COMPARISON_ROWS = [
  {
    feature: 'Approach',
    oversikt: 'True Remaining — show, don\'t prescribe',
    ynab: 'Envelope method — assign every dollar',
  },
  {
    feature: 'Goal system',
    oversikt: 'Center of gravity — every screen reflects your goal',
    ynab: 'Goals exist but aren\'t central to the experience',
  },
  {
    feature: 'Property tracking',
    oversikt: 'Full — values, loans, appreciation, rental income, splits',
    ynab: 'Not available',
  },
  {
    feature: 'Budget tiers',
    oversikt: 'Three — fixed, flexible, annual (sinking funds)',
    ynab: 'Single tier — all categories treated the same',
  },
  {
    feature: 'Credit card benefits',
    oversikt: 'Optimization engine that alerts you to use the best card',
    ynab: 'Basic credit card tracking',
  },
  {
    feature: 'AI insights',
    oversikt: 'Personalized financial feedback with actionable suggestions',
    ynab: 'Not available',
  },
  {
    feature: 'Bank connections',
    oversikt: 'Plaid (daily sync) + CSV import',
    ynab: 'Direct connections + file import',
  },
  {
    feature: 'Platform',
    oversikt: 'Web + PWA (any device)',
    ynab: 'Web + iOS + Android',
  },
  {
    feature: 'Pricing',
    oversikt: 'Free (early access)',
    ynab: '$14.99/month or $109/year',
  },
]

export default function CompareYnabPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'Oversikt vs YNAB: Two Different Budgeting Philosophies',
          description:
            'Compare Oversikt and YNAB side by side. True Remaining vs envelope method, goal-driven budgets vs every-dollar-has-a-job.',
          author: { '@type': 'Person', name: 'Gavin Arnold' },
          publisher: { '@type': 'Organization', name: 'Oversikt' },
          datePublished: '2026-03-24',
          url: 'https://oversikt.io/compare/ynab',
        }}
      />

      <h1 className="font-display text-3xl tracking-tight text-fjord md:text-4xl">
        Oversikt vs YNAB: Two Different Budgeting Philosophies
      </h1>

      <p className="mt-6 leading-relaxed text-stone">
        YNAB (You Need A Budget) is an excellent budgeting tool with a proven method and a large,
        passionate community. It&apos;s helped millions of people take control of their money. The
        question isn&apos;t whether YNAB is good — it&apos;s whether its approach fits how you
        manage money.
      </p>

      {/* Philosophy comparison */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-card border border-mist bg-frost p-6">
          <h2 className="font-display text-lg text-fjord">YNAB&apos;s Philosophy</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Every dollar gets a job. You assign money to categories before spending it. The
            system depends on proactive allocation — you decide where every dollar goes before
            it arrives.
          </p>
        </div>
        <div className="rounded-card border border-pine/30 bg-pine/5 p-6">
          <h2 className="font-display text-lg text-fjord">Oversikt&apos;s Philosophy</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            See what&apos;s true, then decide. Your True Remaining updates automatically as bills,
            budgets, and annual expenses are accounted for. The system adapts to your existing
            spending patterns.
          </p>
        </div>
      </div>

      {/* Feature comparison table */}
      <h2 className="mt-12 font-display text-2xl tracking-tight text-fjord">
        Feature Comparison
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-mist">
              <th className="py-3 pr-4 text-left font-semibold text-fjord">Feature</th>
              <th className="py-3 pr-4 text-left font-semibold text-pine">Oversikt</th>
              <th className="py-3 text-left font-semibold text-stone">YNAB</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.feature} className="border-b border-mist/50">
                <td className="py-3 pr-4 font-medium text-fjord">{row.feature}</td>
                <td className="py-3 pr-4 text-stone">{row.oversikt}</td>
                <td className="py-3 text-stone">{row.ynab}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Who should use which */}
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="font-display text-xl text-fjord">Use YNAB if&hellip;</h2>
          <ul className="mt-3 space-y-2 text-sm text-stone">
            <li className="flex gap-2"><span className="text-stone">•</span>You like the envelope method and proactive allocation</li>
            <li className="flex gap-2"><span className="text-stone">•</span>You want a mature mobile app (iOS + Android)</li>
            <li className="flex gap-2"><span className="text-stone">•</span>You have simple finances — checking, savings, a credit card</li>
            <li className="flex gap-2"><span className="text-stone">•</span>You thrive on assigning every dollar a job</li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-xl text-fjord">Use Oversikt if&hellip;</h2>
          <ul className="mt-3 space-y-2 text-sm text-stone">
            <li className="flex gap-2"><span className="text-pine">•</span>You have complex finances — mortgage, rental property, multiple accounts</li>
            <li className="flex gap-2"><span className="text-pine">•</span>You want goal-driven budgeting without rigid rules</li>
            <li className="flex gap-2"><span className="text-pine">•</span>You prefer seeing what&apos;s true over assigning every dollar</li>
            <li className="flex gap-2"><span className="text-pine">•</span>You want property tracking and credit card optimization</li>
          </ul>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-card border border-mist bg-frost p-8 text-center">
        <h2 className="font-display text-2xl tracking-tight text-fjord">
          Try Oversikt free — no credit card required
        </h2>
        <p className="mt-2 text-stone">
          See your True Remaining in minutes.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex items-center justify-center rounded-button bg-pine px-8 py-3 text-base font-medium text-snow shadow-sm transition-colors hover:bg-pine/90"
        >
          Start budgeting — free
        </Link>
      </div>
    </main>
  )
}
