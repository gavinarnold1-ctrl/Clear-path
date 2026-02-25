import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security — oversikt',
  description: 'How Oversikt protects your financial data',
}

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-medium text-fjord">
        How oversikt protects your data
      </h1>
      <p className="mt-2 text-stone">
        Your financial data is sensitive. Here&apos;s how we keep it safe.
      </p>

      <div className="mt-10 space-y-10">
        {/* 1. Bank credentials */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            Your bank credentials
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Oversikt never sees your bank username or password. We use{' '}
            <a
              href="https://plaid.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pine underline"
            >
              Plaid
            </a>
            , a trusted financial data platform used by thousands of apps, to
            connect to your bank. Your credentials are entered directly in
            Plaid&apos;s secure interface — they never pass through our servers.
          </p>
        </section>

        {/* 2. Financial data */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            Your financial data
          </h2>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-stone">
            <li>
              <strong className="text-fjord">Encrypted in transit</strong> — All
              connections use HTTPS/TLS encryption.
            </li>
            <li>
              <strong className="text-fjord">Encrypted at rest</strong> —
              Database storage is encrypted by our hosting infrastructure
              (Neon). Plaid access tokens are additionally encrypted with
              AES-256 before storage.
            </li>
            <li>
              <strong className="text-fjord">Isolated per user</strong> — Each
              user&apos;s data is strictly isolated. No one can see another
              user&apos;s information. Every database query is scoped to the
              authenticated user.
            </li>
          </ul>
        </section>

        {/* 3. AI insights */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            AI-powered insights
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            When generating your Monthly Review, we send aggregated spending
            summaries (like &ldquo;Groceries: $211&rdquo;) to our AI provider
            (Anthropic). We never send bank account numbers, login credentials,
            or other sensitive identifiers. Anthropic does not use API data to
            train their models.{' '}
            <a
              href="https://www.anthropic.com/policies/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pine underline"
            >
              Learn more
            </a>
            .
          </p>
        </section>

        {/* 4. What we don't do */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            What we don&apos;t do
          </h2>
          <ul className="mt-2 space-y-1 text-sm leading-relaxed text-stone">
            <li>We don&apos;t sell your data.</li>
            <li>We don&apos;t share individual financial data with third parties.</li>
            <li>We don&apos;t store your bank login credentials.</li>
            <li>We don&apos;t display ads.</li>
          </ul>
        </section>

        {/* 5. Account control */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            Account control
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            You can disconnect bank accounts, export your data, or delete your
            account entirely from Settings at any time. Your data, your choice.
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-mist pt-6">
        <a href="/" className="text-sm text-pine hover:underline">
          &larr; Back to oversikt
        </a>
      </div>
    </main>
  )
}
