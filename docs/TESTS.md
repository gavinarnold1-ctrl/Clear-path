# Oversikt — Test Specifications

*Paired with `/docs/PRD.md` v2.0*
*This file lives at `/docs/TESTS.md`*

-----

## How to use this document

After completing each phase in the PRD, Claude Code runs the corresponding test section below. Tests are a mix of:

- **DB tests** — query the database directly to verify data integrity
- **API tests** — hit endpoints and verify responses
- **UI tests** — check rendered pages for correct content
- **Regression tests** — confirm nothing broke from previous phases

Claude Code runs these in the terminal using the app's existing stack (Prisma, Next.js API routes, and browser checks via curl or a test script). For UI verification, Claude Code can use the dev server and check rendered HTML or describe what to verify manually.

**Pass criteria:** Every test in a phase must pass before starting the next phase. If a test fails, fix it within the current phase scope — don't move forward.

-----

## Phase 1 Tests: Fix the Foundation

*Run after Steps 1–4 are complete.*

### T1.1 Budget.spent computed correctly (Step 1)

```
Test: Budget spent matches transaction sums

Setup:
  - Identify a Flexible budget (e.g., Groceries, categoryId = X)
  - Query transactions for that category in current month:
    SELECT SUM(ABS(amount)) FROM Transaction
    WHERE categoryId = X AND userId = Y
    AND date >= '2026-02-01' AND date < '2026-03-01'

Verify:
  1. The Budget model no longer has a `spent` field in schema.prisma
  2. GET /api/budgets returns a `spent` property for each budget
  3. The returned `spent` value matches the transaction sum above
  4. Groceries spent ≈ $211.48 (matches Spending Breakdown screenshot)
  5. Restaurants & Bars spent ≈ $174.50
  6. Gas & Electric spent ≈ $158.42

Regression:
  7. True Remaining on Budgets page still calculates correctly
  8. $/day remaining = (budget limit - spent) / days left in month
  9. Budget creation still works (POST /api/budgets)
  10. Budget deletion still works (DELETE /api/budgets/[id])
```

### T1.2 Fixed expense matching (Step 2)

```
Test: Fixed expenses match transactions by category within month

Verify:
  1. Mortgage Payment shows as PAID (not MISSED)
     - There is a transaction with category "Mortgage" in February 2026
     - Amount matches or exceeds the fixed expense amount
  2. South Central CT Water shows as PAID (not MISSED)
     - There is a transaction with category "Water" in February 2026
  3. AT&T Phone shows as PAID with $89.99 (was already correct)
  4. Frontier Internet shows as PAID with $74.99 (was already correct)
  5. Planet Fitness shows as PAID with $24.99 (was already correct)
  6. Modcup Coffee Subscription shows as PAID with $18.95 (was already correct)

Edge cases:
  7. A fixed expense with NO matching transaction still shows MISSED
  8. Auto Insurance (due 1st) — verify: if no transaction exists, shows MISSED correctly
  9. Matching is by categoryId, not by merchant name or exact date
  10. A transaction on any day of the month counts (not just the due date)
```

### T1.3 Amount sign enforcement (Step 3)

```
Test: Signs enforced at API level

Verify via API calls:
  1. POST /api/transactions with category type "expense" → amount stored as negative
  2. POST /api/transactions with category type "income" → amount stored as positive
  3. Direct DB query: no expense transactions have positive amounts
  4. Direct DB query: no income transactions have negative amounts
  5. CSV import: re-import a test CSV → verify signs are correct in DB

Verify in DB:
  6. SELECT amount FROM Transaction WHERE category type = 'expense' → all negative
  7. SELECT amount FROM Transaction WHERE category type = 'income' → all positive
```

### T1.4 AI Insights with corrected data (Step 4)

```
Test: Insights reflect accurate budget data

Verify:
  1. "Generate Insights" / "Generate Review" button triggers successfully
  2. Response returns within reasonable time (<30s)
  3. The "$2,823 Spent Outside Your Budget" alert is gone or significantly reduced
     (most spending should now show as tracked within budgets)
  4. Efficiency score sub-components have changed from pre-fix values
     (Spending was 74 — should improve now that budgets track correctly)
  5. API error handling: disconnect network or use invalid API key →
     graceful error message, not crash
  6. Dismiss flow works: dismiss an insight → it doesn't reappear on next generate
```

-----

## Phase 2 Tests: Complete the Data Model

*Run after Steps 5–7 are complete.*

### T2.1 Household members (Step 5)

```
Test: HouseholdMember CRUD and transaction tagging

Schema:
  1. HouseholdMember model exists in schema.prisma with: id, userId, name, isDefault
  2. Transaction model has householdMemberId (nullable String) + relation
  3. Migration runs without errors

API:
  4. POST /api/household-members — create "Gavin" → returns member with id
  5. POST /api/household-members — create "Caroline" → returns member with id
  6. POST /api/household-members — create "Shared" with isDefault=true → returns member
  7. GET /api/household-members — returns all 3 members for current user
  8. DELETE /api/household-members/[id] — deletes member, nulls out transactions

Transactions:
  9. PUT /api/transactions/[id] with householdMemberId → updates successfully
  10. GET /api/transactions returns householdMember name in response
  11. Transaction with no householdMemberId returns null (not error)

UI:
  12. Transactions page shows "Person" column
  13. "+ Add transaction" form includes Person dropdown
  14. Settings/setup area allows creating household members
```

### T2.2 Property tagging (Step 6)

```
Test: Property CRUD and transaction tagging

Schema:
  1. Property model exists with: id, userId, name, type (PERSONAL/RENTAL), isDefault
  2. Transaction model has propertyId (nullable String) + relation
  3. PropertyType enum exists: PERSONAL, RENTAL
  4. If Property model previously existed, verify it's been simplified (no tax fields)

API:
  5. POST /api/properties — create "Personal" type=PERSONAL isDefault=true
  6. POST /api/properties — create "123 Nicoll St" type=RENTAL
  7. GET /api/properties — returns both
  8. DELETE /api/properties/[id] — deletes, nulls out transactions

Transactions:
  9. PUT /api/transactions/[id] with propertyId → updates successfully
  10. GET /api/transactions returns property name in response
  11. Default property (Personal) is pre-selected for new transactions

UI:
  12. Transactions page shows Property column or badge
  13. "+ Add transaction" form includes Property dropdown
  14. Settings/setup area allows creating properties
```

### T2.3 Debts page (Step 7)

```
Test: Debt CRUD and Debts page rendering

Schema:
  1. Debt model exists with all fields from PRD schema reference
  2. DebtType enum: MORTGAGE, STUDENT_LOAN, AUTO, CREDIT_CARD, PERSONAL_LOAN, OTHER
  3. Optional relations to Property and Category

API:
  4. POST /api/debts — create mortgage:
     { name: "Mortgage - 123 Nicoll St", type: "MORTGAGE",
       currentBalance: 218400, originalBalance: 245000,
       interestRate: 0.053, minimumPayment: 1847, paymentDay: 15,
       termMonths: 360 }
  5. POST /api/debts — create student loan:
     { name: "Student Loans", type: "STUDENT_LOAN",
       currentBalance: 18200, interestRate: 0.05, minimumPayment: 650 }
  6. GET /api/debts — returns both debts with computed fields
  7. PUT /api/debts/[id] — update currentBalance → saves correctly
  8. DELETE /api/debts/[id] — removes debt

Computed values (verify on GET response or page):
  9. Monthly interest = currentBalance × (interestRate / 12)
     Mortgage: 218400 × 0.053/12 ≈ $964.60
  10. Monthly principal = minimumPayment - monthly interest
      Mortgage: 1847 - 964.60 ≈ $882.40
  11. Months remaining ≈ currentBalance / monthly principal (rough estimate)
  12. Total debt = sum of all currentBalance
  13. Total payments = sum of all minimumPayment
  14. Weighted avg rate = Σ(balance × rate) / Σ(balance)

UI:
  15. /debts page renders without errors
  16. Summary card shows total debt, total payments, avg rate
  17. Individual debt cards show P&I breakdown
  18. Progress bar shows currentBalance/originalBalance (if original provided)
  19. "+ Add debt" button opens form with all required fields
  20. Mortgage can be linked to a property (dropdown showing user's properties)

Regression:
  21. All Phase 1 tests still pass
```

-----

## Phase 3 Tests: Reshape the Experience

*Run after Steps 8–12 are complete.*

### T3.1 Overview redesign (Step 8)

```
Test: True Remaining is the hero metric

Verify:
  1. Overview page hero card shows "True Remaining"
  2. True Remaining = total income − total fixed amounts − total annual set-aside
     February: $6,496.16 − $2,279.72 − $1,143.58 = $3,072.86
  3. Breakdown is visible: income, fixed, annual fund, remaining
  4. Total Balance / Net Worth is NOT the hero (moved to Accounts or removed)
  5. Budget pulse section exists: "X of Y on track"
  6. Income vs Expenses chart still renders (below fold)
  7. Recent transactions section still renders

Regression:
  8. Month selector still works
  9. Month-over-month percentages still calculate
```

### T3.2 Navigation restructure (Step 9)

```
Test: Nav matches PRD spec

Verify nav order:
  1. Section 1 (daily): Overview, Budgets, Spending, Annual Plan, Debts, Transactions
  2. Section 2 (periodic): Monthly Review
  3. Section 3 (setup): Accounts, Categories
  4. Spacing or divider between sections (not header labels)
  5. "Insights" text appears nowhere in nav — replaced by "Monthly Review"
  6. /insights route redirects to /monthly-review (or equivalent)
  7. Debts appears in nav and links to /debts
  8. All nav links work and load correct pages
```

### T3.3 Spending views (Step 10)

```
Test: By Person and By Property views work

By Person:
  1. Spending page has a "By Person" toggle/filter
  2. With household members assigned to some transactions:
     shows spending grouped by person name
  3. Untagged transactions appear under "Unassigned" or similar
  4. Person totals sum to overall total

By Property:
  5. Spending page has a "By Property" toggle/filter
  6. Shows spending grouped by property name
  7. "Rental" filter shows only rental-tagged transactions
  8. Property totals sum to overall total

Transactions page:
  9. Property filter dropdown exists above table
  10. Selecting a property filters the transaction list
  11. Person column is visible and filterable
```

### T3.4 Monthly snapshots (Step 11)

```
Test: MonthlySnapshot model and cron

Schema:
  1. MonthlySnapshot model exists with all PRD fields
  2. @@unique([userId, month]) constraint exists

Snapshot generation:
  3. Call generateMonthlySnapshot(userId, '2026-02-01') manually
  4. Record created with:
     - trueRemaining ≈ $3,072.86
     - totalIncome ≈ $6,496.16
     - totalExpenses ≈ $3,032.10
     - savingsRate ≈ 0.533
     - budgetsOnTrack = count of flexible budgets where spent <= limit
     - fixedPaid = count of fixed expenses matched
  5. Calling again for same month doesn't create duplicate (upserts)

Baseline:
  6. After CSV import (first time): snapshot auto-generated
  7. Snapshot month matches import month

Cron:
  8. /api/cron/monthly-snapshot endpoint exists
  9. Calling it generates snapshots for all users
  10. Vercel cron config schedules it for 1st of month at 6am
```

### T3.5 Monthly Review trajectory (Step 12)

```
Test: "Since you started" displays correctly

Setup: Ensure at least 2 MonthlySnapshot records exist (baseline + current)

Verify:
  1. Monthly Review page shows "Since [first month]" section
  2. True Remaining: baseline → current with arrow and % change
  3. Savings rate: baseline → current with point change
  4. Budgets on track: baseline → current
  5. Fixed bills missed: baseline → current
  6. Total debt: baseline → current with $ change (if debts exist)
  7. Person breakdown shown (if household members exist with tagged transactions)
  8. Property breakdown shown (if properties exist with tagged transactions)

Edge case:
  9. With only 1 snapshot: shows message about baseline being built
  10. With 0 snapshots: shows "Your first review will be ready on [date]"

Regression:
  11. Efficiency score still renders
  12. Recommendations still generate
  13. All Phase 1 and Phase 2 tests still pass
```

-----

## Phase 4 Tests: Bank Connectivity

*Run after Steps 13–15 are complete.*

### T4.1 Plaid API routes (Step 13)

```
Test: Plaid endpoints functional

Prerequisites:
  - PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV set in .env
  - PLAID_ENV = "development" (or "sandbox" for testing)

API:
  1. POST /api/plaid/create-link-token → returns link_token string
  2. link_token is valid (not empty, starts with "link-")
  3. POST /api/plaid/exchange-token with valid public_token →
     returns success, stores access_token
  4. POST /api/plaid/exchange-token with invalid token → returns error, not crash
  5. POST /api/plaid/sync → fetches transactions, returns count
  6. GET /api/plaid/balances → returns account balances

Sign convention:
  7. After sync: a Plaid debit (money out) is stored with NEGATIVE amount
  8. After sync: a Plaid credit (money in) is stored with POSITIVE amount
  9. Verify with DB query: Plaid-imported expense transactions have negative amounts

Transaction metadata:
  10. Plaid transactions have importSource = "plaid"
  11. Plaid transactions have householdMemberId = null
  12. Plaid transactions have propertyId = user's default property (or null)
```

### T4.2 Plaid Link UI (Step 14)

```
Test: Plaid Link component on Accounts page

Verify:
  1. "Connect Bank" button visible on Accounts page
  2. Clicking it opens Plaid Link modal/iframe
  3. After successful bank auth:
     - New account(s) appear on Accounts page
     - Account shows institution name, type, balance
     - Account shows "Synced" indicator with timestamp
  4. "Refresh" button on Plaid-connected account triggers sync
  5. Plaid-connected accounts show alongside manual accounts
  6. Net worth includes both Plaid and manual account balances
```

### T4.3 Daily sync cron (Step 15)

```
Test: Automated daily sync

Verify:
  1. /api/cron/sync-plaid endpoint exists
  2. Calling it syncs all Plaid-connected accounts for all users
  3. New transactions created since last sync appear
  4. Cursor updated (subsequent call doesn't re-import same transactions)
  5. Account balances updated
  6. Vercel cron config schedules daily at 6am

Regression:
  7. Budget spent values reflect Plaid-imported transactions
  8. Spending page includes Plaid-imported transactions
  9. Fixed expense matching considers Plaid-imported transactions
  10. All Phase 1, 2, and 3 tests still pass
```

-----

## Phase 5 Tests: Brand and Ship

*Run after Steps 16–19 are complete.*

### T5.1 Rebrand (Step 16)

```
Test: No traces of "Clear Path" or "ClearPath"

Verify:
  1. package.json name field = "oversikt"
  2. grep -ri "clear.path" src/ → 0 results (case insensitive, allow for hyphen/space)
  3. grep -ri "clearpath" src/ → 0 results
  4. README.md title says "Oversikt"
  5. HTML <title> tag says "Oversikt"
  6. Meta tags (og:title, og:site_name) say "Oversikt"
  7. Sidebar still shows "oversikt" wordmark
```

### T5.2 Domain (Step 17)

```
Test: App accessible at new domain

Verify:
  1. GitHub repo URL is github.com/gavinarnold1-ctrl/oversikt (or redirects)
  2. App loads at oversikt.app (or oversikt.vercel.app)
  3. HTTPS works (no certificate errors)
  4. Old URL (clear-path-wheat.vercel.app) redirects or is decommissioned
```

### T5.3 Landing page and demo (Step 18)

```
Test: Unauthenticated experience works

Landing page:
  1. Visiting oversikt.app while logged out shows landing page
  2. Oversikt definition component renders with pronunciation, noun label, meanings
  3. "Create account" button → registration form
  4. "Explore demo" button → logs into demo account

Demo mode:
  5. Demo account has 3+ months of transaction data
  6. Demo account has household members (at least 2)
  7. Demo account has properties (Personal + at least 1 Rental)
  8. Demo account has debts (at least 2)
  9. Demo account has MonthlySnapshots (at least 3 months)
  10. Persistent banner shows "Demo Mode" indicator
  11. Monthly Review "Since you started" shows meaningful trajectory
  12. Demo data demonstrates both on-track and over-budget scenarios

Registration:
  13. Create new account → redirects to Overview
  14. New account starts empty (no demo data)
```

### T5.4 Mobile responsive (Step 19)

```
Test: All pages at 375px viewport width

For each page (Overview, Budgets, Spending, Annual Plan, Debts,
Transactions, Monthly Review, Accounts, Categories):

  1. Page loads without horizontal scrollbar on body
  2. All text is readable (no truncation that hides meaning)
  3. All buttons are tappable (min 44px height)
  4. Cards stack vertically (not overflow horizontally)
  5. Tables either scroll horizontally within container or hide non-essential columns
  6. Charts resize properly
  7. Sidebar collapses to hamburger menu (not visible by default)
  8. Hamburger menu opens and shows all nav items
  9. Forms are usable (inputs full width, dropdowns work)

Specific checks:
  10. Overview: True Remaining hero card full width, breakdown readable
  11. Budgets: Fixed/Flexible/Annual sections stack, progress bars scale
  12. Transactions: table scrollable, Date and Amount always visible
  13. Annual Plan: forecast chart readable, expense cards stack
  14. Debts: debt cards stack, P&I numbers readable
  15. Monthly Review: trajectory metrics stack, efficiency ring scales
```

-----

## Final Verification (Step 20)

*Every test from every phase, run one more time.*

```
Run all tests: T1.1 through T5.4

Additionally verify:
  1. npm run build → zero errors, zero warnings that indicate broken functionality
  2. npm run db:seed-demo → creates full demo state without errors
  3. Lighthouse performance score > 70 on Overview page
  4. No console errors on any page during normal navigation
  5. Auth flow: register → login → use app → logout → login again
  6. Data isolation: User A cannot see User B's data
```

-----

## Test Status Tracker

Update this as phases complete:

|Phase              |Tests    |Status|
|-------------------|---------|------|
|Phase 1: Foundation|T1.1–T1.4|⬜     |
|Phase 2: Data Model|T2.1–T2.3|⬜     |
|Phase 3: Experience|T3.1–T3.5|⬜     |
|Phase 4: Plaid     |T4.1–T4.3|⬜     |
|Phase 5: Brand/Ship|T5.1–T5.4|⬜     |
|Final Verification |All      |⬜     |
