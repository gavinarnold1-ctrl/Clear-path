# Oversikt — Product Requirements Document

*Version 2.4 — February 23, 2026*
*This is the single source of truth. All other docs are reference material.*

-----

## How to use this document

This PRD lives in the repo at `/docs/PRD.md`. It is the authority.

**In this chat (Claude.ai):** Discuss, debate, refine. Decisions get written here.

**In Claude Code:** Every task starts with “Read /docs/PRD.md. Implement Step [N].” Don’t freelance. If ambiguous, stop and ask.

**When something changes:** PRD first, then code. Never the reverse.

-----

## Purpose

Oversikt is a smart financial tool that helps people make better decisions by giving them access to their data and the insights that drive decisions.

It shows what’s true and what it means. The user decides what to do.

-----

## Design Principles

1. **True Remaining over Total Balance.** Lead with the number that answers “what can I spend?” — income minus fixed obligations minus annual set-asides.
1. **What’s true + what it means.** Every screen presents data and context together.
1. **Trajectory over snapshot.** Show whether you’re improving. The Monthly Review is the proof.
1. **Tag everything.** Transactions carry person, property, and category. This is the foundation for household management, tax prep, and meaningful analysis.
1. **The user decides.** Surface facts and patterns, don’t prescribe actions.
1. **Start recording immediately.** Monthly snapshots from day one. Every month without one is lost trajectory data.

-----

## Release Plan

|Release|What it is                |Core question                                                                                     |
|-------|--------------------------|--------------------------------------------------------------------------------------------------|
|**V1** |Complete financial picture|“What’s true about my money, who spent it, what’s it for, what do I owe, and am I getting better?”|
|**V2** |Intelligence + tax        |“How do I optimize, and is my tax picture clean?”                                                 |

-----

## V1 — What we’re shipping

### Definition

A financial tool for households with real-world complexity: multiple people, at least one property, debts, and the need to understand whether their financial life is improving. Connects to banks, tracks budgets across three tiers, and delivers a monthly review that shows progress.

### Pages

**Daily use:**

|Page        |Purpose                                                                        |
|------------|-------------------------------------------------------------------------------|
|Overview    |What’s true right now — True Remaining hero, budget pulse, recent transactions |
|Budgets     |Am I on track — Fixed (paid/missed), Flexible (progress bars), Annual (summary)|
|Spending    |Where did it go — by category, by person, by property                          |
|Annual Plan |Am I prepared — forecast chart, Auto-Fund, set-aside tracking                  |
|Debts       |What I owe — balances, rates, principal vs interest breakdown                  |
|Transactions|The raw ledger — filterable by person, property, category, account             |

**Periodic:**

|Page          |Purpose                                                                              |
|--------------|-------------------------------------------------------------------------------------|
|Monthly Review|Am I getting better — trajectory since you started, AI efficiency score, what changed|

**Setup:**

|Page      |Purpose                                                                  |
|----------|-------------------------------------------------------------------------|
|Settings  |Your profile, household members, properties, connected accounts, security|
|Accounts  |Connected money — Plaid Link, manual accounts, balances                  |
|Categories|How things are organized — edit, merge, delete                           |

### Requirements

#### R1. Accurate data

|ID  |Requirement                                                                                                     |Status|
|----|----------------------------------------------------------------------------------------------------------------|------|
|R1.1|Budget spent computed from transactions on read, never stored                                                   |🔴     |
|R1.2|Fixed expense paid/missed matches transactions by category within month                                         |🔴     |
|R1.3|Amount signs enforced: income categories → positive, expense categories → negative. At API level AND CSV import.|🟢     |
|R1.4|CSV import: if account name in CSV doesn’t match existing account, auto-create it                               |🟢     |
|R1.5|CSV import: link every transaction to its account (no “—” in Account column)                                    |🟢     |
|R1.6|Plaid import flips sign convention                                                                              |⬜     |

#### R2. Bank connectivity

|ID  |Requirement                                      |Status|
|----|-------------------------------------------------|------|
|R2.1|Connect banks via Plaid Link on Accounts page    |⬜     |
|R2.2|Daily transaction sync via Plaid cursor-based API|⬜     |
|R2.3|Account balances refresh from Plaid              |⬜     |
|R2.4|Manual accounts supported alongside Plaid        |🟢     |

#### R3. Household awareness

|ID  |Requirement                           |Status|
|----|--------------------------------------|------|
|R3.1|Create household members (names)      |🟢     |
|R3.2|Tag transactions to a household member|🟢     |
|R3.3|Spending: “By Person” view            |⬜     |
|R3.4|Monthly Review: per-person breakdown  |⬜     |

#### R4. Property separation

|ID  |Requirement                                     |Status|
|----|------------------------------------------------|------|
|R4.1|Create properties (name, type: Personal/Rental) |🟢     |
|R4.2|Tag transactions to a property                  |🟢     |
|R4.3|Spending: “By Property” view                    |⬜     |
|R4.4|Transactions: property filter                   |⬜     |
|R4.5|Filter Rental → all rental expenses for the year|⬜     |

#### R5. Debt visibility

|ID  |Requirement                                           |Status|
|----|------------------------------------------------------|------|
|R5.1|Add debts (name, type, balance, rate, minimum payment)|🟢     |
|R5.2|Debts page: principal vs interest breakdown           |🟢     |
|R5.3|Debts page: total summary (owed, payments, avg rate)  |🟢     |
|R5.4|Debt links to property (mortgage → rental)            |🟢     |
|R5.5|Monthly Review: debt trajectory                       |⬜     |

#### R6. Budget tracking

|ID  |Requirement                                                                                                                             |Status|
|----|----------------------------------------------------------------------------------------------------------------------------------------|------|
|R6.1|Fixed: paid/missed from transaction matching                                                                                            |🔴     |
|R6.2|Flexible: accurate spent/limit with $/day remaining                                                                                     |🔴     |
|R6.3|Annual: funding progress with set-aside calculations                                                                                    |🟢     |
|R6.4|Annual Plan: apply-cash and link-transaction funding                                                                                    |🟢     |
|R6.5|Auto-Fund All distributes True Remaining                                                                                                |🟢     |
|R6.6|True Remaining as primary metric on Overview                                                                                            |🟡     |
|R6.7|Unbudgeted spending surfaced: categories with transactions but no budget shown on Budgets page as “Unbudgeted” section with actual spend|⬜     |

#### R7. Monthly Review

|ID  |Requirement                              |Status|
|----|-----------------------------------------|------|
|R7.1|Monthly snapshots capture key metrics    |⬜     |
|R7.2|“Since you started” trajectory comparison|⬜     |
|R7.3|AI-generated review with efficiency score|🟢     |
|R7.4|Includes person and property breakdowns  |⬜     |
|R7.5|Includes debt paydown progress           |⬜     |
|R7.6|Baseline snapshot on first data import   |⬜     |
|R7.7|Monthly cron on 1st of each month        |⬜     |

#### R8. Information architecture

|ID  |Requirement                                                                                                                |Status|
|----|---------------------------------------------------------------------------------------------------------------------------|------|
|R8.1|Overview leads with True Remaining                                                                                         |🟡     |
|R8.2|Nav: Overview → Budgets → Spending → Annual Plan → Debts → Transactions / Monthly Review / Settings → Accounts → Categories|🟡     |
|R8.3|“Insights” renamed “Monthly Review”                                                                                        |⬜     |
|R8.4|Nav grouped: daily / periodic / setup                                                                                      |⬜     |

#### R9. Brand and deployment

|ID  |Requirement                                     |Status|
|----|------------------------------------------------|------|
|R9.1|Codebase renamed to oversikt                    |🟡     |
|R9.2|Deployed to oversikt.app or oversikt.vercel.app |🔴     |
|R9.3|GitHub repo renamed                             |⬜     |
|R9.4|Landing page: definition + create account + demo|⬜     |
|R9.5|Demo mode with full seed data                   |⬜     |
|R9.6|All pages work at 375px mobile                  |🟡     |

#### R10. Settings

|ID   |Requirement                                                 |Status|
|-----|------------------------------------------------------------|------|
|R10.1|Profile management: edit name, email, change password       |⬜     |
|R10.2|Household members: create, edit, delete (R3.1 UI lives here)|⬜     |
|R10.3|Properties: create, edit, delete (R4.1 UI lives here)       |⬜     |
|R10.4|Connected accounts: view Plaid connections, disconnect      |⬜     |
|R10.5|Data export: download transactions as CSV                   |⬜     |
|R10.6|Delete account: permanent, with confirmation                |⬜     |

#### R11. Security

|ID    |Requirement                                                                           |Status|
|------|--------------------------------------------------------------------------------------|------|
|R11.1 |Passwords hashed with bcrypt, never stored plaintext                                  |🟢     |
|R11.2 |JWT tokens: HttpOnly, Secure, SameSite=Strict cookies. Short expiry (1h) with refresh.|🟡     |
|R11.3 |Rate limiting on auth endpoints (login, register) — prevent brute force               |⬜     |
|R11.4 |Every database query scoped by userId — no cross-user data leakage                    |🟡     |
|R11.5 |Plaid access tokens encrypted at rest (AES-256), never sent to frontend               |⬜     |
|R11.6 |Plaid Link handles bank credentials — Oversikt never sees usernames/passwords         |⬜     |
|R11.7 |AI data minimization: send aggregated/anonymized data to Anthropic, not raw PII       |🟡     |
|R11.8 |No bank account numbers, routing numbers, or Plaid tokens in AI prompts               |⬜     |
|R11.9 |Anthropic API: data not used for model training (API ToS)                             |🟢     |
|R11.10|Environment secrets in Vercel env vars, never in code or git                          |🟡     |
|R11.11|HTTPS everywhere (Vercel default)                                                     |🟢     |
|R11.12|Input validation and SQL injection protection (Prisma parameterized queries)          |🟢     |
|R11.13|CSRF protection on all mutation endpoints                                             |⬜     |
|R11.14|Security page/statement accessible from landing page explaining data practices        |⬜     |

-----

## Implementation Order

23 steps. 5 phases. Each step references requirement IDs.

### Phase 1: Fix the foundation

*Every number on screen is correct.*

|Step|Req      |Do                                                                                                                                                                                      |
|----|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|1   |R1.1     |Remove `Budget.spent`. Compute from transactions on read.                                                                                                                               |
|2   |R1.2     |Fix fixed expense matching — categoryId within month, not exact date.                                                                                                                   |
|3   |R1.3     |Fix sign enforcement: CSV import and API must set positive for income categories, negative for expense. Ledyard Bank “Other Income” currently stored as -$1,583.33 — must be +$1,583.33.|
|4   |R1.4–R1.5|Fix CSV import account handling: look up account by name, auto-create if not found, link every transaction to its account.                                                              |
|5   |R7.3     |Re-test AI insights with corrected data.                                                                                                                                                |

### Phase 2: Complete the data model

*Transactions carry the metadata that makes Oversikt useful.*

|Step|Req      |Do                                                                            |
|----|---------|------------------------------------------------------------------------------|
|6   |R3.1–R3.2|HouseholdMember model + person tag on transactions. Setup UI on Settings page.|
|7   |R4.1–R4.2|Property model + property tag on transactions. Setup UI on Settings page.     |
|8   |R5.1–R5.4|Debt model + Debts page.                                                      |

### Phase 3: Reshape the experience

*True Remaining first, trajectory over time, Settings consolidation.*

|Step|Req                       |Do                                                                                                              |
|----|--------------------------|----------------------------------------------------------------------------------------------------------------|
|9   |R8.1, R6.6                |Overview redesign: True Remaining hero, budget pulse, chart below fold.                                         |
|10  |R8.2–R8.4                 |Reorder nav. Rename Insights → Monthly Review. Add Debts, Settings. Group sections.                             |
|11  |R10.1–R10.6               |Settings page: profile, household members, properties, connected accounts, export, delete account.              |
|12  |R3.3–R3.4, R4.3–R4.5, R6.7|“By Person” + “By Property” on Spending. Property filter on Transactions. Unbudgeted categories on Budgets page.|
|13  |R7.1, R7.6–R7.7           |MonthlySnapshot model + cron. Baseline on first import.                                                         |
|14  |R7.2, R7.4–R7.5, R5.5     |“Since you started” on Monthly Review with debt, person, property.                                              |

### Phase 4: Bank connectivity

*The app stays current automatically.*

|Step|Req       |Do                                |
|----|----------|----------------------------------|
|15  |R2.1, R1.6|Plaid SDK + API routes. Sign flip.|
|16  |R2.1      |Plaid Link on Accounts page.      |
|17  |R2.2–R2.3 |Daily sync cron. Balance refresh. |

### Phase 5: Security, brand, and ship

*Hardened, branded, live.*

|Step|Req         |Do                                           |
|----|------------|---------------------------------------------|
|18  |R11.1–R11.14|Security hardening (see security spec below).|
|19  |R9.1        |Rebrand codebase.                            |
|20  |R9.2–R9.3   |Domain + rename repo.                        |
|21  |R9.4–R9.5   |Landing page + demo mode.                    |
|22  |R9.6        |Mobile responsive audit at 375px.            |
|23  |—           |Final verification. Ship.                    |

-----

## V2 — What comes after

V2 adds intelligence and tax. “Shows you what’s true” becomes “helps you optimize.”

|ID  |Scope                                                          |
|----|---------------------------------------------------------------|
|V2.1|Tax system — Schedule E, IRS crosswalk, deduction strategies   |
|V2.2|Spending benchmarks — BLS data comparisons                     |
|V2.3|Debt payoff modeling — avalanche/snowball, what-if scenarios   |
|V2.4|Multi-user household — separate logins, permissions, settlement|
|V2.5|Contextual AI on every page — inline observations, cached daily|
|V2.6|Share/export Monthly Review                                    |
|V2.7|Smart auto-tagging — AI suggests person/property from patterns |
|V2.8|Onboarding wizard                                              |
|V2.9|Depreciation tracking for rental improvements                  |

-----

## Security Spec (Step 18)

Step 17 is a dedicated security hardening pass. Claude Code addresses each R11 requirement:

### Authentication (R11.1–R11.3)

```
R11.1 — Already done: bcrypt password hashing. Verify: no plaintext passwords
        anywhere in codebase (grep for password storage patterns).

R11.2 — JWT hardening:
  - Tokens set as HttpOnly cookies (not localStorage)
  - Secure flag = true (HTTPS only)
  - SameSite = Strict (no cross-site requests)
  - Token expiry: 1 hour access token, 7 day refresh token
  - Refresh token rotation: issue new refresh token on each use, invalidate old one
  - If currently using localStorage for JWT, migrate to HttpOnly cookies

R11.3 — Rate limiting on auth endpoints:
  - /api/auth/login: max 5 attempts per IP per 15 minutes
  - /api/auth/register: max 3 per IP per hour
  - Implementation: use Vercel Edge Middleware or upstash/ratelimit
  - Return 429 Too Many Requests with Retry-After header
```

### Data isolation (R11.4)

```
Audit every API route and Prisma query:
  - Every SELECT, UPDATE, DELETE must include WHERE userId = currentUser.id
  - No endpoint accepts a userId parameter from the client (derive from JWT)
  - Test: create two users, verify User A cannot access User B's
    transactions, budgets, debts, household members, or properties
  - Prisma middleware option: add a global filter that enforces userId scoping
```

### Plaid security (R11.5–R11.6)

```
R11.5 — Encrypt Plaid access tokens at rest:
  - Use AES-256-GCM encryption before storing in database
  - Encryption key stored in PLAID_ENCRYPTION_KEY env var (not in code)
  - Decrypt only server-side when making Plaid API calls
  - access_token, item_id never appear in API responses to frontend

R11.6 — Plaid Link architecture (inherent):
  - Bank credentials are entered in Plaid's hosted UI (Link)
  - Oversikt receives a public_token → exchanges for access_token server-side
  - Oversikt never sees, stores, or transmits bank usernames or passwords
  - Document this in the security page for users
```

### AI data handling (R11.7–R11.9)

```
R11.7 — Data minimization in AI prompts:
  Audit the Anthropic API call in the insights/review generation.
  The prompt should send:
    ✅ Aggregated spending by category (e.g., "Groceries: $211.48")
    ✅ Budget limits and utilization percentages
    ✅ Monthly totals (income, expenses, savings rate)
    ✅ Debt summary (total balance, avg rate — no account numbers)
    ✅ Person names (first name only, user-created)
    ✅ Property names and types
  The prompt must NOT send:
    ❌ Bank account numbers or routing numbers
    ❌ Plaid access tokens
    ❌ Full merchant names with location details (use category only where possible)
    ❌ Email addresses or full names from auth
    ❌ Transaction IDs or internal database IDs

R11.8 — Verify: grep AI prompt construction code. Confirm no Plaid tokens,
         account numbers, or sensitive identifiers in the prompt string.

R11.9 — Anthropic API data policy: API inputs/outputs are not used for
         model training. Document this on the security page.
         Reference: https://www.anthropic.com/policies/privacy
```

### Infrastructure (R11.10–R11.13)

```
R11.10 — Environment variables audit:
  - Verify .env is in .gitignore
  - Verify no secrets hardcoded in source files:
    grep -r "sk-ant\|sk_live\|access-development\|PLAID_SECRET" src/
  - All secrets in Vercel Environment Variables dashboard
  - .env.example lists required vars with placeholder values (no real secrets)

R11.11 — HTTPS: Vercel enforces by default. Verify no http:// URLs in code.

R11.12 — Input validation:
  - Prisma parameterized queries prevent SQL injection (inherent)
  - Verify: API routes validate input types (amounts are numbers, dates are dates)
  - Verify: no raw SQL queries (prisma.$queryRaw) without parameterization

R11.13 — CSRF protection:
  - If using HttpOnly cookies for auth: add CSRF token to mutation requests
  - Or: verify SameSite=Strict cookie prevents cross-origin requests
  - Next.js API routes with SameSite=Strict cookies are generally CSRF-safe
```

### Security page (R11.14)

```
Create /security (or /about/security) — a public page accessible from the
landing page footer. Content:

"How Oversikt protects your data"

1. Your bank credentials
   Oversikt never sees your bank username or password. We use Plaid, a
   trusted financial data platform used by thousands of apps, to connect
   to your bank. Your credentials are entered directly in Plaid's secure
   interface.

2. Your financial data
   - All data encrypted in transit (HTTPS/TLS)
   - Database encrypted at rest (provided by hosting infrastructure)
   - Each user's data is isolated — no one can see another user's information

3. AI-powered insights
   When generating your Monthly Review, we send aggregated spending
   summaries (like "Groceries: $211") to our AI provider (Anthropic).
   We never send bank account numbers, login credentials, or other
   sensitive identifiers. Anthropic does not use API data to train their
   models.

4. What we don't do
   - We don't sell your data
   - We don't share individual financial data with third parties
   - We don't store your bank login credentials
   - We don't display ads

5. Account control
   You can disconnect bank accounts, export your data, or delete your
   account entirely from Settings at any time.
```

-----

## Working with Claude Code

### Starting a task

```
Read /docs/PRD.md. Implement Step [N], requirements [R-IDs].
```

### Rules

1. Read the PRD first. Every time.
1. Implement what’s specified. Nothing outside current step.
1. Ambiguous? Stop and ask.
1. Conflict? Flag it.
1. When done: files changed, schema changes, open questions.
1. Don’t touch other steps.
1. **Run `npm run build` after every file change.** Fix all type errors and build failures before moving to the next file or reporting the step as done. Never commit or deploy code that doesn’t compile.
1. **Run `npx tsc --noEmit` before `npm run build`** to catch type errors early without a full build cycle.
1. **When editing a file, read the full file first.** Don’t assume variable locations or declaration order. Check where variables are declared before referencing them.

### After a session

1. `npm run build` passes with zero errors — **non-negotiable**.
1. Update PRD status columns.
1. Commit.
1. Next step.

-----

## Schema Reference

### MonthlySnapshot (Step 13)

```prisma
model MonthlySnapshot {
  id                String   @id @default(cuid())
  userId            String
  month             DateTime
  trueRemaining     Float
  totalIncome       Float
  totalExpenses     Float
  savingsRate       Float
  netSurplus        Float
  annualFundedPct   Float
  budgetsOnTrack    Int
  budgetsTotal      Int
  fixedPaid         Int
  fixedTotal        Int
  flexOverBudget    Int
  transactionCount  Int
  avgDailySpend     Float
  totalDebt         Float?
  totalDebtPayments Float?
  debtPaidDown      Float?
  personBreakdown   String?
  propertyBreakdown String?
  reviewHeadline    String?
  reviewBody        String?
  efficiencyScore   Int?
  spendingScore     Int?
  savingsScore      Int?
  debtScore         Int?
  createdAt         DateTime @default(now())
  user              User     @relation(fields: [userId], references: [id])
  @@unique([userId, month])
  @@index([userId])
}
```

### HouseholdMember (Step 6)

```prisma
model HouseholdMember {
  id           String        @id @default(cuid())
  userId       String
  name         String
  isDefault    Boolean       @default(false)
  createdAt    DateTime      @default(now())
  user         User          @relation(fields: [userId], references: [id])
  transactions Transaction[]
  @@index([userId])
}
```

### Property (Step 7)

```prisma
model Property {
  id           String        @id @default(cuid())
  userId       String
  name         String
  type         PropertyType
  isDefault    Boolean       @default(false)
  createdAt    DateTime      @default(now())
  user         User          @relation(fields: [userId], references: [id])
  transactions Transaction[]
  debts        Debt[]
  @@index([userId])
}
enum PropertyType { PERSONAL RENTAL }
```

### Debt (Step 8)

```prisma
model Debt {
  id              String    @id @default(cuid())
  userId          String
  name            String
  type            DebtType
  currentBalance  Float
  originalBalance Float?
  interestRate    Float
  minimumPayment  Float
  paymentDay      Int?
  termMonths      Int?
  startDate       DateTime?
  propertyId      String?
  property        Property? @relation(fields: [propertyId], references: [id])
  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  user            User      @relation(fields: [userId], references: [id])
  @@index([userId])
}
enum DebtType { MORTGAGE STUDENT_LOAN AUTO CREDIT_CARD PERSONAL_LOAN OTHER }
```

-----

## Changelog

|Date      |Version|Change                                                                                                                                                                            |
|----------|-------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|2026-02-23|1.0    |Initial PRD. 24 steps, V1/V1.1/V2 split.                                                                                                                                          |
|2026-02-23|2.0    |Simplified. Two releases: V1 and V2. Household, property, debts in V1. 20 steps, 5 phases.                                                                                        |
|2026-02-23|2.1    |Added R10 (Settings), R11 (Security). Security spec with AI data handling, Plaid encryption, auth hardening. 22 steps.                                                            |
|2026-02-23|2.2    |Fixed R1: income sign bug (Ledyard Bank -$1,583 should be +$1,583), CSV import must auto-create accounts. R1 now has 6 sub-requirements. 23 steps.                                |
|2026-02-23|2.2    |Status update: Phase 1 ✅, Phase 2 ✅, Phase 3 🟡 in progress. R1–R5, R6.1–R6.2 all green.                                                                                           |
|2026-02-23|2.3    |Reverted R1.1, R1.2, R6.1, R6.2 to 🔴 — screenshot confirms Budget.spent still $0 and Fixed expenses still MISSED. Added R6.7: surface unbudgeted categories. Phase 1 NOT complete.|
|2026-02-23|2.4    |Added Claude Code rules 7-9: mandatory build check after every file change, tsc type-check, read full file before editing.                                                        | # Oversikt — Product Requirements Document

*Version 2.4 — February 23, 2026*
*This is the single source of truth. All other docs are reference material.*

-----

## How to use this document

This PRD lives in the repo at `/docs/PRD.md`. It is the authority.

**In this chat (Claude.ai):** Discuss, debate, refine. Decisions get written here.

**In Claude Code:** Every task starts with “Read /docs/PRD.md. Implement Step [N].” Don’t freelance. If ambiguous, stop and ask.

**When something changes:** PRD first, then code. Never the reverse.

-----

## Purpose

Oversikt is a smart financial tool that helps people make better decisions by giving them access to their data and the insights that drive decisions.

It shows what’s true and what it means. The user decides what to do.

-----

## Design Principles

1. **True Remaining over Total Balance.** Lead with the number that answers “what can I spend?” — income minus fixed obligations minus annual set-asides.
1. **What’s true + what it means.** Every screen presents data and context together.
1. **Trajectory over snapshot.** Show whether you’re improving. The Monthly Review is the proof.
1. **Tag everything.** Transactions carry person, property, and category. This is the foundation for household management, tax prep, and meaningful analysis.
1. **The user decides.** Surface facts and patterns, don’t prescribe actions.
1. **Start recording immediately.** Monthly snapshots from day one. Every month without one is lost trajectory data.

-----

## Release Plan

|Release|What it is                |Core question                                                                                     |
|-------|--------------------------|--------------------------------------------------------------------------------------------------|
|**V1** |Complete financial picture|“What’s true about my money, who spent it, what’s it for, what do I owe, and am I getting better?”|
|**V2** |Intelligence + tax        |“How do I optimize, and is my tax picture clean?”                                                 |

-----

## V1 — What we’re shipping

### Definition

A financial tool for households with real-world complexity: multiple people, at least one property, debts, and the need to understand whether their financial life is improving. Connects to banks, tracks budgets across three tiers, and delivers a monthly review that shows progress.

### Pages

**Daily use:**

|Page        |Purpose                                                                        |
|------------|-------------------------------------------------------------------------------|
|Overview    |What’s true right now — True Remaining hero, budget pulse, recent transactions |
|Budgets     |Am I on track — Fixed (paid/missed), Flexible (progress bars), Annual (summary)|
|Spending    |Where did it go — by category, by person, by property                          |
|Annual Plan |Am I prepared — forecast chart, Auto-Fund, set-aside tracking                  |
|Debts       |What I owe — balances, rates, principal vs interest breakdown                  |
|Transactions|The raw ledger — filterable by person, property, category, account             |

**Periodic:**

|Page          |Purpose                                                                              |
|--------------|-------------------------------------------------------------------------------------|
|Monthly Review|Am I getting better — trajectory since you started, AI efficiency score, what changed|

**Setup:**

|Page      |Purpose                                                                  |
|----------|-------------------------------------------------------------------------|
|Settings  |Your profile, household members, properties, connected accounts, security|
|Accounts  |Connected money — Plaid Link, manual accounts, balances                  |
|Categories|How things are organized — edit, merge, delete                           |

### Requirements

#### R1. Accurate data

|ID  |Requirement                                                                                                     |Status|
|----|----------------------------------------------------------------------------------------------------------------|------|
|R1.1|Budget spent computed from transactions on read, never stored                                                   |🔴     |
|R1.2|Fixed expense paid/missed matches transactions by category within month                                         |🔴     |
|R1.3|Amount signs enforced: income categories → positive, expense categories → negative. At API level AND CSV import.|🟢     |
|R1.4|CSV import: if account name in CSV doesn’t match existing account, auto-create it                               |🟢     |
|R1.5|CSV import: link every transaction to its account (no “—” in Account column)                                    |🟢     |
|R1.6|Plaid import flips sign convention                                                                              |⬜     |

#### R2. Bank connectivity

|ID  |Requirement                                      |Status|
|----|-------------------------------------------------|------|
|R2.1|Connect banks via Plaid Link on Accounts page    |⬜     |
|R2.2|Daily transaction sync via Plaid cursor-based API|⬜     |
|R2.3|Account balances refresh from Plaid              |⬜     |
|R2.4|Manual accounts supported alongside Plaid        |🟢     |

#### R3. Household awareness

|ID  |Requirement                           |Status|
|----|--------------------------------------|------|
|R3.1|Create household members (names)      |🟢     |
|R3.2|Tag transactions to a household member|🟢     |
|R3.3|Spending: “By Person” view            |⬜     |
|R3.4|Monthly Review: per-person breakdown  |⬜     |

#### R4. Property separation

|ID  |Requirement                                     |Status|
|----|------------------------------------------------|------|
|R4.1|Create properties (name, type: Personal/Rental) |🟢     |
|R4.2|Tag transactions to a property                  |🟢     |
|R4.3|Spending: “By Property” view                    |⬜     |
|R4.4|Transactions: property filter                   |⬜     |
|R4.5|Filter Rental → all rental expenses for the year|⬜     |

#### R5. Debt visibility

|ID  |Requirement                                           |Status|
|----|------------------------------------------------------|------|
|R5.1|Add debts (name, type, balance, rate, minimum payment)|🟢     |
|R5.2|Debts page: principal vs interest breakdown           |🟢     |
|R5.3|Debts page: total summary (owed, payments, avg rate)  |🟢     |
|R5.4|Debt links to property (mortgage → rental)            |🟢     |
|R5.5|Monthly Review: debt trajectory                       |⬜     |

#### R6. Budget tracking

|ID  |Requirement                                                                                                                             |Status|
|----|----------------------------------------------------------------------------------------------------------------------------------------|------|
|R6.1|Fixed: paid/missed from transaction matching                                                                                            |🔴     |
|R6.2|Flexible: accurate spent/limit with $/day remaining                                                                                     |🔴     |
|R6.3|Annual: funding progress with set-aside calculations                                                                                    |🟢     |
|R6.4|Annual Plan: apply-cash and link-transaction funding                                                                                    |🟢     |
|R6.5|Auto-Fund All distributes True Remaining                                                                                                |🟢     |
|R6.6|True Remaining as primary metric on Overview                                                                                            |🟡     |
|R6.7|Unbudgeted spending surfaced: categories with transactions but no budget shown on Budgets page as “Unbudgeted” section with actual spend|⬜     |

#### R7. Monthly Review

|ID  |Requirement                              |Status|
|----|-----------------------------------------|------|
|R7.1|Monthly snapshots capture key metrics    |⬜     |
|R7.2|“Since you started” trajectory comparison|⬜     |
|R7.3|AI-generated review with efficiency score|🟢     |
|R7.4|Includes person and property breakdowns  |⬜     |
|R7.5|Includes debt paydown progress           |⬜     |
|R7.6|Baseline snapshot on first data import   |⬜     |
|R7.7|Monthly cron on 1st of each month        |⬜     |

#### R8. Information architecture

|ID  |Requirement                                                                                                                |Status|
|----|---------------------------------------------------------------------------------------------------------------------------|------|
|R8.1|Overview leads with True Remaining                                                                                         |🟡     |
|R8.2|Nav: Overview → Budgets → Spending → Annual Plan → Debts → Transactions / Monthly Review / Settings → Accounts → Categories|🟡     |
|R8.3|“Insights” renamed “Monthly Review”                                                                                        |⬜     |
|R8.4|Nav grouped: daily / periodic / setup                                                                                      |⬜     |

#### R9. Brand and deployment

|ID  |Requirement                                     |Status|
|----|------------------------------------------------|------|
|R9.1|Codebase renamed to oversikt                    |🟡     |
|R9.2|Deployed to oversikt.app or oversikt.vercel.app |🔴     |
|R9.3|GitHub repo renamed                             |⬜     |
|R9.4|Landing page: definition + create account + demo|⬜     |
|R9.5|Demo mode with full seed data                   |⬜     |
|R9.6|All pages work at 375px mobile                  |🟡     |

#### R10. Settings

|ID   |Requirement                                                 |Status|
|-----|------------------------------------------------------------|------|
|R10.1|Profile management: edit name, email, change password       |⬜     |
|R10.2|Household members: create, edit, delete (R3.1 UI lives here)|⬜     |
|R10.3|Properties: create, edit, delete (R4.1 UI lives here)       |⬜     |
|R10.4|Connected accounts: view Plaid connections, disconnect      |⬜     |
|R10.5|Data export: download transactions as CSV                   |⬜     |
|R10.6|Delete account: permanent, with confirmation                |⬜     |

#### R11. Security

|ID    |Requirement                                                                           |Status|
|------|--------------------------------------------------------------------------------------|------|
|R11.1 |Passwords hashed with bcrypt, never stored plaintext                                  |🟢     |
|R11.2 |JWT tokens: HttpOnly, Secure, SameSite=Strict cookies. Short expiry (1h) with refresh.|🟡     |
|R11.3 |Rate limiting on auth endpoints (login, register) — prevent brute force               |⬜     |
|R11.4 |Every database query scoped by userId — no cross-user data leakage                    |🟡     |
|R11.5 |Plaid access tokens encrypted at rest (AES-256), never sent to frontend               |⬜     |
|R11.6 |Plaid Link handles bank credentials — Oversikt never sees usernames/passwords         |⬜     |
|R11.7 |AI data minimization: send aggregated/anonymized data to Anthropic, not raw PII       |🟡     |
|R11.8 |No bank account numbers, routing numbers, or Plaid tokens in AI prompts               |⬜     |
|R11.9 |Anthropic API: data not used for model training (API ToS)                             |🟢     |
|R11.10|Environment secrets in Vercel env vars, never in code or git                          |🟡     |
|R11.11|HTTPS everywhere (Vercel default)                                                     |🟢     |
|R11.12|Input validation and SQL injection protection (Prisma parameterized queries)          |🟢     |
|R11.13|CSRF protection on all mutation endpoints                                             |⬜     |
|R11.14|Security page/statement accessible from landing page explaining data practices        |⬜     |

-----

## Implementation Order

23 steps. 5 phases. Each step references requirement IDs.

### Phase 1: Fix the foundation

*Every number on screen is correct.*

|Step|Req      |Do                                                                                                                                                                                      |
|----|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|1   |R1.1     |Remove `Budget.spent`. Compute from transactions on read.                                                                                                                               |
|2   |R1.2     |Fix fixed expense matching — categoryId within month, not exact date.                                                                                                                   |
|3   |R1.3     |Fix sign enforcement: CSV import and API must set positive for income categories, negative for expense. Ledyard Bank “Other Income” currently stored as -$1,583.33 — must be +$1,583.33.|
|4   |R1.4–R1.5|Fix CSV import account handling: look up account by name, auto-create if not found, link every transaction to its account.                                                              |
|5   |R7.3     |Re-test AI insights with corrected data.                                                                                                                                                |

### Phase 2: Complete the data model

*Transactions carry the metadata that makes Oversikt useful.*

|Step|Req      |Do                                                                            |
|----|---------|------------------------------------------------------------------------------|
|6   |R3.1–R3.2|HouseholdMember model + person tag on transactions. Setup UI on Settings page.|
|7   |R4.1–R4.2|Property model + property tag on transactions. Setup UI on Settings page.     |
|8   |R5.1–R5.4|Debt model + Debts page.                                                      |

### Phase 3: Reshape the experience

*True Remaining first, trajectory over time, Settings consolidation.*

|Step|Req                       |Do                                                                                                              |
|----|--------------------------|----------------------------------------------------------------------------------------------------------------|
|9   |R8.1, R6.6                |Overview redesign: True Remaining hero, budget pulse, chart below fold.                                         |
|10  |R8.2–R8.4                 |Reorder nav. Rename Insights → Monthly Review. Add Debts, Settings. Group sections.                             |
|11  |R10.1–R10.6               |Settings page: profile, household members, properties, connected accounts, export, delete account.              |
|12  |R3.3–R3.4, R4.3–R4.5, R6.7|“By Person” + “By Property” on Spending. Property filter on Transactions. Unbudgeted categories on Budgets page.|
|13  |R7.1, R7.6–R7.7           |MonthlySnapshot model + cron. Baseline on first import.                                                         |
|14  |R7.2, R7.4–R7.5, R5.5     |“Since you started” on Monthly Review with debt, person, property.                                              |

### Phase 4: Bank connectivity

*The app stays current automatically.*

|Step|Req       |Do                                |
|----|----------|----------------------------------|
|15  |R2.1, R1.6|Plaid SDK + API routes. Sign flip.|
|16  |R2.1      |Plaid Link on Accounts page.      |
|17  |R2.2–R2.3 |Daily sync cron. Balance refresh. |

### Phase 5: Security, brand, and ship

*Hardened, branded, live.*

|Step|Req         |Do                                           |
|----|------------|---------------------------------------------|
|18  |R11.1–R11.14|Security hardening (see security spec below).|
|19  |R9.1        |Rebrand codebase.                            |
|20  |R9.2–R9.3   |Domain + rename repo.                        |
|21  |R9.4–R9.5   |Landing page + demo mode.                    |
|22  |R9.6        |Mobile responsive audit at 375px.            |
|23  |—           |Final verification. Ship.                    |

-----

## V2 — What comes after

V2 adds intelligence and tax. “Shows you what’s true” becomes “helps you optimize.”

|ID  |Scope                                                          |
|----|---------------------------------------------------------------|
|V2.1|Tax system — Schedule E, IRS crosswalk, deduction strategies   |
|V2.2|Spending benchmarks — BLS data comparisons                     |
|V2.3|Debt payoff modeling — avalanche/snowball, what-if scenarios   |
|V2.4|Multi-user household — separate logins, permissions, settlement|
|V2.5|Contextual AI on every page — inline observations, cached daily|
|V2.6|Share/export Monthly Review                                    |
|V2.7|Smart auto-tagging — AI suggests person/property from patterns |
|V2.8|Onboarding wizard                                              |
|V2.9|Depreciation tracking for rental improvements                  |

-----

## Security Spec (Step 18)

Step 17 is a dedicated security hardening pass. Claude Code addresses each R11 requirement:

### Authentication (R11.1–R11.3)

```
R11.1 — Already done: bcrypt password hashing. Verify: no plaintext passwords
        anywhere in codebase (grep for password storage patterns).

R11.2 — JWT hardening:
  - Tokens set as HttpOnly cookies (not localStorage)
  - Secure flag = true (HTTPS only)
  - SameSite = Strict (no cross-site requests)
  - Token expiry: 1 hour access token, 7 day refresh token
  - Refresh token rotation: issue new refresh token on each use, invalidate old one
  - If currently using localStorage for JWT, migrate to HttpOnly cookies

R11.3 — Rate limiting on auth endpoints:
  - /api/auth/login: max 5 attempts per IP per 15 minutes
  - /api/auth/register: max 3 per IP per hour
  - Implementation: use Vercel Edge Middleware or upstash/ratelimit
  - Return 429 Too Many Requests with Retry-After header
```

### Data isolation (R11.4)

```
Audit every API route and Prisma query:
  - Every SELECT, UPDATE, DELETE must include WHERE userId = currentUser.id
  - No endpoint accepts a userId parameter from the client (derive from JWT)
  - Test: create two users, verify User A cannot access User B's
    transactions, budgets, debts, household members, or properties
  - Prisma middleware option: add a global filter that enforces userId scoping
```

### Plaid security (R11.5–R11.6)

```
R11.5 — Encrypt Plaid access tokens at rest:
  - Use AES-256-GCM encryption before storing in database
  - Encryption key stored in PLAID_ENCRYPTION_KEY env var (not in code)
  - Decrypt only server-side when making Plaid API calls
  - access_token, item_id never appear in API responses to frontend

R11.6 — Plaid Link architecture (inherent):
  - Bank credentials are entered in Plaid's hosted UI (Link)
  - Oversikt receives a public_token → exchanges for access_token server-side
  - Oversikt never sees, stores, or transmits bank usernames or passwords
  - Document this in the security page for users
```

### AI data handling (R11.7–R11.9)

```
R11.7 — Data minimization in AI prompts:
  Audit the Anthropic API call in the insights/review generation.
  The prompt should send:
    ✅ Aggregated spending by category (e.g., "Groceries: $211.48")
    ✅ Budget limits and utilization percentages
    ✅ Monthly totals (income, expenses, savings rate)
    ✅ Debt summary (total balance, avg rate — no account numbers)
    ✅ Person names (first name only, user-created)
    ✅ Property names and types
  The prompt must NOT send:
    ❌ Bank account numbers or routing numbers
    ❌ Plaid access tokens
    ❌ Full merchant names with location details (use category only where possible)
    ❌ Email addresses or full names from auth
    ❌ Transaction IDs or internal database IDs

R11.8 — Verify: grep AI prompt construction code. Confirm no Plaid tokens,
         account numbers, or sensitive identifiers in the prompt string.

R11.9 — Anthropic API data policy: API inputs/outputs are not used for
         model training. Document this on the security page.
         Reference: https://www.anthropic.com/policies/privacy
```

### Infrastructure (R11.10–R11.13)

```
R11.10 — Environment variables audit:
  - Verify .env is in .gitignore
  - Verify no secrets hardcoded in source files:
    grep -r "sk-ant\|sk_live\|access-development\|PLAID_SECRET" src/
  - All secrets in Vercel Environment Variables dashboard
  - .env.example lists required vars with placeholder values (no real secrets)

R11.11 — HTTPS: Vercel enforces by default. Verify no http:// URLs in code.

R11.12 — Input validation:
  - Prisma parameterized queries prevent SQL injection (inherent)
  - Verify: API routes validate input types (amounts are numbers, dates are dates)
  - Verify: no raw SQL queries (prisma.$queryRaw) without parameterization

R11.13 — CSRF protection:
  - If using HttpOnly cookies for auth: add CSRF token to mutation requests
  - Or: verify SameSite=Strict cookie prevents cross-origin requests
  - Next.js API routes with SameSite=Strict cookies are generally CSRF-safe
```

### Security page (R11.14)

```
Create /security (or /about/security) — a public page accessible from the
landing page footer. Content:

"How Oversikt protects your data"

1. Your bank credentials
   Oversikt never sees your bank username or password. We use Plaid, a
   trusted financial data platform used by thousands of apps, to connect
   to your bank. Your credentials are entered directly in Plaid's secure
   interface.

2. Your financial data
   - All data encrypted in transit (HTTPS/TLS)
   - Database encrypted at rest (provided by hosting infrastructure)
   - Each user's data is isolated — no one can see another user's information

3. AI-powered insights
   When generating your Monthly Review, we send aggregated spending
   summaries (like "Groceries: $211") to our AI provider (Anthropic).
   We never send bank account numbers, login credentials, or other
   sensitive identifiers. Anthropic does not use API data to train their
   models.

4. What we don't do
   - We don't sell your data
   - We don't share individual financial data with third parties
   - We don't store your bank login credentials
   - We don't display ads

5. Account control
   You can disconnect bank accounts, export your data, or delete your
   account entirely from Settings at any time.
```

-----

## Working with Claude Code

### Starting a task

```
Read /docs/PRD.md. Implement Step [N], requirements [R-IDs].
```

### Rules

1. Read the PRD first. Every time.
1. Implement what’s specified. Nothing outside current step.
1. Ambiguous? Stop and ask.
1. Conflict? Flag it.
1. When done: files changed, schema changes, open questions.
1. Don’t touch other steps.
1. **Run `npm run build` after every file change.** Fix all type errors and build failures before moving to the next file or reporting the step as done. Never commit or deploy code that doesn’t compile.
1. **Run `npx tsc --noEmit` before `npm run build`** to catch type errors early without a full build cycle.
1. **When editing a file, read the full file first.** Don’t assume variable locations or declaration order. Check where variables are declared before referencing them.

### After a session

1. `npm run build` passes with zero errors — **non-negotiable**.
1. Update PRD status columns.
1. Commit.
1. Next step.

-----

## Schema Reference

### MonthlySnapshot (Step 13)

```prisma
model MonthlySnapshot {
  id                String   @id @default(cuid())
  userId            String
  month             DateTime
  trueRemaining     Float
  totalIncome       Float
  totalExpenses     Float
  savingsRate       Float
  netSurplus        Float
  annualFundedPct   Float
  budgetsOnTrack    Int
  budgetsTotal      Int
  fixedPaid         Int
  fixedTotal        Int
  flexOverBudget    Int
  transactionCount  Int
  avgDailySpend     Float
  totalDebt         Float?
  totalDebtPayments Float?
  debtPaidDown      Float?
  personBreakdown   String?
  propertyBreakdown String?
  reviewHeadline    String?
  reviewBody        String?
  efficiencyScore   Int?
  spendingScore     Int?
  savingsScore      Int?
  debtScore         Int?
  createdAt         DateTime @default(now())
  user              User     @relation(fields: [userId], references: [id])
  @@unique([userId, month])
  @@index([userId])
}
```

### HouseholdMember (Step 6)

```prisma
model HouseholdMember {
  id           String        @id @default(cuid())
  userId       String
  name         String
  isDefault    Boolean       @default(false)
  createdAt    DateTime      @default(now())
  user         User          @relation(fields: [userId], references: [id])
  transactions Transaction[]
  @@index([userId])
}
```

### Property (Step 7)

```prisma
model Property {
  id           String        @id @default(cuid())
  userId       String
  name         String
  type         PropertyType
  isDefault    Boolean       @default(false)
  createdAt    DateTime      @default(now())
  user         User          @relation(fields: [userId], references: [id])
  transactions Transaction[]
  debts        Debt[]
  @@index([userId])
}
enum PropertyType { PERSONAL RENTAL }
```

### Debt (Step 8)

```prisma
model Debt {
  id              String    @id @default(cuid())
  userId          String
  name            String
  type            DebtType
  currentBalance  Float
  originalBalance Float?
  interestRate    Float
  minimumPayment  Float
  paymentDay      Int?
  termMonths      Int?
  startDate       DateTime?
  propertyId      String?
  property        Property? @relation(fields: [propertyId], references: [id])
  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  user            User      @relation(fields: [userId], references: [id])
  @@index([userId])
}
enum DebtType { MORTGAGE STUDENT_LOAN AUTO CREDIT_CARD PERSONAL_LOAN OTHER }
```

-----

## Changelog

|Date      |Version|Change                                                                                                                                                                            |
|----------|-------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|2026-02-23|1.0    |Initial PRD. 24 steps, V1/V1.1/V2 split.                                                                                                                                          |
|2026-02-23|2.0    |Simplified. Two releases: V1 and V2. Household, property, debts in V1. 20 steps, 5 phases.                                                                                        |
|2026-02-23|2.1    |Added R10 (Settings), R11 (Security). Security spec with AI data handling, Plaid encryption, auth hardening. 22 steps.                                                            |
|2026-02-23|2.2    |Fixed R1: income sign bug (Ledyard Bank -$1,583 should be +$1,583), CSV import must auto-create accounts. R1 now has 6 sub-requirements. 23 steps.                                |
|2026-02-23|2.2    |Status update: Phase 1 ✅, Phase 2 ✅, Phase 3 🟡 in progress. R1–R5, R6.1–R6.2 all green.                                                                                           |
|2026-02-23|2.3    |Reverted R1.1, R1.2, R6.1, R6.2 to 🔴 — screenshot confirms Budget.spent still $0 and Fixed expenses still MISSED. Added R6.7: surface unbudgeted categories. Phase 1 NOT complete.|
|2026-02-23|2.4    |Added Claude Code rules 7-9: mandatory build check after every file change, tsc type-check, read full file before editing.                                                        |
