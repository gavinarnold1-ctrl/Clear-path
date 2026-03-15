# CLAUDE.md — AI Assistant Guide for Oversikt

This file provides context, conventions, and workflows for AI assistants (Claude and others) working in this repository. Keep it up to date as the project evolves.

---

## Project Overview

**Oversikt** (branded as "oversikt" in lowercase) is a personal budgeting web app. The name is Norwegian for "a clear, comprehensive view of the whole." Users can:

- Track income and expenses across multiple accounts
- Import bank CSV exports with smart column detection
- Set spending budgets by category with tiered budgeting (fixed, flexible, annual)
- Manage annual/sinking fund expenses with auto-funding and spend tracking
- View summary stats, spending breakdowns, and recent transactions on an overview dashboard
- Manage account balances (checking, savings, credit, investment, cash, mortgage, auto loan, student loan)
- Tag transactions by household member (person) and property for multi-person/multi-property tracking
- Track debts with principal vs interest breakdown and payoff progress
- Get AI-powered financial insights with actionable savings recommendations
- Complete an onboarding quiz to personalize their setup
- Explore the app with pre-seeded demo data (no registration required)
- Bulk select, edit, and delete transactions

---

## Tech Stack

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | Next.js (App Router) | ^15.1 |
| Language | TypeScript | ^5.7 |
| Styling | Tailwind CSS | ^3.4 |
| ORM | Prisma | ^5.22 |
| Database | PostgreSQL (Neon) | — |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) | ^0.x |
| Charts | Recharts | ^3.7 |
| Analytics | @vercel/speed-insights | ^1.x |
| Testing | Vitest + Testing Library | ^4.0 |
| Runtime | Node.js | ≥ 22 |
| Package manager | npm | — |

---

## Repository Structure

```
Clear-path/
├── docs/
│   └── brand-architecture.md # Oversikt brand system documentation
├── prisma/
│   ├── schema.prisma        # Database schema (all models — see Data Model section)
│   ├── migrations/          # SQL migrations (0_baseline, 1_onboarding, 2_reference_databases)
│   ├── seed.ts              # Monarch default categories + demo data
│   └── seed-demo.ts         # Demo user seed data
├── src/
│   ├── app/
│   │   ├── (auth)/          # Route group: login, register pages
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/     # Route group: protected pages behind the sidebar layout
│   │   │   ├── layout.tsx       # Sidebar nav wrapper
│   │   │   ├── dashboard/page.tsx   # Overview: True Remaining hero, budget pulse, stats, chart
│   │   │   ├── spending/
│   │   │   │   ├── page.tsx           # Spending breakdown (by category, person, property)
│   │   │   │   └── SpendingViews.tsx  # Client component: tabbed views for category/person/property
│   │   │   ├── monthly-review/
│   │   │   │   ├── page.tsx             # Monthly Review (renamed from Insights) with trajectory
│   │   │   │   └── GenerateButton.tsx   # Client component for triggering review generation
│   │   │   ├── insights/
│   │   │   │   └── page.tsx             # Redirect to /monthly-review
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx             # Settings: profile, members, properties, data tools, export, delete
│   │   │   │   └── SettingsClient.tsx   # Client component for settings management
│   │   │   ├── transactions/
│   │   │   │   ├── page.tsx         # Transaction list with bulk operations
│   │   │   │   ├── new/page.tsx     # Create transaction
│   │   │   │   └── import/
│   │   │   │       ├── page.tsx         # CSV import wizard page
│   │   │   │       └── ImportWizard.tsx # Client component: upload → map → preview → import
│   │   │   ├── budgets/
│   │   │   │   ├── page.tsx         # Tiered budget view (fixed, flexible, annual)
│   │   │   │   ├── new/page.tsx     # Create budget
│   │   │   │   └── annual/page.tsx  # Annual sinking fund dashboard
│   │   │   ├── debts/
│   │   │   │   └── page.tsx         # Debts page with P&I breakdown, PITI decomposition, amortization
│   │   │   ├── properties/
│   │   │   │   ├── page.tsx             # Properties & Businesses dashboard (per-property P&L)
│   │   │   │   └── PropertiesClient.tsx # Client component: dashboard + tax report tabs
│   │   │   ├── accounts/
│   │   │   │   ├── page.tsx         # Account list with net worth
│   │   │   │   └── new/page.tsx     # Create account
│   │   │   └── categories/
│   │   │       ├── page.tsx         # Category list
│   │   │       └── new/page.tsx     # Create category
│   │   ├── onboarding/page.tsx  # 3-step onboarding quiz (goal → household → income)
│   │   ├── actions/         # Server actions (auth, accounts, transactions, budgets, categories, onboarding)
│   │   ├── api/
│   │   │   ├── accounts/
│   │   │   │   ├── route.ts             # GET/POST accounts
│   │   │   │   └── [id]/route.ts        # PATCH/DELETE single account
│   │   │   ├── auth/demo/route.ts       # POST: demo login
│   │   │   ├── budgets/
│   │   │   │   ├── route.ts             # GET/POST budgets
│   │   │   │   ├── apply/route.ts       # POST: apply AI budget proposal
│   │   │   │   ├── generate/route.ts    # POST: AI budget generation
│   │   │   │   └── annual/
│   │   │   │       ├── route.ts         # GET/POST annual expenses
│   │   │   │       ├── [id]/route.ts    # PATCH/DELETE annual expense
│   │   │   │       └── auto-fund/route.ts # POST: auto-fund annual expenses
│   │   │   ├── categories/route.ts
│   │   │   ├── debts/
│   │   │   │   ├── route.ts             # GET/POST debts (with computed P&I fields)
│   │   │   │   └── [id]/route.ts        # GET/PATCH/DELETE single debt
│   │   │   ├── household-members/
│   │   │   │   ├── route.ts             # GET/POST household members
│   │   │   │   └── [id]/route.ts        # PATCH/DELETE household member
│   │   │   ├── properties/
│   │   │   │   ├── route.ts             # GET/POST properties (PERSONAL/RENTAL/BUSINESS)
│   │   │   │   └── [id]/route.ts        # PATCH/DELETE property (with financial fields + debt sync)
│   │   │   ├── property-groups/
│   │   │   │   ├── route.ts             # GET/POST property groups
│   │   │   │   ├── [id]/route.ts        # GET/PATCH/DELETE property group
│   │   │   │   └── [id]/backfill/route.ts # POST: run match rules on unsplit transactions
│   │   │   ├── split-match-rules/
│   │   │   │   ├── route.ts             # GET/POST split match rules
│   │   │   │   └── [id]/route.ts        # GET/PATCH/DELETE split match rule
│   │   │   ├── account-property-links/
│   │   │   │   └── route.ts             # GET/POST/DELETE account-property links
│   │   │   ├── category-mappings/
│   │   │   │   ├── route.ts             # GET all learned merchant→category mappings
│   │   │   │   └── [id]/route.ts        # DELETE a learned mapping
│   │   │   ├── dashboard/
│   │   │   │   └── growth/route.ts      # GET: budget performance + wealth growth data (period=6mo|12mo|all)
│   │   │   ├── cron/
│   │   │   │   ├── reset-demo/route.ts        # Daily demo data reset (Vercel cron)
│   │   │   │   ├── monthly-snapshot/route.ts  # Monthly snapshot cron (1st of month)
│   │   │   │   └── sync-plaid/route.ts        # Daily Plaid sync cron (6am UTC)
│   │   │   ├── insights/
│   │   │   │   ├── route.ts             # GET active insights, POST generate new
│   │   │   │   └── [id]/route.ts        # PATCH dismiss/complete insight
│   │   │   ├── profile/
│   │   │   │   ├── route.ts             # GET/PATCH user profile
│   │   │   │   ├── password/route.ts    # POST: change password
│   │   │   │   ├── delete/route.ts      # POST: permanently delete account
│   │   │   │   └── reset/route.ts       # POST: nuke all user data (keep account)
│   │   │   └── transactions/
│   │   │       ├── route.ts         # GET list, POST create
│   │   │       ├── [id]/route.ts    # GET one, PATCH, DELETE
│   │   │       ├── bulk/route.ts    # POST: bulk edit/delete
│   │   │       ├── export/route.ts  # GET: download transactions as CSV
│   │   │       └── import/
│   │   │           ├── route.ts         # POST: import confirmed transactions
│   │   │           └── preview/route.ts # POST: parse CSV and return column mappings
│   │   ├── globals.css          # Oversikt design tokens + component classes
│   │   ├── layout.tsx           # Root layout (DM Sans, Fraunces, JetBrains Mono fonts)
│   │   └── page.tsx             # Landing page with brand definition
│   ├── components/
│   │   ├── accounts/        # AccountManager (inline edit/delete, Plaid connect)
│   │   ├── annual/          # AnnualExpenseCard, AutoFundBanner, FundExpenseModal, LinkTransactionModal, etc.
│   │   ├── brand/           # OversiktMobile (brand showcase component)
│   │   ├── budget-builder/  # AI budget proposal UI (BudgetBuilderCTA, BudgetProposal, ProposalSections)
│   │   ├── budgets/         # Tiered budget sections (Fixed, Flexible, Annual) + TrueRemainingBanner + BudgetHealth + UncategorizedReviewBanner
│   │   ├── categories/      # CategoryManager (inline edit/delete)
│   │   ├── dashboard/       # MonthlyChart, SpendingBreakdown, BudgetPerformanceCard, WealthGrowthCard
│   │   ├── debts/           # DebtManager (debt cards with P&I/PITI breakdown, amortization schedule)
│   │   ├── forms/           # TransactionForm, BudgetForm, AccountForm, CategoryForm, LoginForm, RegisterForm
│   │   ├── import/          # CsvUploader, ColumnMapper, ImportPreview, ImportSummary
│   │   ├── insights/        # InsightCard, EfficiencyScoreGauge, SpendingComparison, InsightsList, InsightsSkeleton
│   │   ├── onboarding/      # OnboardingWizard (3-step), OnboardingBanner, GetStarted
│   │   ├── properties/      # PropertySetupWizard, AddPropertyButton, AddPropertyInline
│   │   ├── transactions/    # TransactionList (with bulk select/edit/delete, split sub-rows)
│   │   └── ui/              # BudgetCard, FixedBudgetCard, AnnualBudgetCard, ProgressBar, TierSummaryHeader
│   ├── lib/
│   │   ├── ai.ts            # Anthropic SDK client + prompt builder for insights
│   │   ├── apply-splits.ts  # Auto-apply property attribution splits (match rules only, no group defaults)
│   │   ├── benchmarks.ts    # Re-export shim → engines/benchmarks.ts
│   │   ├── budget-builder.ts # AI budget proposal generation
│   │   ├── budget-context.ts # Budget context builder for AI prompts
│   │   ├── budget-engine.ts  # Tiered budget calculations (fixed, flexible, annual, true remaining)
│   │   ├── budget-utils.ts   # Budget display helpers
│   │   ├── category-groups.ts # Category group inference + classifyTransaction() helper
│   │   ├── column-mapping.ts # Smart CSV column name detection for bank imports
│   │   ├── csv-parser.ts    # CSV parsing, date/amount handling, row transformation
│   │   ├── db.ts            # Prisma client singleton (hot-reload safe)
│   │   ├── demo.ts          # Demo mode detection helper
│   │   ├── encryption.ts    # AES-256-GCM encrypt/decrypt for Plaid tokens
│   │   ├── entity-summary.ts # Property/business summary builder for AI prompts
│   │   ├── insight-history.ts # Insight history tracking for AI context
│   │   ├── insights.ts      # Transaction summary builder + insight generation/storage
│   │   ├── jwt.ts           # Edge-safe JWT sign / verify (jose)
│   │   ├── password.ts      # bcrypt hash / verify
│   │   ├── plaid.ts         # Plaid SDK client, account type mapping, category mapping
│   │   ├── property-debt-sync.ts # Bidirectional Property ↔ Debt sync
│   │   ├── rate-limit.ts    # In-memory sliding-window rate limiter
│   │   ├── refund-detection.ts # Refund pair detection (same merchant, opposite amounts, 30-day window)
│   │   ├── seed-demo.ts     # Demo data generation logic
│   │   ├── session.ts       # Cookie-based session management
│   │   ├── snapshots.ts     # MonthlySnapshot computation + storage (with property breakdown)
│   │   ├── temporal-context.ts # Time-aware context for AI prompts
│   │   ├── utils.ts         # formatCurrency, formatDate, budgetProgress, cn
│   │   ├── validation.ts    # Zod schemas for all entity types
│   │   └── engines/         # Pure logic modules — no DB, no auth, no framework imports
│   │       ├── index.ts     # Barrel: amortization, tax, benchmarks, split namespaces
│   │       ├── amortization.ts # P&I breakdown, PITI decomposition, amortization schedule, extra payment impact
│   │       ├── tax.ts       # Deduction calculations, phase-outs, SALT, mortgage interest, QBI, depreciation
│   │       ├── benchmarks.ts # BLS comparisons, income quintiles, efficiency scoring
│   │       └── split.ts     # Property split engine: match rules, penny-perfect allocation
│   └── types/
│       ├── index.ts         # Shared TypeScript types mirroring the Prisma schema
│       └── insights.ts      # Insight, EfficiencyScore, benchmark, and AI response types
│   └── instrumentation.ts   # Next.js instrumentation hook (suppresses DEP0169 from follow-redirects)
├── middleware.ts             # Auth guard — redirects unauthenticated users away from protected routes
├── tests/
│   ├── setup.ts             # Vitest global setup (jest-dom matchers, mock cleanup)
│   ├── actions/             # Server action tests (auth, accounts, transactions, budgets)
│   ├── components/ui/       # Component tests (ProgressBar, BudgetCard)
│   ├── lib/                 # Unit tests (utils, jwt, password, benchmarks, insights, csv-parser, column-mapping, budget-engine)
│   ├── phase1/              # Phase 1 spec tests (budget spent, fixed expense matching, amount signs, AI insights)
│   └── phase2/              # Phase 2 spec tests (household members, property tagging, debts page)
├── .env.example             # Environment variable template
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── prettier.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json              # Vercel cron job config (daily demo reset)
├── vitest.config.ts
├── README.md
└── CLAUDE.md                # ← you are here
```

---

## Data Model Summary

```
User
 ├── UserProfile?            (onboarding state, financial goals, household info, incomeRange, goalSetAt)
 ├── Account[]               (checking, savings, credit, mortgage, auto loan, student loan, … — optional Debt? back-link, Plaid fields)
 ├── Category[]              (Groceries, Salary, Rent, … — system defaults + user-created)
 ├── Transaction[]           (positive amount = income, negative = expense; has splits[] for multi-property attribution)
 ├── Budget[]                (amount limit per category, period + tier via BudgetPeriod / BudgetTier enums)
 ├── AnnualExpense[]         (linked to Budget; yearly irregular expenses with funding tracking)
 ├── Insight[]               (AI-generated financial recommendations)
 ├── InsightFeedback[]       (user ratings/comments on insights)
 ├── EfficiencyScore[]       (monthly financial efficiency scores)
 ├── HouseholdMember[]       (household people — taggable on transactions, has isDefault flag)
 ├── Property[]              (personal/rental/business — taggable on transactions and debts, financial fields for PITI)
 ├── PropertyGroup[]         (groups properties for split allocation — e.g. multi-unit building)
 ├── Debt[]                  (mortgages, student loans, auto loans, credit cards — with P&I tracking)
 ├── UserCategoryMapping[]   (learned merchant→category mappings for auto-categorization)
 └── MonthlySnapshot[]       (monthly metrics snapshot: income, expenses, savings rate, debt, property breakdown, balance history, category breakdown)

PropertyGroup children:
 ├── SplitRule[]              (default allocation percentage per property within group)
 ├── SplitMatchRule[]         (pattern-based match rules for auto-splitting by merchant/category/description)

Transaction children:
 └── TransactionSplit[]       (per-property allocation of a transaction amount)

Account children:
 └── AccountPropertyLink[]    (links accounts to properties for auto-attribution)

Reference Databases (read-only, not user-scoped):
 ├── TaxRule[]                  (federal/state tax rules with thresholds)
 ├── TaxRuleThreshold[]         (income brackets per filing status)
 ├── DeductionCategoryMapping[] (maps spending categories → tax forms/lines)
 ├── TaxCalendar[]              (tax deadlines and reminders)
 ├── SpendingBenchmark[]        (BLS consumer expenditure data by demographics)
 ├── SpendingCategoryCrosswalk[] (BLS → app category mapping)
 └── IncomeBenchmark[]          (household income benchmarks by region)
```

Key relationships:
- A `Transaction` optionally belongs to an `Account`, one `Category`, one `AnnualExpense`, one `HouseholdMember`, and one `Property`. Income vs expense is determined by amount sign (positive = income, negative = expense). An optional `transactionType` field stores "debit"/"credit" from Monarch CSV imports. Indexed on `[userId, date]`, `[userId, categoryId]`, `[accountId]`, `[annualExpenseId]`, `[householdMemberId]`, and `[propertyId]`.
- A `Category` has a `group` (e.g. "Food & Dining", "Housing"), a string `type` ("income" / "expense" / "transfer"), and an optional `budgetTier` (`BudgetTier` enum: FIXED / FLEXIBLE / ANNUAL). Has optional tax fields: `isTaxRelevant` and `scheduleECategory`. System default categories have `userId: null` and `isDefault: true`; user-created categories have `isDefault: false`. Unique on `[userId, type, group, name]`.
- A `Budget` targets one `Category`, has a `period` (`BudgetPeriod` enum), `tier` (`BudgetTier` enum, default FLEXIBLE). `spent` is computed live from transactions — not stored. FIXED tier budgets have extra fields: `isAutoPay`, `dueDay`, `varianceLimit`. Has an optional one-to-one `annualExpense` relation.
- An `AnnualExpense` is linked to a `Budget` via `budgetId` (one-to-one) and can have linked `Transaction[]`. Tracks annual costs with `annualAmount`, `dueMonth`/`dueYear`, `monthlySetAside`, `funded`, and `status` ("planned" / "funded" / "spent" / "overspent").
- A `HouseholdMember` has `name` and `isDefault` (only one default per user). Transactions reference via `householdMemberId` (nullable, SetNull on delete).
- A `Property` has `name`, `type` (`PropertyType` enum: PERSONAL / RENTAL / BUSINESS), `isDefault`, and optional financial fields (`purchasePrice`, `currentValue`, `monthlyRent`, `monthlyMortgage`, `monthlyInsurance`, `monthlyTax`, `monthlyHoa`). Transactions reference via `propertyId` (nullable, SetNull on delete). Properties link to `Debt[]` and optionally belong to a `PropertyGroup` (for multi-unit split allocation). `AccountPropertyLink[]` connects accounts to properties for auto-attribution.
- A `PropertyGroup` groups related properties (e.g. a multi-unit building) for split allocation. Contains `SplitRule[]` (default percentage per property) and `SplitMatchRule[]` (pattern-based rules for auto-splitting by merchant/category/description).
- A `TransactionSplit` records a per-property allocation of a transaction's amount. When splits exist, the parent transaction is excluded from direct property attribution (preventing double-counting).
- A `UserCategoryMapping` stores learned merchant→category associations. Each mapping has `merchantPattern`, `categoryId`, `direction` (debit/credit), `amountMin`/`amountMax`, and `confidence` (0–1). Used for auto-categorization when no category is provided on transaction create.
- An `AccountPropertyLink` connects an `Account` to a `Property`, enabling auto-attribution of transactions from that account to the linked property.
- A `Debt` tracks a liability with `type` (`DebtType` enum: MORTGAGE / STUDENT_LOAN / AUTO / CREDIT_CARD / PERSONAL_LOAN / OTHER), `currentBalance`, `originalBalance`, `interestRate`, `minimumPayment`, and optional `propertyId`/`categoryId`/`accountId`. An optional unique `accountId` links a Debt to a Plaid-connected Account (one-to-one). When Plaid syncs loan/credit accounts, a corresponding Debt is auto-created. Balance refresh updates `currentBalance` without overwriting user-edited fields. On account deletion, `accountId` is set to null (preserving the Debt). Computed fields (`monthlyInterest`, `monthlyPrincipal`, `monthsRemaining`) are calculated on read, not stored.
- An `Insight` stores AI-generated recommendations with priority, savings estimates, action items (JSON), and optional feedback from users.
- An `EfficiencyScore` tracks monthly financial efficiency (0-100) with spending/savings/debt sub-scores; unique per user+period.
- Reference database models (TaxRule, SpendingBenchmark, etc.) are NOT user-scoped — they are read-only datasets shipped with the app.
- All user resources are scoped to a `User` via `userId`; cascade-delete on user removal. Exception: system default categories have `userId: null`.

---

## Development Commands

```bash
npm install            # Install dependencies
cp .env.example .env   # Set up local environment

npm run db:push        # Sync Prisma schema → PostgreSQL
npm run db:seed        # Populate with demo data
npm run db:studio      # Open Prisma Studio GUI

npm run dev            # Start dev server at localhost:3000
npm run build          # prisma generate + db push + next build
npm run lint           # ESLint
npm run format         # Prettier

npm test               # Run tests once
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

---

## Coding Conventions

### TypeScript

- `strict: true` — no `any`, no implicit `undefined`.
- Import types with `import type { … }` when no runtime value is needed.
- Shared domain types live in `src/types/index.ts`; Prisma types are available via `@prisma/client`.

### Tailwind CSS & Oversikt Brand

- Use the utility-first approach; avoid custom CSS unless Tailwind cannot express it.
- **Fonts**: DM Sans (body/sans), Fraunces (display/headings), JetBrains Mono (mono/numbers). Applied via CSS variables `--font-dm-sans`, `--font-fraunces`, `--font-jetbrains`.
- **Brand color palette** (defined in `tailwind.config.ts` and `globals.css`):
  - Primary: `fjord` (#1B3A4B), `pine` (#2D5F3E), `midnight` (#0F1F28)
  - Neutrals: `snow` (#F7F9F8), `frost` (#E8F0ED), `mist` (#C8D5CE), `stone` (#8B9A8E)
  - Accents: `lichen` (#A3B8A0), `birch` (#D4C5A9), `ember` (#C4704B)
  - Semantic: `income` (pine), `expense` (ember), `transfer` (birch)
- **Border radii**: `rounded-card` (12px), `rounded-button` (8px), `rounded-badge` (5px), `rounded-bar` (3px).
- Shared component classes in `globals.css`:
  - `.card` — frost bg, mist border, rounded-card
  - `.btn-primary` — fjord bg, snow text
  - `.btn-secondary` — transparent bg, mist border
  - `.btn-success` — pine bg
  - `.btn-danger` — ember bg
  - `.input` — snow bg, mist border, fjord focus ring

### Authentication

- JWT-based sessions stored in an `httpOnly` cookie (`oversikt-session`).
- `src/lib/jwt.ts` handles sign / verify using `jose` (Edge-compatible, no Node.js built-ins).
- `src/lib/session.ts` provides `getSession()`, `setSession()`, `clearSession()` helpers for Server Components and Route Handlers.
- `middleware.ts` guards protected routes (`/dashboard`, `/insights`, `/transactions`, `/budgets`, `/accounts`, `/categories`, `/spending`, `/onboarding`, `/debts`, `/properties`) and redirects unauthenticated users to `/login`.
- Server actions in `src/app/actions/` handle auth, CRUD for accounts, transactions, budgets, and categories.

### API Routes

- Route handlers live in `src/app/api/`.
- Always return `{ error: string }` with an appropriate HTTP status on failure.
- User identity is resolved from the session cookie via `getSession()`.
- Use `NextResponse.json()` for all responses.

### Database / Prisma

- The singleton client is exported from `src/lib/db.ts` as `db`. Always import from there — never instantiate `PrismaClient` elsewhere.
- Use `db.$transaction([…])` for multi-step writes.
- After changing `schema.prisma`, run `npm run db:push` (dev) or a migration in production.

### Amount Sign Convention (Critical)

The **amount sign** determines income vs expense:
- **Income**: `amount > 0` (positive)
- **Expense**: `amount < 0` (negative)

All server actions, API routes, and CSV import endpoints **enforce this convention** by looking up the category type and correcting the sign before writing to the database. Never rely on `category.type` relation filters (e.g. `category: { type: 'expense' }`) for income/expense queries — always use `amount: { gt: 0 }` or `amount: { lt: 0 }`.

### Transaction Classification (Critical)

The `classification` field (`'income'` / `'expense'` / `'transfer'`) is derived from the **category group** via a deterministic hierarchy. The shared helper `classifyTransaction()` in `src/lib/category-groups.ts` implements this:

1. **Category group = "Transfer" or "Transfers"** → `'transfer'`
2. **Category group = "Income" + positive amount** → `'income'`
3. **Category group = "Income" + non-positive amount** → `'expense'` (e.g. tax withholding)
4. **Fallback: category.type = "transfer"** → `'transfer'` (when group is missing)
5. **Fallback: category.type = "income" + positive amount** → `'income'`
6. **Everything else** → `'expense'`

This hierarchy is used consistently across all 4 write paths: CSV import, transaction create (POST route), transaction update (PATCH route), and server action. A repair endpoint at `POST /api/transactions/fix-classification` can recalculate classification for all existing transactions.

### Budget Spent Computation

Budget `spent` values are **computed live** from current-month expense transactions grouped by `categoryId`, not read from the stored `budget.spent` field. This prevents drift between the stored value and actual transaction totals. Both the dashboard and budget pages follow this pattern.

### Total Balance vs Net Worth

The **dashboard "Total Balance"** sums only asset account balances: `CHECKING`, `SAVINGS`, `INVESTMENT`, `CASH`. Liability accounts (`CREDIT_CARD`, `MORTGAGE`, `AUTO_LOAN`, `STUDENT_LOAN`) are excluded from this total.

The **accounts page "Net worth"** banner uses the full net-worth calculation: asset balances minus liability balances (using `Math.abs(balance)` for liabilities).

### Account Balance Computation

Manual/CSV accounts use a **baseline balance** model: the user enters a `startingBalance` and `balanceAsOfDate` (e.g. "my checking has $5,200 as of Feb 25, 2026"). New transactions after that date adjust the running balance. Until the user enters a baseline, balance = $0. Balances are **never** computed by summing all historical transactions (no starting point = meaningless number). Only Plaid-connected accounts get real balances from the API.

### Duplicate Name Validation

- **Accounts**: Case-insensitive duplicate name check using Prisma `mode: 'insensitive'`, enforced in both the server action (`actions/accounts.ts`) and the API route (`api/accounts/route.ts`).
- **Categories**: Case-insensitive duplicate check scoped to `[userId, type, group, name]` using Prisma `mode: 'insensitive'`.

### Account Deletion

When deleting an account, transactions linked to it are **unlinked** (set `accountId: null`) before the account is deleted, using `db.$transaction([…])` to ensure atomicity.

### Household Member / Property Deletion

When deleting a household member or property, transactions referencing it are **unlinked** (set `householdMemberId: null` or `propertyId: null`) before deletion, using `db.$transaction([…])` to ensure atomicity. The schema also uses `onDelete: SetNull` as a safety net.

### Default Member / Property

Each user can have at most one default `HouseholdMember` and one default `Property` (via `isDefault: true`). When setting a new default, the API routes unset any existing default first. Defaults are pre-selected in the transaction form.

### Settings Data Tools

The Settings page includes a "Data Tools" section with two utilities:

- **Fix Classifications**: Calls `POST /api/transactions/fix-classification` to recalculate income/expense/transfer classification for all transactions using the category-group hierarchy. Useful after CSV imports.
- **Reset All Data**: Calls `POST /api/profile/reset` to delete all user-scoped data (transactions, accounts, budgets, debts, categories, insights, snapshots, onboarding profile) while keeping the user account intact for a fresh start. Requires confirmation.

### Smart Category Learning (Auto-Categorization)

When a transaction is created (POST route or server action) without a `categoryId`, the system checks `UserCategoryMapping` records for the user. Multi-signal scoring selects the best match:
- **Merchant name**: 0.7 base score for an exact normalized match.
- **Direction bonus**: +0.15 if the transaction direction (debit/credit) matches the mapping.
- **Amount range bonus**: +0.15 if the transaction amount falls within the mapping's `amountMin`/`amountMax` range.
- **Threshold**: A mapping is applied only if the total score ≥ 0.7.

Mappings are created/updated when a user manually categorizes a transaction (PATCH route saves the merchant→category association).

### Property Attribution (Split Rules)

When a transaction is assigned to a property that belongs to a `PropertyGroup`, `applyPropertyAttribution()` in `src/lib/apply-splits.ts` checks group `SplitMatchRule[]` for a pattern match. If a match rule fires, `TransactionSplit` records are created per the rule's allocations. **If no match rule fires, the function returns immediately** — it does NOT fall back to group default split percentages. This respects the user's explicit property choice (e.g. rent income directed to one unit stays on that unit).

### Catch-All Budget Absorption

Flexible budgets named "Miscellaneous", "Uncategorized", "Other", or "Everything Else" absorb unclaimed expense spending. This includes:
- Transactions in categories that have no dedicated budget.
- Transactions with `categoryId: null` (no category assigned).

The budgets page computes this via `!tx.categoryId || !claimedCategoryIds.has(tx.categoryId)`.

### Uncategorized Transaction Review

When uncategorized expense transactions exist in the current month, the budgets page shows an `UncategorizedReviewBanner` (birch-toned) with a count and a link to `/transactions?uncategorized=true&month=YYYY-MM`. The transactions page supports a `filterUncategorized` mode that shows only `categoryId: null` transactions for user triage.

### Plaid Integration

- Plaid SDK client is configured in `src/lib/plaid.ts` with environment from `PLAID_ENV` (default: sandbox).
- Access tokens are encrypted at rest via AES-256-GCM (`src/lib/encryption.ts`) using `ENCRYPTION_KEY`.
- Token exchange (`/api/plaid/exchange-token`) creates accounts and auto-creates `Debt` records for loan/credit-type accounts.
- Balance refresh (`/api/plaid/balances`) updates account balances and syncs linked Debt `currentBalance`.
- Transaction sync (`/api/plaid/sync-transactions`) uses Plaid's sync cursor for incremental imports.
- `src/instrumentation.ts` suppresses the DEP0169 `url.parse()` deprecation warning from the `follow-redirects` transitive dependency (plaid → axios → follow-redirects) on Node.js ≥ 22.

### Components

- UI primitives go in `src/components/ui/` (BudgetCard, ProgressBar).
- Form components go in `src/components/forms/` and use `useActionState` with server actions.
- Data-fetching components should be React Server Components where possible; use `'use client'` only when client interactivity is required (forms).

### Testing

- Test files live in `tests/` mirroring the `src/` structure.
- Unit tests use Vitest with `globals: true` (no need to import `describe`, `it`, `expect`).
- `tests/setup.ts` imports `@testing-library/jest-dom/vitest` for DOM matchers and clears mocks after each test.
- Component tests use `@testing-library/react`.
- Mock Prisma in server action tests — never hit a real database in CI.
- `tests/` is excluded from `tsconfig.json` so test-only imports (vitest, jest-dom) don't interfere with the Next.js build.
- Phase spec tests live in `tests/phase1/` and `tests/phase2/`, verifying PRD requirements via schema reads, source code verification, mocked API tests, and computed value unit tests. See `/docs/TESTS.md` for the full test spec.

---

## Git Workflow

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable, production-ready code |
| `claude/<description>-<id>` | AI-driven feature / fix branches |

- AI assistant branches must start with `claude/` and end with the session ID suffix from the task context.

### Commits

- Imperative mood: `Add budget progress bar`, not `Added …`.
- One logical change per commit; never mix unrelated concerns.
- Never commit `.env`, secrets, or large binaries.

### Push

```bash
git push -u origin <branch-name>
```

- Do not force-push `main`.
- Retry on network failure with exponential backoff (2 s → 4 s → 8 s → 16 s).

---

## Deployment (Vercel + Neon)

The app deploys on **Vercel** with a **Neon PostgreSQL** database.

### Required Environment Variables (Vercel project settings)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon **pooled** connection string |
| `DIRECT_URL` | Neon **direct** (non-pooled) connection string |
| `SESSION_SECRET` | Random 32+ character string for JWT signing |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI Insights feature |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM Plaid token encryption |
| `PLAID_CLIENT_ID` | Plaid API client ID |
| `PLAID_SECRET` | Plaid API secret |
| `PLAID_ENV` | Plaid environment: `sandbox`, `development`, or `production` |

### Build Pipeline

`npm run build` runs: `prisma generate` → `prisma db push` → `next build`.
This ensures the Prisma client is generated and database tables exist before the Next.js build.

---

## AI Assistant Guidelines

### Before Making Changes

1. **Read every file you intend to modify** before editing.
2. **Follow existing patterns** — don't introduce new conventions when the codebase already has one.
3. **Stay in scope** — implement only what was requested; do not refactor surrounding code.

### Code Quality

- No security vulnerabilities: avoid SQL injection (use Prisma's parameterized queries), XSS, command injection.
- Do not add comments or docstrings to code you did not change.
- Remove dead code; do not leave `// removed` stubs.

### Requirements & Progress Workflow

- **Do not edit `docs/PRD.md` or `docs/TESTS.md`.** These are read-only requirements managed externally.
- **Read `docs/PRD.md` for requirements and `docs/TESTS.md` for test specs** before starting any task.
- **Track implementation progress in `docs/PROGRESS.md`.**
- **After every file change:**
  1. Run `npm run build` (zero errors before commit).
  2. Run `npx tsc --noEmit` for faster type-checking.
  3. Read the full file before editing.

### When in Doubt

- Ask before deleting files or resetting the database.
- Confirm before pushing to any branch other than the designated feature branch.
- If a task requires a new dependency, call it out explicitly rather than silently adding it.

---

## Updating This File

Update CLAUDE.md whenever:

- A new dependency is added or an existing one is upgraded significantly.
- The directory structure changes.
- New coding conventions are established.
- The database schema changes materially.
- Deployment or environment setup changes.
