import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/JsonLd'

export const metadata: Metadata = {
  title: 'Oversikt vs Monarch Money — Budgeting App Comparison',
  description:
    'Compare Oversikt and Monarch Money. See how goal-driven budgeting, property tracking, and True Remaining stack up against Monarch\'s tracking and planning approach.',
  alternates: {
    canonical: 'https://oversikt.io/compare/monarch',
  },
}

const COMPARISON_ROWS = [
  {
    feature: 'Approach',
    oversikt: 'Goal-driven — every screen reflects your goal',
    monarch: 'Track and plan — categorize spending, set basic goals',
  },
  {
    feature: 'True Remaining',
    oversikt: 'Yes — spendable money after all obligations',
    monarch: 'Shows "left to spend" but no tiered budget deduction',
  },
  {
    feature: 'Property tracking',
    oversikt: 'Full — values, loans, appreciation, rental income',
    monarch: 'Basic account tracking',
  },
  {
    feature: 'Budget tiers',
    oversikt: 'Three tiers — fixed, flexible, annual',
    monarch: 'Single tier categories',
  },
  {
    feature: 'Credit card benefits',
    oversikt: 'Optimization engine with card-specific alerts',
    monarch: 'Not available',
  },
  {
    feature: 'AI insights',
    oversikt: 'Personalized, goal-aware financial feedback',
    monarch: 'Rule-based notifications',
  },
  {
    feature: 'Entity system',
    oversikt: 'Business entities, property groups, split rules',
    monarch: 'Not available',
  },
  {
    feature: 'Platform',
    oversikt: 'Web + PWA (any device)',
    monarch: 'Web + iOS + Android',
  },
  {
    feature: 'Pricing',
    oversikt: 'Free (early access)',
    monarch: '$9.99/month or $99.99/year',
  },
]

export default function CompareMonarchPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'Oversikt vs Monarch Money: Which Budgeting App Fits Your Finances?',
          description:
            'Compare Oversikt and Monarch Money. Goal-driven budgeting, property tracking, and True Remaining vs Monarch\'s tracking and planning approach.',
          author: { '@type': 'Person', name: 'Gavin Arnold' },
          publisher: { '@type': 'Organization', name: 'Oversikt' },
          datePublished: '2026-03-24',
          url: 'https://oversikt.io/compare/monarch',
        }}
      />

      <h1 className="font-display text-3xl tracking-tight text-fjord md:text-4xl">
        Oversikt vs Monarch Money: Which Budgeting App Fits Your Finances?
      </h1>

      <p className="mt-6 leading-relaxed text-stone">
        Monarch Money is a well-designed budgeting app with clean transaction tracking,
        collaborative household features, and a polished mobile experience. It&apos;s a strong
        choice for many users. The difference comes down to depth — how much complexity your
        financial life actually involves.
      </p>

      {/* Philosophy comparison */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-card border border-mist bg-frost p-6">
          <h2 className="font-display text-lg text-fjord">Monarch&apos;s Approach</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Track and plan. Categorize your spending, set category-level budgets, and monitor
            progress toward savings goals. Clean, visual, and straightforward.
          </p>
        </div>
        <div className="rounded-card border border-pine/30 bg-pine/5 p-6">
          <h2 className="font-display text-lg text-fjord">Oversikt&apos;s Approach</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Goal-driven clarity. Pick your financial goal, and every screen — dashboard,
            budgets, forecast, monthly review — reflects your progress toward it. Built for
            the complexity that comes with real-world financial lives.
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
              <th className="py-3 text-left font-semibold text-stone">Monarch</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.feature} className="border-b border-mist/50">
                <td className="py-3 pr-4 font-medium text-fjord">{row.feature}</td>
                <td className="py-3 pr-4 text-stone">{row.oversikt}</td>
                <td className="py-3 text-stone">{row.monarch}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Who should use which */}
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="font-display text-xl text-fjord">Use Monarch if&hellip;</h2>
          <ul className="mt-3 space-y-2 text-sm text-stone">
            <li className="flex gap-2"><span className="text-stone">•</span>You want a mature mobile app (iOS + Android)</li>
            <li className="flex gap-2"><span className="text-stone">•</span>You have moderate financial complexity</li>
            <li className="flex gap-2"><span className="text-stone">•</span>You like clean visual design with basic goal tracking</li>
            <li className="flex gap-2"><span className="text-stone">•</span>You want collaborative household features now</li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-xl text-fjord">Use Oversikt if&hellip;</h2>
          <ul className="mt-3 space-y-2 text-sm text-stone">
            <li className="flex gap-2"><span className="text-pine">•</span>You have complex finances with property or business entities</li>
            <li className="flex gap-2"><span className="text-pine">•</span>You want goal-driven budgeting as the center of gravity</li>
            <li className="flex gap-2"><span className="text-pine">•</span>You want True Remaining over basic left-to-spend</li>
            <li className="flex gap-2"><span className="text-pine">•</span>You want credit card optimization and AI insights</li>
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
