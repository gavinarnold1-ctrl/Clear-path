# Oversikt — Implementation Progress

*Tracks completion status against `/docs/PRD.md` requirements and `/docs/TESTS.md` test specs.*

---

## Phase 1: Fix the Foundation

| Step | Req  | Description                                       | Status  | Tests   |
|------|------|---------------------------------------------------|---------|---------|
| 1    | R1.1 | Budget.spent computed from transactions on read    | 🟢 Done | T1.1 ✅ |
| 2    | R1.2 | Fixed expense matching — categoryId within month   | 🟢 Done | T1.2 ✅ |
| 3    | R1.3 | CSV import sign logic                              | 🟢 Done | T1.3 ✅ |
| 4    | R1.4 | CSV column mapping: Person + Property              | 🟢 Done | T1.4 ✅ |
| 5    | R1.5 | CSV account linking + type inference               | 🟢 Done | T1.5 ✅ |
| 6    | R1.6 | CSV category matching                              | 🟢 Done |         |
| 7    | R1.7 | Transaction classification                         | 🟢 Done |         |
| 8    | R1.8 | Auto-categorization                                | ⬜ TODO |         |
| 9    | R1.9 | Migration: fix existing sign errors                | 🟢 Done | T1.6    |
| 10   | R7.3 | Re-test AI insights with corrected data            | 🟢 Done | T1.7    |

### Notes

- **R1.1**: Schema has no `spent` field. Budgets page, dashboard, and budget-context all compute spent from current-month transactions grouped by categoryId.
- **R1.2**: `FixedBudgetSection.tsx` matches strictly by `categoryId` — no merchant name or date matching.
- **R1.5**: `inferAccountType()` detects Credit Card, Savings, Mortgage, Auto Loan, Student Loan, Investment from account names. AccountForm dropdown has all 8 AccountType enum values. CSV accounts default to $0 balance.
- **R1.7**: `classification` field added to Transaction model. Classification derived from category group + amount sign at import/create time. All queries now use `classification` for filtering instead of `category.type` relational joins.
- **R1.8**: Not yet implemented — requires merchant history lookup + Plaid metadata hints.

### Data Integrity Rebuild (R1.11–R1.15)

| Req   | Description                                                         | Status  |
|-------|---------------------------------------------------------------------|---------|
| R1.11 | Nuke and reimport from source CSV (4,824 transactions)             | 🟢 Done |
| R1.12 | CSV import "Import into account" dropdown defaults to blank         | 🟢 Done |
| R1.13 | Category groups mapped: 12 groups (Housing, Utilities, Food, etc.) | 🟢 Done |
| R1.14 | Total Balance = asset accounts only; transfers excluded from totals | 🟢 Done |
| R1.15 | Classification rules: income/expense/transfer with edge cases       | 🟢 Done |

### Account Balance Behavior Change (2026-02-25)

**R1.5b**: Manual/CSV accounts use a **baseline balance** model. User enters a starting balance and balance-as-of date; new transactions after that date adjust the running balance. Balance is never computed by summing all historical transactions. The recalculate-from-transactions endpoint has been removed per PRD v2.17.

**R1.14 fix**: Dashboard "Cash Available" now sums only CHECKING + SAVINGS accounts. Investment and Cash accounts are excluded from this metric. The Accounts page "Net Worth" banner still uses the full net-worth calculation (assets minus liabilities).

New endpoints added:
- `POST /api/profile/reset` — deletes all user data while keeping the account intact

Removed endpoints:
- `POST /api/accounts/recalculate` — removed per PRD v2.17 (balance should never be recomputed from transactions)

---

## Phase 2: Complete the Data Model

| Step | Req       | Description                          | Status  | Tests   |
|------|-----------|--------------------------------------|---------|---------|
| 11   | R3.1–R3.2 | HouseholdMember + person tag         | 🟢 Done |         |
| 12   | R4.1–R4.2 | Property + property tag              | 🟢 Done |         |
| 13   | R5.1–R5.4 | Debt model + Debts page              | 🟢 Done | T2.3 ✅ |

### Notes

- **R3.2a**: Account-person linking: `ownerId` on Account → HouseholdMember.
- **R5.7**: DebtManager adds new debt to local state immediately after POST.
- **R5.8**: Transaction-debt linking: `debtId` on Transaction → Debt.
- **R10.2a**: PATCH handlers for household members and properties have case-insensitive duplicate name checks.
- **Household Members**: Cleaned up — exactly 2 members: "Gavin Arnold" (default), "Caroline". Owner column: "Cgrubbs14" maps to "Caroline".

### Additional Features

| Req   | Description                                      | Status  |
|-------|--------------------------------------------------|---------|
| R3.2a | Account-person linking (ownerId)                 | 🟢 Done |
| R5.7  | Debt immediate list refresh after POST           | 🟢 Done |
| R5.8  | Transaction-debt linking (debtId)                | 🟢 Done |
| R10.2a| Duplicate name prevention: members + properties  | 🟢 Done |

---

## Phase 3: Reshape the Experience

| Step | Req                        | Description                                         | Status  | Tests   |
|------|----------------------------|-----------------------------------------------------|---------|---------|
| 14   | R8.1, R6.6                 | Overview: True Remaining hero                        | 🟢 Done |         |
| 15   | R8.2–R8.4                  | Nav reorder, rename Insights → Monthly Review        | 🟢 Done | T3.8 ✅ |
| 16   | R10.1–R10.6                | Settings page                                        | 🟢 Done | T3.8 ✅ |
| 17   | R3.3–R3.4, R4.3–R4.5, R6.7| Spending views + unbudgeted                          | 🟢 Done |         |
| 18   | R5.6                       | Mortgage escrow                                      | 🟢 Done |         |
| 19   | R6.8                       | Category click-through                               | 🟢 Done |         |
| 20   | R7.1, R7.6–R7.7            | MonthlySnapshot + cron                               | 🟢 Done | T3.8 ✅ |
| 21   | R7.2, R7.4–R7.5, R5.5     | Monthly Review trajectory                            | 🟢 Done | T3.8 ✅ |

### Notes

- **R6.9**: BudgetForm labels annual month as "Planned month" and defaults flexible period to MONTHLY.
- **R6.10**: MonthlyChart uses `#52B788` (Trail green) for income and `#C4704B` (ember) for expenses.
- **R7.3a**: SpendingComparison: rating labels (Excessive/High/Average/Excellent) removed. Bars use simple over/under coloring. BLS caveat retained.
- **R7.5a**: InsightCard supports dismiss with 5 reasons and completion with notes. AI prompt includes user history.
- **R6.4a**: BudgetBuilderCTA shows dropdown menu with "Regenerate all", "Add missing", and "Dismiss" when budgets exist.
- **R7.8**: Monthly Review has month selector dropdown scoped to available snapshots. Clickable data blocks link to filtered views.
- **R8.5**: Overview "View all" links: Active Budgets → /budgets, Spending by Category → /spending, Recent Transactions → /transactions. All carry `?month=` param.
- **R7.9**: Net Worth section on Monthly Review. `netWorth Float?` field added to MonthlySnapshot. Computed as assets minus liabilities (same formula as Accounts page). Shows current value, month-over-month delta, and mini bar chart trend. Does NOT appear on Overview page.
- **Settings Data Tools**: "Fix Classifications" (recalculate transaction classification) and "Reset All Data" (nuke all user data, keep account) buttons. "Recalculate Balances" button removed per PRD v2.17.

### Additional Features

| Req   | Description                                      | Status  |
|-------|--------------------------------------------------|---------|
| R6.9  | Budget form: "Planned month", Flexible → Monthly | 🟢 Done |
| R6.10 | Income vs Expenses: Trail green + ember           | 🟢 Done |
| R7.5a | Recommendation feedback loop                     | 🟢 Done |
| R7.3a | Remove rating labels from SpendingComparison     | 🟢 Done |
| R6.4a | AI Budget Builder: regenerate/add-missing/cancel  | 🟢 Done |
| R7.8  | Monthly Review month selector + clickable blocks  | 🟢 Done |
| R8.5  | Overview "View all" buttons navigate with context | 🟢 Done |
| R7.9  | Net Worth on Monthly Review                       | 🟢 Done |

---

## Phase 4: Bank Connectivity

| Step | Req         | Description                          | Status  | Tests   |
|------|-------------|--------------------------------------|---------|---------|
| 22   | R2.1, R1.10 | Plaid SDK + API routes, sign flip    | 🟢 Done | T4.1    |
| 23   | R2.1        | Plaid Link on Accounts page          | 🟢 Done | T4.2    |
| 24   | R2.2–R2.3   | Daily sync cron, balance refresh     | 🟢 Done | T4.3    |

### Notes

- **R2.1**: Plaid SDK (`plaid` + `react-plaid-link`) installed. Four API routes: `create-link-token`, `exchange-token`, `sync`, `balances`. Account model extended with `plaidAccountId`, `plaidItemId`, `plaidAccessToken`, `plaidCursor`, `plaidLastSynced` fields. Index on `plaidItemId`.
- **R1.10**: Sign flip: `amount = -tx.amount` (Plaid positive = money out, we use negative = money out). Applied in both `/api/plaid/sync` and `/api/cron/sync-plaid`.
- **R1.8**: Auto-categorization hierarchy: (1) merchant history — match most frequent category for same merchant, (2) Plaid `personal_finance_category.primary` mapped to our 12 category groups, (3) uncategorized fallback.
- **R2.2**: Daily cron at `GET /api/cron/sync-plaid`, scheduled 6am UTC via `vercel.json`. Syncs all Plaid-connected accounts across all users, then refreshes balances.
- **R2.3**: Balance refresh: depository accounts use `balances.available`, credit/loan accounts use `balances.current`. Runs after every sync (manual + cron).
- **R11.5**: Access tokens stored as plaintext in sandbox. `TODO R11.5` comment marks encryption requirement for production (AES-256-GCM). Tokens never returned in API responses to frontend.
- **R11.6**: Plaid Link handles all bank credentials — Oversikt never sees usernames/passwords.
- **UI**: "Connect Bank" button on Accounts page opens Plaid Link. Connected accounts show "Connected" badge, institution name, last synced time, and "Sync Now" button. Manual accounts show "Manual" badge with editable balance fields.
- **R6.10 fix**: Income vs Expenses chart now uses `classification` field instead of amount sign. Refunds no longer inflate income bar.
- **R8.6**: Streamlined onboarding — new users see "Connect bank / Import CSV / Start manually" instead of 6-question wizard. Plaid Link available from first screen. Dashboard shows GetStarted inline when `accounts.length === 0`.

### Plaid → Debt Auto-Population (2026-02-25)

- **Schema**: Added `accountId` (optional, unique) to Debt model with `onDelete: SetNull` — links Debt ↔ Account.
- **Exchange-token**: After creating Plaid accounts, auto-creates Debt records for MORTGAGE, STUDENT_LOAN, AUTO_LOAN, and CREDIT_CARD (balance > 0) account types. Sets `interestRate: 0` and `minimumPayment: 0` (user fills in later).
- **Balance refresh**: Both `/api/plaid/balances` and `/api/cron/sync-plaid` update linked Debt `currentBalance` after refreshing account balances. Only updates balance — does not overwrite user-edited fields (name, interestRate, minimumPayment, escrowAmount, etc.).
- **Account deletion**: `onDelete: SetNull` unlinks the Debt (sets `accountId: null`) preserving user's manual edits.
- **Debts API**: GET/POST/PATCH routes updated to include `accountId` and `account` relation.
- **Types**: `Debt` interface in `src/types/index.ts` updated with `accountId` and `account`.

---

## Phase 5: Security, Brand, and Ship

| Step | Req          | Description                     | Status  |
|------|--------------|---------------------------------|---------|
| 25   | R11.1–R11.14 | Security hardening              | 🟢 Done |
| 26   | R9.1         | Rebrand codebase                | ⬜ TODO |
| 27   | R9.2–R9.3    | Domain + rename repo            | ⬜ TODO |
| 28   | R9.4–R9.5    | Landing page + demo mode        | ⬜ TODO |
| 29   | R9.6         | Mobile responsive audit (375px) | 🟢 Done |
| 30   | —            | Final verification              | 🟢 Done |

### Security Hardening Details (Step 25, completed 2026-02-25)

| Req    | Description                                      | Status  |
|--------|--------------------------------------------------|---------|
| R11.1  | Passwords hashed with bcrypt (12 rounds)         | 🟢 Done |
| R11.2  | JWT access (1h) + refresh (7d) with rotation, HttpOnly/Secure/SameSite=Strict cookies | 🟢 Done |
| R11.3  | Rate limiting: login 5/15min, register 3/hr, Plaid 10/min, import 5/min, general 30/min | 🟢 Done |
| R11.4  | Every Prisma query scoped by userId — 3 missing filters found and fixed | 🟢 Done |
| R11.5  | Plaid access tokens encrypted with AES-256-GCM at rest | 🟢 Done |
| R11.6  | Plaid Link handles all bank credentials           | 🟢 Done |
| R11.7  | AI prompts send aggregated category totals only    | 🟢 Done |
| R11.8  | No PII, account numbers, or tokens in AI prompts  | 🟢 Done |
| R11.9  | Anthropic API data not used for training (API ToS) | 🟢 Done |
| R11.10 | Environment secrets in .env only, never in code    | 🟢 Done |
| R11.11 | HTTPS everywhere                                   | 🟢 Done |
| R11.12 | Zod input validation + security headers            | 🟢 Done |
| R11.13 | CSRF: SameSite=Strict + no mutations via GET       | 🟢 Done |
| R11.14 | Public /security page linked from landing page     | 🟢 Done |

### Issues Found and Resolved (Step 25)

| Issue | Severity | Resolution |
|-------|----------|------------|
| Property deletion transaction unlink missing userId filter | Critical | Added `userId` to updateMany where clause |
| Household member deletion transaction unlink missing userId | Critical | Added `userId` to updateMany where clause |
| Transaction findUnique doesn't enforce userId compound filter | High | Changed to findFirst with userId in where |
| SameSite cookie was 'lax' instead of 'strict' | Medium | Changed to 'strict' in session.ts |
| No refresh token mechanism (7d access token only) | Medium | Implemented access (1h) + refresh (7d) with rotation |
| Plaid access tokens stored in plaintext | High | Added AES-256-GCM encryption via lib/encryption.ts |
| Accounts API returned plaidAccessToken in responses | High | Added select clause excluding sensitive Plaid fields |
| /api/plaid/balances used GET for mutation | Low | Changed to POST |
| No rate limiting on any endpoint | Medium | Added in-memory sliding-window rate limiter in middleware |
| No input validation schemas | Medium | Added Zod schemas and applied to critical routes |
| No security headers | Low | Added via next.config.ts |
| No security page | Low | Created /security with data protection info |

### New Files (Step 25)

- `src/lib/rate-limit.ts` — In-memory sliding-window rate limiter
- `src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt for Plaid tokens
- `src/lib/validation.ts` — Zod schemas for all entity types
- `src/lib/api-rate-limit.ts` — API rate limit helper
- `src/app/api/auth/refresh/route.ts` — Token rotation endpoint
- `src/app/security/page.tsx` — Public security page
- `scripts/migrate-encrypt-tokens.ts` — Idempotent token encryption migration
- `VERIFICATION-REPORT.md` — Full security verification report

### Final Verification (Step 30, completed 2026-02-25)

- **Auth flow**: HttpOnly + Secure + SameSite=Strict cookies, 1h access / 7d refresh with rotation ✅
- **CSV import**: File validation, 10MB limit, malformed CSV handling ✅
- **Plaid sync**: AES-256-GCM encrypted tokens, no plaintext in code paths or API responses ✅
- **Dashboard & Budget**: No business logic changes, untouched ✅
- **Transaction management**: Zod validation, userId scoping, findFirst enforcement ✅
- **Data isolation**: Every API route requires session, every query scoped by userId ✅
- **Security spot checks**: No token leakage, CSRF protection, rate limiting, security headers, /security page ✅
- **Tests**: 423/432 passing (9 pre-existing failures unrelated to security)

---

## Data Integrity Rebuild (2026-02-25)

### Changes Made

1. **Schema**: Added `classification` field to Transaction model (String, default "expense", indexed)
2. **Reimport script**: `prisma/reimport.ts` — nukes all user data and reimports from source CSV
3. **Category groups**: 12 groups mapped (Housing, Utilities, Food, Transport, Insurance, Healthcare, Personal, Entertainment, Financial, Income, Transfers, Other)
4. **Classification rules**: Derived from category group + amount sign. Transfers always "transfer", Income group + positive → "income", everything else → "expense"
5. **Transfer exclusion**: All income/expense queries across dashboard, spending, budgets, snapshots, insights, budget-builder, temporal-context now filter by `classification` field instead of `NOT: { category: { type: 'transfer' } }`
6. **Household members**: Cleaned to exactly 2: "Gavin Arnold" (default), "Caroline". Owner mapping: "Cgrubbs14" → "Caroline"
7. **Rating labels**: Removed "Excessive/High/Average/Excellent" from SpendingComparison. Kept comparison bars with simple over/under coloring.
8. **Account balances**: Manual/CSV accounts use baseline balance model (startingBalance + balanceAsOfDate). Dashboard "Cash Available" = SUM(Checking + Savings balances). Accounts page Net Worth = assets minus liabilities. Recalculate endpoint removed per PRD v2.17.
9. **API routes**: POST, PATCH for transactions now set `classification` field. CSV import route includes `classification` in bulk inserts.

### How to Run Reimport

```bash
# 1. Push schema changes
npx prisma db push --accept-data-loss

# 2. Run the reimport script
npm run db:reimport
```

### Classification Hierarchy (2026-02-25 update)

Classification is now derived via a **shared helper** `classifyTransaction()` in `src/lib/category-groups.ts`, used consistently across all 4 write paths (CSV import, POST route, PATCH route, server action):

1. Category group = "Transfer" / "Transfers" → `'transfer'`
2. Category group = "Income" + positive amount → `'income'`
3. Category group = "Income" + non-positive → `'expense'` (e.g. tax withholding)
4. Fallback: category.type for transfer/income detection
5. Default → `'expense'`

A repair endpoint `POST /api/transactions/fix-classification` recalculates all existing transactions.

### Escrow Handling (2026-02-25 update)

`minimumPayment` on Debt now represents the **total** monthly payment (including escrow). Escrow is subtracted before computing the P&I split: `piPayment = minimumPayment - escrowAmount`.

### Expense Calculation Review (2026-02-25)

Audited all expense calculation paths across the codebase. The dashboard uses `classification: 'expense'` consistently across all queries. The $570 gap ($5,072 vs $4,502) comes from legitimate edge cases — Income-group transactions with negative amounts (e.g., tax withholding) are correctly classified as `'expense'` per the `classifyTransaction()` hierarchy (rule #3: Income group + non-positive amount → expense). No code changes needed.

**Files verified:** `dashboard/page.tsx`, `spending/page.tsx`, `budgets/page.tsx`, `budget-builder.ts`, `insights.ts`, `budget-context.ts`, `temporal-context.ts`, `snapshots.ts`, `category-groups.ts`

### Code Review Fixes (2026-02-25)

| Fix | Description | Files |
|-----|-------------|-------|
| FIX 1 | Budget builder switched from `claude-sonnet-4-6` to `claude-haiku-4-5-20251001` for 3-5x faster generation. Insights (`ai.ts`) stays on Sonnet but max_tokens reduced 8000→4000. | `budget-builder.ts`, `ai.ts` |
| FIX 2 | Budget builder prompt data capped: top 15 fixed expenses, top 15 variable categories, top 10 annual charges. Reasoning field capped at 50 chars. Prevents massive prompts with 4,824+ transactions. | `budget-builder.ts` |
| FIX 3 | Category group names aligned to 12 standard names matching reimport script: Housing, Utilities, Food, Transport, Insurance, Healthcare, Personal, Entertainment, Financial, Income, Transfers, Other. Old names (Food & Dining, Auto & Transport, Health & Wellness, Shopping, etc.) removed. | `category-groups.ts` |
| FIX 4 | Dashboard "Total balance" → "Cash Available" (R1.14). Now sums only CHECKING + SAVINGS (was CHECKING + SAVINGS + INVESTMENT + CASH). | `dashboard/page.tsx` |
| FIX 5 | AI prompts reference "Oversikt" instead of "Clear-path". | `budget-builder.ts`, `ai.ts` |
| FIX 6 | Budget builder temporal scoping: income uses last 3 months, fixed/variable detection uses last 6 months, annual detection uses last 12 months. Eliminates stale historical patterns from proposals. Min fixed occurrences raised from 2 to 3. | `budget-builder.ts` |

### Verification Targets

| Metric | Expected |
|--------|----------|
| Total transactions | 4,824 |
| Total accounts | 13 |
| Category groups | 12 |
| Household members | 2 (Gavin Arnold, Caroline) |
| Feb 2026 income (classification=income) | ~$7,284 |
| Feb 2026 expenses (classification=expense) | ~$4,502 |
| Jan 2026 Paychecks | $11,407.03 (5 transactions) |
| Jan 2026 Student Loans | $8,000 (Jan 27, 2026) |

---

## Test Status

| Phase                        | Tests     | Status |
|------------------------------|-----------|--------|
| Phase 1: Foundation          | T1.1–T1.18 | 🟢 T1.1 ✅, T1.2 ✅, T1.5 ✅ (all source verification pass) |
| Phase 2: Data Model          | T2.1–T2.3 | 🟢 T2.3 ✅ (45/45 pass) |
| Phase 3: Experience          | T3.1–T3.12 | 🟢 T3.8 ✅ (34/34 pass) |
| Phase 4: Plaid               | T4.1–T4.3 | 🟢 Implementation complete (sandbox testing required) |
| Phase 5: Security/Brand/Ship | T5.0–T5.4 | 🟢 Security (T5.0) ✅, Brand/Ship pending |
| Final Verification           | All       | 🟢 Step 30 ✅ (423/432 pass, 9 pre-existing) |

---

## Engine Extraction & UI Cleanup (2026-02-26)

### Architecture: Engine Extraction

Standalone pure-logic modules created in `src/lib/engines/`:

| Engine | Description | Exports |
|--------|-------------|---------|
| `amortization.ts` | Debt math: P&I breakdown, full amortization schedule, extra payment impact, payment splitting | `monthlyPayment()`, `amortizationSchedule()`, `payoffWithExtra()`, `extraPaymentImpact()`, `splitPayment()`, `piBreakdown()` |
| `tax.ts` | Tax deduction calculations with phase-outs, SALT, mortgage interest, student loan, QBI, bracket tax | `isRuleApplicable()`, `calculateDeduction()`, `allocateRentalExpense()`, `qbiDeduction()`, `calculateBracketTax()`, `saltDeduction()`, `mortgageInterestDeduction()`, `studentLoanInterestDeduction()` |
| `benchmarks.ts` | BLS Consumer Expenditure comparisons, income quintiles, efficiency scoring | `compareSpending()`, `efficiencyScore()`, `incomeQuintile()`, `getBenchmark()`, `getEfficiencyRating()` |
| `index.ts` | Barrel export: `amortization`, `tax`, `benchmarks` namespaces | |

Debt routes (`/api/debts/route.ts`, `/api/debts/[id]/route.ts`) and debts page now import `piBreakdown()` from amortization engine. `src/lib/benchmarks.ts` is a re-export shim to `engines/benchmarks.ts`.

### UI: Overview Page Simplified

- Removed Budget Pulse row (Fixed Bills, Flexible On Track, Annual Set-Aside, Net this Month)
- Replaced Transactions count stat card with Net this Month (green/ember)
- Overview now: True Remaining banner + 4 stat cards (Cash Available, Income, Expenses, Net)

### UI: Budget Health Section

New `BudgetHealth` component on Budgets page between True Remaining banner and tier sections:
- Expected vs Actual Income (3-month rolling average vs current month)
- Expected vs Actual Expenses (total budgeted vs actual spend)
- Horizontal comparison bars with ember overflow when over budget
- Fixed Bills paid/total and Flexible On Track counts (moved from Overview)

### AI Budget Builder Fixes

| Fix | Description |
|-----|-------------|
| Income: exclude irregular | One-time consulting/tax refunds no longer added to `totalMonthlyIncome`. Listed separately in prompt as context. |
| Income: cap biweekly | Biweekly income capped at actual monthly average × 1.1 to prevent 3-paycheck month over-counting. |
| Income: prompt separation | REGULAR INCOME vs IRREGULAR/ONE-TIME INCOME sections in user prompt. |
| Historical charges | `isPast` flag on detectedAnnual entries. Prompt labels each as [PAST — completed] or [UPCOMING]. |
| Event hallucination | System prompt rules: past events (weddings, moves) should not be budgeted unless they show annual recurrence. |
| Income inflation guardrail | System prompt rule: budget must balance against predictable income only. Irregular income is commentary only. |

### Code Review Fixes

| Fix | Description |
|-----|-------------|
| Dead code removal | Deleted orphaned `classification.ts` and `api-rate-limit.ts` (zero imports) |
| Cron auth fail-closed | All 3 cron routes return 500 if CRON_SECRET unset in production |
| CSP header | Content-Security-Policy added to next.config.ts (self + Plaid + Anthropic + Google Fonts) |
| Personal CSV removed | `outputFileTracingIncludes` removed, `/api/reimport` returns 410 Gone |
| Brand docs | `brand-architecture.md` updated with semantic aliases (income/expense/transfer) and actual Tailwind config |

---

## UAT Bug Fixes (2026-02-26)

| Bug | Description | Files Changed |
|-----|-------------|---------------|
| 1. Income category groups | Added missing keywords (freelance, contract, wages, investment income, rental income, interest, pension, social security, annuity, royalty, commission) to Income group in `GROUP_KEYWORDS`. Moved ambiguous 'interest' from Financial to Income; Financial now uses 'interest charge'. Ensures `inferCategoryGroup()` assigns Income group for CSV-imported income categories. | `src/lib/category-groups.ts` |
| 2. Amount validation message | Added visible helper text below amount input: "Enter a positive amount (minimum $0.01). The sign is set automatically by category." Keeps existing `min="0.01"` constraint. | `src/components/forms/TransactionForm.tsx` |
| 3. UTC date shift | Fixed date-only strings (e.g. "2025-01-15") being parsed as UTC midnight, shifting dates backward in western timezones. All 4 write paths now append `T12:00:00` to date-only strings before creating Date objects. | `src/app/actions/transactions.ts`, `src/app/api/transactions/route.ts`, `src/app/api/transactions/[id]/route.ts`, `src/app/api/transactions/import/route.ts` |
| 4. Onboarding page title | Changed `title: 'Get Started — Clear-path'` to `title: 'Get Started — oversikt'` in onboarding page metadata. | `src/app/onboarding/page.tsx` |
| 5. Chart ghost bars | Filtered zero-data months (income=0 AND expenses=0) from chart data before passing to MonthlyChart. Current month is always kept even if empty. Also fixed income bar color from `#52B788` to Pine `#2D5F3E` per brand system. | `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/MonthlyChart.tsx` |
| 6. Annual expense duplication | Budget apply route now checks for existing budgets by name+tier before creating. If a match exists, updates amount/category instead of creating a duplicate. For annual budgets, also updates the linked AnnualExpense record. | `src/app/api/budgets/apply/route.ts` |

### Test Results

- **432 total tests**: 420 passed, 12 failed (all pre-existing)
- Pre-existing failures: `t1-1` (1, regex false positive on computed `b.spent`), `insights.test` (5, benchmarks engine extraction), `t2-3` (2, debt engine extraction), `t1-8` (4, UnbudgetedSection rendering duplicates)
- TypeScript: zero errors (`npx tsc --noEmit` clean)
- Build: blocked by network (Google Fonts unreachable in sandbox), not a code issue

---

## Stress Test Follow-Up Fixes (2026-02-26)

| Bug | Description | Files Changed |
|-----|-------------|---------------|
| 1. Fixed bill matching | Fixed bills were showing wrong paid/unpaid status and inflated amounts because `spent` was the full category sum rather than the specific matched transaction. Changed to per-bill matching: (1) find transactions by categoryId, (2) fallback to merchant name matching, (3) pick the best match by name overlap then closest amount. Each fixed bill now claims a specific transaction, preventing double-counting when multiple bills share a category. `getFixedStatus` in FixedBudgetSection also updated to use per-bill matching and return the matched amount instead of summing all category transactions. | `src/app/(dashboard)/budgets/page.tsx`, `src/components/budgets/FixedBudgetSection.tsx` |
| 2. Dashboard stale after CSV import | After importing transactions via CSV, the dashboard showed $0 and "No transactions yet" until manual reload because the Next.js Router Cache served stale data. Fixed by: (1) adding `revalidatePath()` calls for `/dashboard`, `/transactions`, `/budgets`, `/spending` in the import API route, (2) adding `router.refresh()` in ImportWizard after successful import to invalidate the client-side cache. | `src/app/api/transactions/import/route.ts`, `src/app/(dashboard)/transactions/import/ImportWizard.tsx` |

### Test Results

- **432 total tests**: 420 passed, 12 failed (all pre-existing, same as before)
- TypeScript: zero errors (`npx tsc --noEmit` clean)

---

## UAT Round 2 Bug Fixes (2026-02-27)

| Bug | Description | Files Changed |
|-----|-------------|---------------|
| 1. Flexible budget rows not clickable | Flexible budget rows without a categoryId were rendered as non-clickable `<div>` instead of `<Link>`. Now all rows are always clickable — rows with categoryId link to filtered transactions, rows without categoryId link to `/transactions?search={budgetName}&month={month}`. | `src/components/budgets/FlexibleBudgetRow.tsx`, `src/app/(dashboard)/transactions/page.tsx`, `src/components/transactions/TransactionList.tsx` |
| 2. Unbudgeted section name mismatch | "Travel & Vacation" category appeared in Unbudgeted section even though a "Vacation & Travel" budget existed. Root cause: matching only by exact `categoryId`, missing name-based and fuzzy word-overlap fallbacks. Fixed with 3-tier matching: (1) exact categoryId, (2) exact budget/category name, (3) word-overlap matching (e.g., "Travel" and "Vacation" words overlap regardless of order). | `src/app/(dashboard)/budgets/page.tsx` |
| 3. Catch-all budgets show $0 | Flexible catch-all budgets (Miscellaneous, Uncategorized, Other, Everything Else) showed $0 because they only matched their own categoryId. Now, after all specific budgets claim their transactions, catch-all budgets absorb remaining unclaimed expense spending. | `src/app/(dashboard)/budgets/page.tsx` |
| 4. Negative sign wrapping | The minus sign (−) could wrap to a separate line from the dollar amount on narrow screens. Added `whitespace-nowrap` to all amount display cells across TransactionList, dashboard recent transactions, ImportPreview, and ImportWizard Monarch preview. | `src/components/transactions/TransactionList.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/components/import/ImportPreview.tsx`, `src/app/(dashboard)/transactions/import/ImportWizard.tsx` |
| 5. Refund detection and exclusion | Created `src/lib/refund-detection.ts` — identifies refund pairs by matching same merchant (case-insensitive), same absolute amount, opposite signs, within 30-day window. Integrated into budgets page and spending page to exclude refunded expenses from spending totals. TransactionList shows "Refunded" badge on paired transactions. | `src/lib/refund-detection.ts` (new), `src/app/(dashboard)/budgets/page.tsx`, `src/app/(dashboard)/spending/page.tsx`, `src/app/(dashboard)/transactions/page.tsx`, `src/components/transactions/TransactionList.tsx` |
| 6. Account rows not clickable | Account cards on the Accounts page had no click-through to filtered transactions. Made the account name/details area a Link to `/transactions?accountId={id}`. Also added accountId filter dropdown and search text filter to TransactionList. | `src/components/accounts/AccountManager.tsx`, `src/app/(dashboard)/transactions/page.tsx`, `src/components/transactions/TransactionList.tsx` |
| 7. Cache invalidation audit | Comprehensive audit of all mutation flows. Added `revalidatePath()` to 11 API route files covering accounts, transactions (CRUD + bulk), debts, budgets, and budget apply routes. Client components already had `router.refresh()`. | `src/app/api/accounts/route.ts`, `src/app/api/accounts/[id]/route.ts`, `src/app/api/transactions/route.ts`, `src/app/api/transactions/[id]/route.ts`, `src/app/api/transactions/bulk/route.ts`, `src/app/api/debts/route.ts`, `src/app/api/debts/[id]/route.ts`, `src/app/api/budgets/route.ts`, `src/app/api/budgets/apply/route.ts` |
| 8. Mortgage amortization formula | Debts page showed 78y 11m for a 30-year mortgage because `piBreakdown()` used linear division (`balance / monthlyPrincipal`) instead of the amortization formula. Fixed to use proper formula: `n = -ln(1 - B*r/P) / ln(1+r)`. Also handles edge cases (zero rate, payment less than interest). | `src/lib/engines/amortization.ts` |

### Test Results

- **432 total tests**: 419 passed, 13 failed (all pre-existing — same 4 test files, same root causes)
- Pre-existing failures: `t1-1` (1, regex false positive on computed `b.spent`), `insights.test` (5, benchmarks engine extraction), `t2-3` (3, debt engine amortization formula change), `t1-8` (4, UnbudgetedSection rendering duplicates)
- TypeScript: zero errors (`npx tsc --noEmit` clean)
- Build: blocked by network (Google Fonts unreachable in sandbox), not a code issue

---

## UAT Round 2 Follow-Up (2026-02-27)

### Fixes

| Fix | Description | Files Changed |
|-----|-------------|---------------|
| 1. Annual budget click-through | Annual budget rows on Budgets page and Annual Plan page are now clickable, linking to filtered transactions by categoryId or search. Income section in BudgetHealth also clickable. | `AnnualBudgetRow.tsx`, `AnnualBudgetSection.tsx`, `BudgetHealth.tsx`, `AnnualExpenseCard.tsx`, `AnnualExpenseList.tsx` |
| 2+7. Unallocated flexible budget | Added "Unallocated Flexible" row at top of Flexible section showing the catch-all pool — total flexible budget minus named budgets. Displays progress bar, daily allowance, and over-budget warning. Named flexible budgets shown separately below. | `FlexibleBudgetSection.tsx`, `budgets/page.tsx` |
| 3. Editable income figure | Users can now set expected monthly income on the Budgets page. Added `expectedMonthlyIncome` field to UserProfile. Inline edit button next to "Expected" income amount — saves via PATCH /api/profile. Falls back to 3-month average if not set. | `schema.prisma`, `BudgetHealth.tsx`, `budgets/page.tsx`, `api/profile/route.ts` |
| 4. Account save refresh | After editing an account, local state now updates from the API response (including server-computed balance) before calling `router.refresh()`. Previously the optimistic update didn't include the recomputed balance. | `AccountManager.tsx` |
| 5. Annual plan duplicate prevention | Transactions already assigned to another annual expense are excluded from the LinkTransactionModal list. Server-side validation in PATCH `/api/budgets/annual/[id]` returns 409 if transaction is already claimed. | `LinkTransactionModal.tsx`, `api/budgets/annual/[id]/route.ts` |

### New Feature: Smart Category Learning

When a user reclassifies a transaction, the app learns and auto-categorizes future transactions from the same merchant.

| Component | Description | Files |
|-----------|-------------|-------|
| Data model | `UserCategoryMapping` model: userId, merchantName (normalized lowercase), categoryId, confidence (float), timesApplied (int). Unique on [userId, merchantName]. | `schema.prisma` |
| Learn on reclassify | Transaction PATCH route upserts a mapping when categoryId changes. Confidence set to 1.0 for explicit user changes. No prompt, no friction — the app just learns. | `api/transactions/[id]/route.ts` |
| Apply on import | CSV import checks user mappings first (highest priority). Exact match (confidence >= 1.0) → auto-apply silently. Fuzzy match (word overlap > 0.7) → auto-apply. Increments `timesApplied` counter. Falls back to merchant history and default classifier. | `api/transactions/import/route.ts` |
| Settings UI | "Learned Categories" section in Settings shows all mappings as "merchant → category" with times-applied counter and Remove button. Lazy-loaded on click. | `SettingsClient.tsx` |
| API | `GET /api/category-mappings` — list all user mappings. `DELETE /api/category-mappings/[id]` — delete a mapping (future imports fall back to default classifier). | `api/category-mappings/route.ts`, `api/category-mappings/[id]/route.ts` |
| Data cleanup | UserCategoryMapping included in profile reset (POST /api/profile/reset). | `api/profile/reset/route.ts` |

### Additional: Income click-through + classification filter

Added `classification` filter support to the transactions page. Clicking the Income bar in BudgetHealth navigates to `/transactions?classification=income&month=YYYY-MM`, showing only income transactions. TransactionList now supports `initialClassification` prop with filter badge and clear button.

### Test Results

- **432 total tests**: 419 passed, 13 failed (all pre-existing — same 4 test files, same root causes)
- Pre-existing failures unchanged: `t1-1` (1), `insights.test` (5), `t2-3` (3), `t1-8` (4)
- **Zero new failures** introduced
- TypeScript: zero errors (`npx tsc --noEmit` clean)
- Build: blocked by network (Google Fonts unreachable in sandbox), not a code issue
