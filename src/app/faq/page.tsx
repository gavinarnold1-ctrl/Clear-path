import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/JsonLd'

export const metadata: Metadata = {
  title: 'FAQ — Oversikt',
  description:
    'Frequently asked questions about Oversikt, the free budgeting app for households with real financial complexity. Learn about True Remaining, bank connections, pricing, and more.',
  alternates: {
    canonical: 'https://oversikt.io/faq',
  },
}

const FAQ_ITEMS = [
  {
    question: 'What is Oversikt?',
    answer:
      'Oversikt is a personal budgeting app built for households with real financial complexity — dual incomes, mortgages, rental property, multiple accounts, and irregular expenses. The name is Norwegian for "a clear, comprehensive view of the whole." Instead of prescriptive rules about how to spend, Oversikt shows you what\'s true about your money and what it means, then lets you decide.',
  },
  {
    question: 'How is Oversikt different from YNAB?',
    answer:
      'YNAB follows the envelope method — every dollar must be assigned a job before you spend it. That works well for some people, but it can feel rigid if you have complex finances with multiple income sources, rental property, or irregular annual expenses. Oversikt takes a different approach: it calculates your True Remaining — the actual amount you can spend after fixed bills, flexible budgets, and annual set-asides are accounted for. You set a financial goal, and every screen in the app reflects your progress toward it. No envelopes, no guilt — just clarity.',
  },
  {
    question: 'What is True Remaining?',
    answer:
      'True Remaining is the number that actually matters for day-to-day spending decisions. Most budget apps tell you what you\'ve spent. True Remaining tells you what you can safely spend right now — after your fixed bills, flexible budget allocations, and annual expense set-asides are all accounted for. It updates in real time as transactions sync. Think of it as the honest answer to "can I afford this?"',
  },
  {
    question: 'Is Oversikt free?',
    answer:
      'Yes. Oversikt is free during early access with no feature limits and no credit card required. Paid tiers will be introduced later in 2026, and early users will be offered a founding member rate — a locked-in discount for life.',
  },
  {
    question: 'How does bank connectivity work?',
    answer:
      'Oversikt connects to your bank accounts through Plaid, the same infrastructure used by Venmo, Robinhood, and thousands of other financial apps. Your bank credentials go directly to Plaid — Oversikt never sees or stores your banking passwords. Transactions sync daily. You can also import transactions manually via CSV if you prefer not to connect your accounts.',
  },
  {
    question: 'Is my financial data secure?',
    answer:
      'Yes. Bank connections are encrypted end-to-end through Plaid. Your data is stored in a secure PostgreSQL database with row-level access controls — you can only see your own data. Oversikt is built by a solo developer with no venture capital, no ads, and no data selling. Your financial data stays yours. Read our full security practices at oversikt.io/security.',
  },
  {
    question: 'What kinds of accounts does Oversikt support?',
    answer:
      'Oversikt supports checking accounts, savings accounts, credit cards, mortgages, auto loans, student loans, and investment accounts through Plaid. It also has dedicated tracking for rental properties, property groups with expense splits, and a debt management system with amortization schedules. If you have a financial life more complex than a single checking account, Oversikt was built for you.',
  },
  {
    question: 'Who is Oversikt built for?',
    answer:
      'Oversikt is designed for professionals and households earning $110K–$200K who have genuine financial complexity. That means multiple bank accounts, a mortgage, possibly rental property or side income, credit cards with benefits to optimize, and irregular annual expenses like insurance or property taxes. If you\'ve tried YNAB, Mint, or a spreadsheet and found them too rigid, too shallow, or too much work, Oversikt is the alternative.',
  },
  {
    question: 'Does Oversikt work on mobile?',
    answer:
      'Yes. Oversikt is a progressive web app (PWA) that works on any device with a browser. On mobile, you can add it to your home screen for an app-like experience — no App Store download needed. The interface is designed mobile-first with touch-friendly controls.',
  },
  {
    question: 'What is goal-driven budgeting?',
    answer:
      'When you sign up for Oversikt, the first thing you do is pick a financial goal: save more, spend smarter, pay off debt, gain visibility, or build wealth. That goal becomes the center of gravity for your entire experience. Your dashboard shows progress toward your goal. Your forecast projects when you\'ll reach it. Your monthly review evaluates how you did relative to your goal. Every feature connects back to your "why" — the reason you\'re budgeting in the first place. No other budgeting app does this.',
  },
  {
    question: 'Can Oversikt track rental property income and expenses?',
    answer:
      'Yes. Oversikt has a dedicated property and entity tracking system. You can add properties with current values, loan balances, appreciation rates, and monthly rental income. Property groups let you split shared expenses (like a duplex where you live in one unit and rent the other). Transactions can be tagged to specific properties for accurate profit/loss tracking.',
  },
  {
    question: 'How does Oversikt compare to Monarch Money?',
    answer:
      'Monarch Money is a solid budgeting app with good transaction tracking and a clean interface. Oversikt goes further for users with complex finances: it includes rental property tracking, a credit card benefits optimization engine, three-tier budgets (fixed, flexible, and annual), goal-driven budgeting where every screen reflects your financial goal, and an AI insights engine that gives personalized feedback. Monarch is $9.99/month; Oversikt is free during early access.',
  },
]

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQ_ITEMS.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        }}
      />

      <h1 className="font-display text-3xl tracking-tight text-fjord md:text-4xl">
        Frequently Asked Questions
      </h1>
      <p className="mt-3 text-stone">
        Everything you need to know about Oversikt
      </p>

      <div className="mt-10">
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={i}
            className={`py-6 ${i < FAQ_ITEMS.length - 1 ? 'border-b border-mist' : ''}`}
          >
            <h2 className="text-lg font-semibold text-fjord">{item.question}</h2>
            <p className="mt-2 leading-relaxed text-stone">{item.answer}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-card border border-mist bg-frost p-8 text-center">
        <h2 className="font-display text-2xl tracking-tight text-fjord">
          Ready to see your True Remaining?
        </h2>
        <p className="mt-2 text-stone">
          Free during early access. No credit card required.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex items-center justify-center rounded-button bg-pine px-8 py-3 text-base font-medium text-snow shadow-sm transition-colors hover:bg-pine/90"
        >
          Sign up free
        </Link>
      </div>
    </main>
  )
}
