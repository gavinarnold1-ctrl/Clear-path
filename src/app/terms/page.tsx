import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — oversikt',
  description: 'Terms of Service for Oversikt',
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-medium text-fjord">
        Terms of Service
      </h1>
      <p className="mt-1 text-sm text-stone">Effective Date: March 2, 2026</p>
      <p className="mt-4 text-sm leading-relaxed text-stone">
        Welcome to Oversikt. These Terms of Service (&ldquo;Terms&rdquo;) govern
        your access to and use of the Oversikt application and related services
        (collectively, the &ldquo;Service&rdquo;). By creating an account or
        using the Service, you agree to be bound by these Terms.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        Oversikt is operated by Gavin Arnold (&ldquo;we,&rdquo;
        &ldquo;our,&rdquo; or &ldquo;us&rdquo;). If you do not agree to these
        Terms, do not use the Service.
      </p>

      <div className="mt-10 space-y-10">
        {/* 1. Eligibility */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">1. Eligibility</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            You must be at least 18 years old to use Oversikt. By using the
            Service, you represent that you are at least 18 years of age and
            have the legal capacity to enter into these Terms. If you are using
            the Service on behalf of a household, you represent that you have
            authority to bind that household to these Terms.
          </p>
        </section>

        {/* 2. Account Registration */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            2. Account Registration
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            To access the Service, you must create an account by providing a
            valid email address and password. You are responsible for:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activity that occurs under your account</li>
            <li>
              Notifying us immediately of any unauthorized use of your account
            </li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We reserve the right to suspend or terminate accounts that we
            reasonably believe are being used in violation of these Terms.
          </p>
        </section>

        {/* 3. Description of Service */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            3. Description of Service
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Oversikt is a personal finance application that helps you track
            spending, manage budgets, and understand your financial picture. The
            Service may include:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>Manual transaction entry and CSV import</li>
            <li>Bank account connectivity through Plaid, Inc. (&ldquo;Plaid&rdquo;)</li>
            <li>
              Budget creation and tracking across fixed, flexible, and annual
              categories
            </li>
            <li>Spending analysis, benchmarking, and financial insights</li>
            <li>AI-powered categorization and financial feedback</li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We may modify, update, or discontinue features of the Service at any
            time. We will make reasonable efforts to notify you of material
            changes.
          </p>
        </section>

        {/* 4. Bank Connectivity (Plaid) */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            4. Bank Connectivity (Plaid)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            If you choose to connect a bank account, you authorize Oversikt to
            access your financial data through Plaid. By connecting an account,
            you:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              Authorize Plaid to retrieve your account and transaction data on
              our behalf
            </li>
            <li>
              Acknowledge that Plaid&apos;s own Terms of Service and Privacy
              Policy govern their handling of your bank credentials
            </li>
            <li>
              Understand that we receive read-only access to account balances and
              transaction data &mdash; we never receive your bank login
              credentials
            </li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            You may disconnect any linked account at any time from within the
            app. Disconnecting immediately revokes the access token and stops
            future data syncing.
          </p>
        </section>

        {/* 5. Your Data */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">5. Your Data</h2>

          <h3 className="mt-4 font-semibold text-fjord">5.1 Ownership</h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            You retain full ownership of your financial data. We do not claim any
            ownership rights over data you provide to or generate through the
            Service.
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            5.2 How We Use Your Data
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            We use your data solely to provide and improve the Service. We do not
            sell, rent, or share your data with third parties for their own
            purposes. For complete details on data handling, please refer to
            our{' '}
            <a href="/privacy" className="text-pine underline">
              Privacy Policy
            </a>
            .
          </p>

          <h3 className="mt-4 font-semibold text-fjord">
            5.3 Data Portability
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            You may export your data from the Service at any time in standard
            formats (CSV). We believe your data belongs to you and should be
            portable.
          </p>

          <h3 className="mt-4 font-semibold text-fjord">5.4 Data Deletion</h3>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            You may request deletion of your account and all associated data at
            any time. Upon deletion, all personal data &mdash; including
            transactions, budgets, preferences, and Plaid access tokens &mdash;
            is permanently removed within 30 days.
          </p>
        </section>

        {/* 6. Acceptable Use */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            6. Acceptable Use
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            You agree not to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              Use the Service for any unlawful purpose or in violation of any
              applicable laws
            </li>
            <li>
              Attempt to gain unauthorized access to any part of the Service or
              its related systems
            </li>
            <li>
              Interfere with or disrupt the integrity or performance of the
              Service
            </li>
            <li>
              Reverse engineer, decompile, or disassemble any aspect of the
              Service
            </li>
            <li>
              Use automated means (bots, scrapers, etc.) to access the Service
              without our written consent
            </li>
            <li>Misrepresent your identity or provide false information</li>
            <li>Use the Service to store or transmit malicious code</li>
          </ul>
        </section>

        {/* 7. AI-Powered Features */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            7. AI-Powered Features
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Oversikt uses artificial intelligence to provide categorization
            suggestions, spending insights, and financial feedback. You
            acknowledge that:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              AI-generated insights are informational only and do not constitute
              financial, tax, legal, or investment advice
            </li>
            <li>
              AI categorization may occasionally be inaccurate and should be
              reviewed by you
            </li>
            <li>
              We send only aggregated, anonymized financial summaries to our AI
              provider &mdash; never raw transaction details, account numbers, or
              personally identifiable information
            </li>
            <li>
              You should consult a qualified professional before making financial
              decisions based on any information provided by the Service
            </li>
          </ul>
        </section>

        {/* 8. Intellectual Property */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            8. Intellectual Property
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            The Service, including its design, code, brand elements, and
            documentation, is owned by Oversikt and protected by applicable
            intellectual property laws. These Terms do not grant you any right to
            use our trademarks, logos, or brand elements.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We grant you a limited, non-exclusive, non-transferable, revocable
            license to use the Service for personal, non-commercial purposes in
            accordance with these Terms.
          </p>
        </section>

        {/* 9. Fees and Payment */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            9. Fees and Payment
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Oversikt is currently offered free of charge during our initial
            launch period. We reserve the right to introduce paid features or
            subscription plans in the future. If we do, we will provide advance
            notice and you will not be charged without your explicit consent.
          </p>
        </section>

        {/* 10. Disclaimer of Warranties */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            10. Disclaimer of Warranties
          </h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-stone">
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
            AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
            IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We do not warrant that:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone">
            <li>
              The Service will be uninterrupted, secure, or error-free
            </li>
            <li>
              Financial data displayed will be perfectly accurate or complete at
              all times
            </li>
            <li>The Service will meet all of your requirements</li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Bank data availability depends on Plaid and your financial
            institution, which are outside our control.
          </p>
        </section>

        {/* 11. Limitation of Liability */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            11. Limitation of Liability
          </h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-stone">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, OVERSIKT AND ITS OPERATOR
            SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO
            LOSS OF DATA, LOSS OF PROFITS, OR FINANCIAL LOSSES ARISING FROM YOUR
            USE OF THE SERVICE.
          </p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-stone">
            OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM OR RELATED TO THE
            SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12)
            MONTHS PRECEDING THE CLAIM, OR $100, WHICHEVER IS GREATER.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Oversikt is a budgeting and financial tracking tool. It is not a
            financial advisor, tax preparer, or fiduciary. You are solely
            responsible for your financial decisions.
          </p>
        </section>

        {/* 12. Indemnification */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            12. Indemnification
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            You agree to indemnify, defend, and hold harmless Oversikt and its
            operator from and against any claims, liabilities, damages, losses,
            and expenses (including reasonable attorney&apos;s fees) arising out
            of or in any way connected with your use of the Service or your
            violation of these Terms.
          </p>
        </section>

        {/* 13. Termination */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            13. Termination
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            You may stop using the Service and delete your account at any time.
            We may suspend or terminate your access to the Service at any time
            for violation of these Terms, with or without notice.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Upon termination, your right to use the Service ceases immediately.
            Sections 5.4 (Data Deletion), 10 (Disclaimers), 11 (Limitation of
            Liability), 12 (Indemnification), and 15 (Governing Law) survive
            termination.
          </p>
        </section>

        {/* 14. Changes to These Terms */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            14. Changes to These Terms
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            We may update these Terms from time to time. If we make material
            changes, we will notify you by email or through a prominent notice in
            the application at least 30 days before the changes take effect. Your
            continued use of the Service after the updated Terms become effective
            constitutes your acceptance of the changes.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            If you do not agree to the updated Terms, you may delete your account
            before the changes take effect.
          </p>
        </section>

        {/* 15. Governing Law */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            15. Governing Law
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            These Terms are governed by and construed in accordance with the laws
            of the State of Georgia, United States, without regard to its
            conflict of law provisions. Any disputes arising under these Terms
            shall be resolved in the courts located in the State of Georgia.
          </p>
        </section>

        {/* 16. Severability */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            16. Severability
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            If any provision of these Terms is found to be unenforceable or
            invalid, that provision shall be modified to the minimum extent
            necessary to make it enforceable, and the remaining provisions shall
            continue in full force and effect.
          </p>
        </section>

        {/* 17. Entire Agreement */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">
            17. Entire Agreement
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            These Terms, together with our{' '}
            <a href="/privacy" className="text-pine underline">
              Privacy Policy
            </a>
            , constitute the entire agreement between you and Oversikt regarding
            the Service and supersede any prior agreements or understandings.
          </p>
        </section>

        {/* 18. Contact Us */}
        <section>
          <h2 className="text-xl font-semibold text-fjord">18. Contact Us</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            If you have questions about these Terms, please contact us at:
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
