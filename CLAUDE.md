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
| Testing | Vitest + Testing Library | ^2.1 |
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
│   │   │   ├── dashboard/page.tsx   # Overview with stats, chart, budgets, spending breakdown
│   │   │   ├── spending/page.tsx    # Full spending breakdown page
│   │   │   ├── insights/
│   │   │   │   ├── page.tsx             # AI-powered financial insights
│   │   │   │   └── GenerateButton.tsx   # Client component for triggering insight generation
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
│   │   │   ├── accounts/
│   │   │   │   ├── page.tsx         # Account list with net worth
│   │   │   │   └── new/page.tsx     # Create account
│   │   │   └── categories/
│   │   │       ├── page.tsx         # Category list
│   │   │       └── new/page.tsx     # Create category
│   │   ├── onboarding/page.tsx  # 6-step onboarding quiz
│   │   ├── actions/         # Server actions (auth, accounts, transactions, budgets, categories, onboarding)
│   │   ├── api/
│   │   │   ├── accounts/route.ts
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
│   │   │   ├── cron/reset-demo/route.ts # Daily demo data reset (Vercel cron)
│   │   │   ├── insights/
│   │   │   │   ├── route.ts             # GET active insights, POST generate new
│   │   │   │   └── [id]/route.ts        # PATCH dismiss/complete insight
│   │   │   └── transactions/
│   │   │       ├── route.ts         # GET list, POST create
│   │   │       ├── [id]/route.ts    # GET one, PATCH, DELETE
│   │   │       ├── bulk/route.ts    # POST: bulk edit/delete
│   │   │       └── import/
│   │   │           ├── route.ts         # POST: import confirmed transactions
│   │   │           └── preview/route.ts # POST: parse CSV and return column mappings
│   │   ├── globals.css          # Oversikt design tokens + component classes
│   │   ├── layout.tsx           # Root layout (DM Sans, Fraunces, JetBrains Mono fonts)
│   │   └── page.tsx             # Landing page with brand definition
│   ├── components/
│   │   ├── accounts/        # AccountManager (inline edit/delete)
│   │   ├── annual/          # AnnualExpenseCard, AutoFundBanner, FundExpenseModal, LinkTransactionModal, etc.
│   │   ├── brand/           # OversiktMobile (brand showcase component)
│   │   ├── budget-builder/  # AI budget proposal UI (BudgetBuilderCTA, BudgetProposal, ProposalSections)
│   │   ├── budgets/         # Tiered budget sections (Fixed, Flexible, Annual) + TrueRemainingBanner
│   │   ├── categories/      # CategoryManager (inline edit/delete)
│   │   ├── dashboard/       # MonthlyChart, SpendingBreakdown
│   │   ├── forms/           # TransactionForm, BudgetForm, AccountForm, CategoryForm, LoginForm, RegisterForm
│   │   ├── import/          # CsvUploader, ColumnMapper, ImportPreview, ImportSummary
│   │   ├── insights/        # InsightCard, EfficiencyScoreGauge, SpendingComparison, InsightsList, InsightsSkeleton
│   │   ├── onboarding/      # OnboardingWizard, OnboardingBanner
│   │   ├── transactions/    # TransactionList (with bulk select/edit/delete)
│   │   └── ui/              # BudgetCard, FixedBudgetCard, AnnualBudgetCard, ProgressBar, TierSummaryHeader
│   ├── lib/
│   │   ├── ai.ts            # Anthropic SDK client + prompt builder for insights
│   │   ├── benchmarks.ts    # BLS spending benchmark data + efficiency rating
│   │   ├── budget-builder.ts # AI budget proposal generation
│   │   ├── budget-context.ts # Budget context builder for AI prompts
│   │   ├── budget-engine.ts  # Tiered budget calculations (fixed, flexible, annual, true remaining)
│   │   ├── budget-utils.ts   # Budget display helpers
│   │   ├── column-mapping.ts # Smart CSV column name detection for bank imports
│   │   ├── csv-parser.ts    # CSV parsing, date/amount handling, row transformation
│   │   ├── db.ts            # Prisma client singleton (hot-reload safe)
│   │   ├── demo.ts          # Demo mode detection helper
│   │   ├── insight-history.ts # Insight history tracking for AI context
│   │   ├── insights.ts      # Transaction summary builder + insight generation/storage
│   │   ├── jwt.ts           # Edge-safe JWT sign / verify (jose)
│   │   ├── password.ts      # bcrypt hash / verify
│   │   ├── seed-demo.ts     # Demo data generation logic
│   │   ├── session.ts       # Cookie-based session management
│   │   ├── temporal-context.ts # Time-aware context for AI prompts
│   │   └── utils.ts         # formatCurrency, formatDate, budgetProgress, cn
│   └── types/
│       ├── index.ts         # Shared TypeScript types mirroring the Prisma schema
│       └── insights.ts      # Insight, EfficiencyScore, benchmark, and AI response types
├── middleware.ts             # Auth guard — redirects unauthenticated users away from protected routes
├── tests/
│   ├── setup.ts             # Vitest global setup (jest-dom matchers, mock cleanup)
│   ├── actions/             # Server action tests (auth, accounts, transactions, budgets)
│   ├── components/ui/       # Component tests (ProgressBar, BudgetCard)
│   └── lib/                 # Unit tests (utils, jwt, password, benchmarks, insights, csv-parser, column-mapping, budget-engine)
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
 ├── UserProfile?       (onboarding state, financial goals, household info)
 ├── Account[]          (checking, savings, credit, mortgage, auto loan, student loan, …)
 ├── Category[]         (Groceries, Salary, Rent, … — system defaults + user-created)
 ├── Transaction[]      (positive amount = income, negative = expense)
 ├── Budget[]           (amount limit per category, period + tier via BudgetPeriod / BudgetTier enums)
 ├── AnnualExpense[]    (linked to Budget; yearly irregular expenses with funding tracking)
 ├── Insight[]          (AI-generated financial recommendations)
 ├── InsightFeedback[]  (user ratings/comments on insights)
 ├── EfficiencyScore[]  (monthly financial efficiency scores)
 ├── HouseholdMember[]  (partner, dependents from onboarding)
 └── Property[]         (rental/primary/investment properties)

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
- A `Transaction` optionally belongs to an `Account`, one `Category`, and optionally one `AnnualExpense`. Income vs expense is determined by amount sign (positive = income, negative = expense). An optional `transactionType` field stores "debit"/"credit" from Monarch CSV imports. Indexed on `[userId, date]`, `[userId, categoryId]`, `[accountId]`, and `[annualExpenseId]`.
- A `Category` has a `group` (e.g. "Food & Dining", "Housing"), a string `type` ("income" / "expense" / "transfer"), and an optional `budgetTier` (`BudgetTier` enum: FIXED / FLEXIBLE / ANNUAL). Has optional tax fields: `isTaxRelevant` and `scheduleECategory`. System default categories have `userId: null` and `isDefault: true`; user-created categories have `isDefault: false`. Unique on `[userId, type, group, name]`.
- A `Budget` targets one `Category`, has a `period` (`BudgetPeriod` enum), `tier` (`BudgetTier` enum, default FLEXIBLE), and a stored `spent` field. FIXED tier budgets have extra fields: `isAutoPay`, `dueDay`, `varianceLimit`. Has an optional one-to-one `annualExpense` relation.
- An `AnnualExpense` is linked to a `Budget` via `budgetId` (one-to-one) and can have linked `Transaction[]`. Tracks annual costs with `annualAmount`, `dueMonth`/`dueYear`, `monthlySetAside`, `funded`, and `status` ("planned" / "funded" / "spent" / "overspent").
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

- JWT-based sessions stored in an `httpOnly` cookie (`clear-path-session`).
- `src/lib/jwt.ts` handles sign / verify using `jose` (Edge-compatible, no Node.js built-ins).
- `src/lib/session.ts` provides `getSession()`, `setSession()`, `clearSession()` helpers for Server Components and Route Handlers.
- `middleware.ts` guards protected routes (`/dashboard`, `/insights`, `/transactions`, `/budgets`, `/accounts`, `/categories`, `/spending`, `/onboarding`) and redirects unauthenticated users to `/login`.
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

The **amount sign is the single source of truth** for income vs expense:
- **Income**: `amount > 0` (positive)
- **Expense**: `amount < 0` (negative)

All server actions, API routes, and CSV import endpoints **enforce this convention** by looking up the category type and correcting the sign before writing to the database. Never rely on `category.type` relation filters (e.g. `category: { type: 'expense' }`) for income/expense queries — always use `amount: { gt: 0 }` or `amount: { lt: 0 }`.

### Budget Spent Computation

Budget `spent` values are **computed live** from current-month expense transactions grouped by `categoryId`, not read from the stored `budget.spent` field. This prevents drift between the stored value and actual transaction totals. Both the dashboard and budget pages follow this pattern.

### Net Worth Calculation

Net worth subtracts liability account balances. The following account types are treated as liabilities: `CREDIT_CARD`, `MORTGAGE`, `AUTO_LOAN`, `STUDENT_LOAN`. Their balances are subtracted using `Math.abs(balance)`. All other account types (CHECKING, SAVINGS, INVESTMENT, CASH) are summed normally.

### Duplicate Name Validation

- **Accounts**: Case-insensitive duplicate name check using Prisma `mode: 'insensitive'`, enforced in both the server action (`actions/accounts.ts`) and the API route (`api/accounts/route.ts`).
- **Categories**: Case-insensitive duplicate check scoped to `[userId, type, group, name]` using Prisma `mode: 'insensitive'`.

### Account Deletion

When deleting an account, transactions linked to it are **unlinked** (set `accountId: null`) before the account is deleted, using `db.$transaction([…])` to ensure atomicity.

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
