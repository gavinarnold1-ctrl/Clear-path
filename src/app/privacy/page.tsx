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
      <p className="mt-1 text-sm text-stone">
        Effective Date: February 27, 2026
      </p>
      <p className="mt-4 text-sm leading-relaxed text-stone">
        Oversikt (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is
        a personal finance application that helps you understand your spending,
        manage your budget, and make informed financial decisions. This Privacy
        Policy explains how we collect, use, store, and protect your information
        when you use our application and services.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        We take your privacy seriously. We built Oversikt with the principle that
        your financial data belongs to you, and we handle it with the care that
        responsibility demands.
      </p>

      <div className="mt-10 space-y-10">
        {/* 1. Information We Collect */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            1. Information We Collect
          </h2>

          <h3 className="mt-4 font-semibold text-fjord">
            1.1 Information You Provide Directly
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              <strong className="text-fjord">Account information:</strong> your
              name and email address when you create an Oversikt account
            </li>
            <li>
              <strong className="text-fjord">Budget preferences:</strong> budget
              amounts, category configurations, and financial goals you set
              within the app
            </li>
            <li>
              <strong className="text-fjord">Manual entries:</strong> any income,
              expense, or account information you enter manually
            </li>
          </ul>

          <h3 className="mt-4 font-semibold text-fjord">
            1.2 Information We Collect Through Plaid
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            When you choose to connect a bank account, we use Plaid, Inc.
            (&ldquo;Plaid&rdquo;) to securely access your financial data.
            Through Plaid, we receive:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              <strong className="text-fjord">Account information:</strong>{' '}
              account name, type (checking, savings, credit card), and current
              balance
            </li>
            <li>
              <strong className="text-fjord">Transaction data:</strong>{' '}
              transaction date, amount, merchant name, and category
            </li>
            <li>
              <strong className="text-fjord">
                Recurring transaction patterns:
              </strong>{' '}
              information about recurring charges and deposits identified by
              Plaid
            </li>
          </ul>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-stone">
            Important: We never receive, see, or store your bank login
            credentials. Plaid handles all direct authentication with your
            financial institution. We receive only read-only access to account
            and transaction data.
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            1.3 Information Collected Automatically
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              <strong className="text-fjord">Usage data:</strong> how you
              interact with the app (pages visited, features used) to improve
              the product
            </li>
            <li>
              <strong className="text-fjord">Device information:</strong>{' '}
              browser type and operating system for compatibility and
              troubleshooting
            </li>
            <li>
              We do not use tracking cookies for advertising. We do not sell your
              data. We do not serve ads.
            </li>
          </ul>
        </section>

        {/* 2. How We Use Your Information */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            2. How We Use Your Information
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We use your information solely to provide and improve Oversikt.
            Specifically:
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm text-stone">
              <thead>
                <tr className="border-b border-mist text-left">
                  <th className="pb-2 pr-4 font-semibold text-fjord">
                    Purpose
                  </th>
                  <th className="pb-2 font-semibold text-fjord">Data Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist/50">
                <tr>
                  <td className="py-2 pr-4">
                    Display your financial dashboard and budgets
                  </td>
                  <td className="py-2">
                    Account balances, transactions, budget settings
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Categorize and track spending
                  </td>
                  <td className="py-2">
                    Transaction data, merchant names, user category preferences
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Detect income automatically</td>
                  <td className="py-2">
                    Recurring deposit patterns from transaction history
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Identify recurring bills and subscriptions
                  </td>
                  <td className="py-2">
                    Recurring transaction data from Plaid
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Learn your category preferences over time
                  </td>
                  <td className="py-2">
                    Your categorization choices (stored locally to your account)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Provide financial insights and analysis
                  </td>
                  <td className="py-2">
                    Aggregated spending patterns, budget vs. actual comparisons
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Improve the application</td>
                  <td className="py-2">
                    Anonymized usage patterns, error logs
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-stone">
            We do not use your financial data for any purpose other than
            providing Oversikt&apos;s services to you. We do not use your data to
            build advertising profiles, sell to third parties, or make lending or
            credit decisions.
          </p>
        </section>

        {/* 3. How We Share Your Information */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            3. How We Share Your Information
          </h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-stone">
            We do not sell, rent, or trade your personal information.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We share data only in the following limited circumstances:
          </p>

          <h3 className="mt-4 font-semibold text-fjord">3.1 Plaid</h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            We use Plaid to connect to your financial institutions. When you
            connect an account, Plaid&apos;s own privacy policy governs how they
            handle your bank credentials and the data they access on our behalf.
            You can review{' '}
            <a
              href="https://plaid.com/legal"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pine underline"
            >
              Plaid&apos;s privacy policy
            </a>
            .
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            3.2 Infrastructure Providers
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            Your data is processed and stored using third-party infrastructure
            providers (such as our hosting provider and database service). These
            providers process data solely on our behalf, under contract, and do
            not have independent rights to use your data.
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            3.3 Legal Requirements
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            We may disclose your information if required by law, legal process,
            or government request, or if necessary to protect the rights, safety,
            or property of Oversikt, our users, or the public.
          </p>
        </section>

        {/* 4. Data Storage and Security */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            4. Data Storage and Security
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              All data in transit is encrypted using TLS 1.2 or higher (HTTPS on
              all connections)
            </li>
            <li>
              All data at rest is encrypted using AES-256 encryption on our
              managed database infrastructure
            </li>
            <li>
              API keys and secrets are stored as encrypted environment variables,
              never in source code
            </li>
            <li>
              Database access is restricted to application-level connections with
              no public endpoint
            </li>
            <li>
              We use multi-factor authentication on all systems that store or
              process your data
            </li>
            <li>
              We maintain an automated test suite and follow secure development
              practices
            </li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            For more detail, see our Information Security Policy and Access
            Controls Policy, available upon request.
          </p>
        </section>

        {/* 5. Data Retention */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            5. Data Retention
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We retain your data only as long as you maintain an active Oversikt
            account. Specifically:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              <strong className="text-fjord">Transaction data:</strong> retained
              for as long as your account is active, to power budgeting and trend
              analysis
            </li>
            <li>
              <strong className="text-fjord">
                Budget settings and preferences:
              </strong>{' '}
              retained for as long as your account is active
            </li>
            <li>
              <strong className="text-fjord">Category learning data:</strong>{' '}
              retained for as long as your account is active to improve
              categorization accuracy
            </li>
            <li>
              <strong className="text-fjord">Usage logs:</strong> retained for up
              to 90 days for troubleshooting and product improvement, then
              deleted
            </li>
          </ul>
        </section>

        {/* 6. Your Rights and Choices */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            6. Your Rights and Choices
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            You have control over your data at all times:
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            6.1 Access Your Data
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            You can view all data Oversikt holds about you directly within the
            application, including all transactions, account balances, and budget
            settings.
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            6.2 Disconnect Accounts
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            You can disconnect any linked bank account at any time from within
            the app. Disconnecting revokes Plaid&apos;s access token immediately
            and stops all future data syncing from that account.
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            6.3 Delete Your Account
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            You can request deletion of your account and all associated data at
            any time. Upon deletion:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>All Plaid access tokens are revoked immediately</li>
            <li>
              All your personal data (transactions, balances, budgets,
              preferences, category mappings) is permanently deleted within 30
              days
            </li>
            <li>
              Backups containing your data are purged on the same schedule
            </li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            To request account deletion, contact us at the email address listed
            in Section 10.
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            6.4 Export Your Data
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            You can export your transaction and budget data from within the
            application in standard formats (CSV).
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            6.5 Correct Your Data
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            You can update your account information, recategorize transactions,
            and modify budget settings at any time within the app.
          </p>
        </section>

        {/* 7. California Privacy Rights (CCPA/CPRA) */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            7. California Privacy Rights (CCPA/CPRA)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            If you are a California resident, you have additional rights under
            the California Consumer Privacy Act (CCPA) and California Privacy
            Rights Act (CPRA):
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              <strong className="text-fjord">Right to know:</strong> You can
              request a detailed description of the personal information we have
              collected about you.
            </li>
            <li>
              <strong className="text-fjord">Right to delete:</strong> You can
              request deletion of your personal information (see Section 6.3).
            </li>
            <li>
              <strong className="text-fjord">Right to opt-out of sale:</strong>{' '}
              We do not sell your personal information. There is nothing to opt
              out of.
            </li>
            <li>
              <strong className="text-fjord">
                Right to non-discrimination:
              </strong>{' '}
              We will not treat you differently for exercising your privacy
              rights.
            </li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            To exercise these rights, contact us using the information in Section
            10. We will respond within 45 days.
          </p>
        </section>

        {/* 8. Children's Privacy */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            8. Children&apos;s Privacy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Oversikt is not directed to children under the age of 13. We do not
            knowingly collect personal information from children under 13. If we
            learn that we have collected personal information from a child under
            13, we will delete that information promptly.
          </p>
        </section>

        {/* 9. Changes to This Privacy Policy */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            9. Changes to This Privacy Policy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We may update this Privacy Policy from time to time. If we make
            material changes, we will notify you by email or through a prominent
            notice in the application before the changes take effect. Your
            continued use of Oversikt after any changes constitutes your
            acceptance of the updated policy.
          </p>
        </section>

        {/* 10. Contact Us */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">10. Contact Us</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            If you have questions about this Privacy Policy, want to exercise
            your data rights, or have concerns about how your information is
            handled, contact us at:
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Oversikt
            <br />
            Email:{' '}
            <a
              href="mailto:hello@oversikt.io"
              className="text-pine underline"
            >
              hello@oversikt.io
            </a>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We aim to respond to all privacy-related inquiries within 30 days.
          </p>
        </section>

        {/* 11. Plaid End-User Data Policy */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            11. Plaid End-User Data Policy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            This section specifically addresses how Oversikt handles data
            received through the Plaid API, in compliance with Plaid&apos;s
            developer requirements:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              We use Plaid data only to provide Oversikt&apos;s budgeting,
              spending analysis, and financial intelligence features to you.
            </li>
            <li>
              We do not sell, lease, or distribute Plaid data to any third party
              for their own purposes.
            </li>
            <li>
              We do not use Plaid data for marketing, advertising, or building
              consumer profiles for any purpose other than providing our services
              to you.
            </li>
            <li>
              We retain Plaid data only for as long as necessary to provide our
              services and fulfill the purposes described in this policy.
            </li>
            <li>
              We apply the same security protections to Plaid data as to all
              other sensitive data in our systems (encryption in transit and at
              rest, access controls, secure development practices).
            </li>
            <li>
              You can revoke our access to your financial data at any time by
              disconnecting your accounts within the app or by contacting us to
              delete your account.
            </li>
          </ul>
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
