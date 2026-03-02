import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — oversikt',
  description: 'How Oversikt collects, uses, and protects your data',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-medium text-fjord">
        Privacy Policy
      </h1>
      <p className="mt-1 text-sm text-stone">Effective Date: March 2, 2026</p>
      <p className="mt-4 text-sm leading-relaxed text-stone">
        Oversikt (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is
        operated by Gavin Arnold. This Privacy Policy explains how we collect,
        use, store, and protect your information when you use the Oversikt
        application and related services (the &ldquo;Service&rdquo;).
      </p>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        By using the Service, you agree to the collection and use of information
        in accordance with this policy. If you do not agree, please do not use
        the Service.
      </p>

      <div className="mt-10 space-y-10">
        {/* 1. Information We Collect */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            1. Information We Collect
          </h2>

          <h3 className="mt-4 font-semibold text-fjord">
            1.1 Information You Provide
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              <strong className="text-fjord">Account information:</strong> name,
              email address, and password when you register
            </li>
            <li>
              <strong className="text-fjord">Financial data:</strong>{' '}
              transactions, account balances, budgets, categories, and other
              financial information you enter manually or import via CSV
            </li>
            <li>
              <strong className="text-fjord">Profile preferences:</strong>{' '}
              onboarding responses, household members, properties, and financial
              goals
            </li>
          </ul>

          <h3 className="mt-4 font-semibold text-fjord">
            1.2 Information from Third Parties
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            If you connect a bank account through{' '}
            <a
              href="https://plaid.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pine underline"
            >
              Plaid
            </a>
            , we receive read-only access to your account balances and
            transaction history. We never receive your bank login credentials
            &mdash; those are entered directly in Plaid&apos;s secure interface.
            Plaid&apos;s handling of your data is governed by their own{' '}
            <a
              href="https://plaid.com/legal/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pine underline"
            >
              Privacy Policy
            </a>
            .
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            1.3 Automatically Collected Information
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            We collect basic performance analytics through Vercel Speed Insights
            to understand page load times and improve the Service. We do not use
            third-party advertising trackers, and we do not collect or store IP
            addresses for profiling purposes.
          </p>
        </section>

        {/* 2. How We Use Your Information */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            2. How We Use Your Information
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We use your information solely to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>Provide, maintain, and improve the Service</li>
            <li>
              Display your financial data, budgets, spending breakdowns, and
              insights
            </li>
            <li>
              Generate AI-powered financial insights and categorization
              suggestions
            </li>
            <li>Authenticate your identity and secure your account</li>
            <li>
              Respond to your inquiries and provide customer support
            </li>
          </ul>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-stone">
            We do not sell, rent, or share your personal data with third parties
            for their own marketing or commercial purposes.
          </p>
        </section>

        {/* 3. AI-Powered Features */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            3. AI-Powered Features
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            When generating financial insights and categorization suggestions, we
            send aggregated spending summaries (e.g., &ldquo;Groceries:
            $211&rdquo;) to our AI provider, Anthropic. We never send:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>Bank account numbers or routing numbers</li>
            <li>Login credentials</li>
            <li>Full transaction details with merchant identifiers</li>
            <li>Personally identifiable information</li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Anthropic does not use API data to train their models. For more
            details, see{' '}
            <a
              href="https://www.anthropic.com/policies/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pine underline"
            >
              Anthropic&apos;s Privacy Policy
            </a>
            .
          </p>
        </section>

        {/* 4. Data Storage and Security */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            4. Data Storage and Security
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              <strong className="text-fjord">Encrypted in transit:</strong> All
              connections use HTTPS/TLS encryption
            </li>
            <li>
              <strong className="text-fjord">Encrypted at rest:</strong> Database
              storage is encrypted by our hosting infrastructure (Neon). Plaid
              access tokens are additionally encrypted with AES-256 before
              storage
            </li>
            <li>
              <strong className="text-fjord">Isolated per user:</strong> Each
              user&apos;s data is strictly isolated &mdash; every database query
              is scoped to the authenticated user
            </li>
            <li>
              <strong className="text-fjord">Secure authentication:</strong>{' '}
              Passwords are hashed with bcrypt. Sessions use HttpOnly,
              SameSite=Strict cookies with JWT tokens
            </li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            While we implement industry-standard security measures, no method of
            electronic storage is 100% secure. We cannot guarantee absolute
            security but are committed to protecting your data.
          </p>
        </section>

        {/* 5. Data Sharing */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            5. Data Sharing
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We share your data only with the following service providers, solely
            to operate the Service:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              <strong className="text-fjord">Plaid:</strong> Bank account
              connectivity (only if you choose to link an account)
            </li>
            <li>
              <strong className="text-fjord">Anthropic:</strong> AI-powered
              insights (aggregated summaries only, no PII)
            </li>
            <li>
              <strong className="text-fjord">Neon:</strong> Database hosting
              (encrypted at rest)
            </li>
            <li>
              <strong className="text-fjord">Vercel:</strong> Application hosting
              and performance analytics
            </li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We do not sell your data. We do not share your data with advertisers.
            We do not display ads.
          </p>
        </section>

        {/* 6. Data Retention */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            6. Data Retention
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We retain your data for as long as your account is active. You may
            delete your account and all associated data at any time from
            Settings. Upon deletion, all personal data &mdash; including
            transactions, budgets, preferences, and Plaid access tokens &mdash;
            is permanently removed within 30 days.
          </p>
        </section>

        {/* 7. Your Rights */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">7. Your Rights</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            You have the right to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              <strong className="text-fjord">Access</strong> your data at any
              time within the app
            </li>
            <li>
              <strong className="text-fjord">Export</strong> your data in
              standard formats (CSV) from Settings
            </li>
            <li>
              <strong className="text-fjord">Correct</strong> your data by
              editing transactions, accounts, and budgets
            </li>
            <li>
              <strong className="text-fjord">Delete</strong> your account and all
              associated data from Settings
            </li>
            <li>
              <strong className="text-fjord">Disconnect</strong> linked bank
              accounts at any time, which immediately revokes the access token
            </li>
          </ul>
        </section>

        {/* 8. Cookies */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">8. Cookies</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We use only essential cookies required for authentication. These
            HttpOnly, SameSite=Strict cookies contain encrypted session tokens
            and cannot be accessed by third-party scripts. We do not use tracking
            cookies, advertising cookies, or analytics cookies.
          </p>
        </section>

        {/* 9. Children's Privacy */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            9. Children&apos;s Privacy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            The Service is not intended for users under 18 years of age. We do
            not knowingly collect personal information from anyone under 18. If
            we learn that we have collected data from someone under 18, we will
            delete it promptly.
          </p>
        </section>

        {/* 10. Changes to This Policy */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            10. Changes to This Policy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We may update this Privacy Policy from time to time. If we make
            material changes, we will notify you by email or through a prominent
            notice in the application at least 30 days before the changes take
            effect. Your continued use of the Service after the updated policy
            becomes effective constitutes your acceptance of the changes.
          </p>
        </section>

        {/* 11. Contact Us */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">11. Contact Us</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            If you have questions about this Privacy Policy or our data
            practices, please contact us at:
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Oversikt
            <br />
            Email:{' '}
            <a
              href="mailto:gavinarnold1@gmail.com"
              className="text-pine underline"
            >
              gavinarnold1@gmail.com
            </a>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We aim to respond to all inquiries within 30 days.
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
