# Oversikt — Test Specifications

*Paired with `/docs/PRD.md` v2.17*
*This file lives at `/docs/TESTS.md`*

---

## How to use this document

After completing each phase in the PRD, Claude Code runs the corresponding test section below. Tests are a mix of:

- **DB tests** — query the database directly to verify data integrity
- **API tests** — hit endpoints and verify responses
- **UI tests** — check rendered pages for correct content
- **Regression tests** — confirm nothing broke from previous phases

Claude Code runs these in the terminal using the app's existing stack (Prisma, Next.js API routes, and browser checks via curl or a test script). For UI verification, Claude Code can use the dev server and check rendered HTML or describe what to verify manually.

**Pass criteria:** Every test in a phase must pass before starting the next phase. If a test fails, fix it within the current phase scope — don't move forward.

---

## Phase 1 Tests: Fix the Foundation

*Run after Steps 1–10 are complete.*

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

### T1.3 CSV import sign logic (Step 3)

```
Test: Income amounts stay positive, expense amounts stored negative

Setup: Import a CSV with a known income row (e.g., Ledyard Bank, 1583.33,
category "Other Income") and a known expense row (e.g., 365 Retail, 2.12,
category "Groceries")

Verify:
  1. After import: Ledyard Bank transaction amount = +$1,583.33 (positive)
  2. After import: 365 Retail transaction amount = -$2.12 (negative)
  3. Transactions page: Ledyard Bank shows green +$1,583.33
  4. Transactions page: 365 Retail shows ember -$2.12
  5. DB query: no transactions where category type=income AND amount < 0
  6. DB query: no transactions where category type=expense AND amount > 0

Edge case:
  7. CSV with negative income value (e.g., -1583.33 for "Other Income")
     → stored as +$1,583.33 (absolute value, forced positive by category type)
  8. CSV with positive expense value (e.g., 2.12 for "Groceries")
     → stored as -$2.12 (forced negative by category type)
```

### T1.4 CSV column mapping — Person and Property (Step 4)

```
Test: Person and Property appear in mapping dropdown

Verify:
  1. Upload a CSV → mapping screen shows
  2. Dropdown options include: Date, Merchant, Amount, Category, Account, Person, Property, Ignore
  3. Map "Owner" column → Person → transactions get householdMemberId set
  4. If mapped Person value doesn't match existing household member → auto-create member
  5. If Person column is not mapped → transactions get householdMemberId = null
  6. If Property column is not mapped → transactions get propertyId = null
  7. If Property column IS mapped → values match/create properties, transactions linked
```

### T1.5 CSV account linking (Step 5)

```
Test: Account column values create and link accounts

Setup: CSV has an Account column with values like "Adv Plus Banking (...6809)",
"Venture X (...3346)"

Account creation and linking:
  1. Map Account column → Account in dropdown
  2. After import: each unique account value creates an Account record (if new)
  3. After import: every transaction has accountId set (no "—" in Account column)
  4. If Account column mapped AND "Import into account" is "No account":
     per-row values take priority
  5. If Account column NOT mapped AND "Import into account" has a selection:
     all transactions link to that account
  6. Accounts page shows newly created accounts with correct names

Account type detection (R1.5a):
  7. "Platinum Card (...3008)" → type = Credit Card (not Checking)
  8. "Venture X (...3346)" → type = Credit Card
  9. "SAVINGS (...6118)" → type = Savings
  10. "Rewards Checking (...8503)" → type = Checking
  11. Unknown names → type = Other (not Checking)
  12. Type dropdown on edit: Checking, Savings, Credit Card, Investment, Loan, Other

Account balance (R1.5b):
  13. CSV-imported accounts: balance = $0.00 by default (NOT sum of transactions)
  14. Rewards Checking does NOT show -$174,425.78
  15. Platinum Card does NOT show -$446,144.65
  16. User can manually set balance via Edit on Accounts page
  17. All balances display 2 decimal places — never raw floats like -446144.6499999997
  18. Plaid-connected accounts: balance from API (tested in Phase 4)
```

### T1.6 CSV category matching (Step 6)

```
Test: Imported categories match existing categories and groups

Setup: Ensure existing categories exist (Groceries in Food & Dining,
Gas in Auto & Transport, Insurance in Financial, etc.)
Import a CSV with categories matching those names.

Verify:
  1. After import: "Groceries" transactions use existing Groceries category
     (not a new "Groceries" under "Imported")
  2. Spending Breakdown shows proper groups (Food & Dining, Housing, etc.)
     — NOT a single "Imported" group
  3. Donut chart shows multiple colored segments by group
  4. Category matching is case-insensitive ("groceries" matches "Groceries")
  5. Unmatched categories create new entries assigned to best-fit group
  6. No "Imported" category group exists after import
  7. Categories page shows all imported categories in correct groups
```

### T1.7 Transaction classification (Step 7)

```
Test: Transfers excluded from spending, reclassifiable

Setup: Import transactions including "Transfer", "Credit Card Payment",
income categories ("Other Income", "Paychecks"), and expense categories.

Verify classification defaults:
  1. Transaction model has `classification` field: 'expense' | 'income' | 'transfer'
  2. Categories named "Transfer", "Credit Card Payment" → classification = transfer
  3. Income categories → classification = income
  4. All other categories → classification = expense

Verify spending exclusion:
  5. Spending Breakdown total does NOT include transfer-classified transactions
  6. Budget spent calculations exclude transfers
  7. "92 expense transactions" count excludes transfers
  8. With transfers excluded, total spending should be ~$3,979
     (not $26,862 which includes $19K+ in transfers)

Verify reclassification:
  9. On Transactions page: user can change classification of any transaction
  10. Reclassify a Zelle transfer as income → it appears in income totals
  11. Reclassify back to transfer → removed from income totals
  12. Transfers page/filter: can view all transfer-classified transactions

Verify on Spending page:
  13. By Category view excludes transfers
  14. By Person view excludes transfers
  15. By Property view excludes transfers
```

### T1.8 Auto-categorization (Step 8)

```
Test: New transactions auto-categorize by merchant history

Setup: Import transactions, manually categorize "WEBSTER BANK PAYROLL" as
Paychecks (income). Then import a new CSV or simulate Plaid sync with
another "WEBSTER BANK PAYROLL" transaction.

Merchant history matching:
  1. Second "WEBSTER BANK PAYROLL" transaction auto-categorized as Paychecks
  2. Classification auto-set to income (not transfer, even if it hits a credit card)
  3. Merchant match is case-insensitive
  4. If user later recategorizes a merchant, new transactions use the latest category

No match behavior:
  5. Transaction from never-seen merchant → Uncategorized
  6. Uncategorized transaction does NOT auto-classify as transfer
  7. User categorizes it once → future transactions from that merchant auto-match

Never amount-based:
  8. Two merchants with identical amounts ($3,600) categorize independently
  9. No "rules" UI for amount-based matching exists
  10. Same merchant with different amounts still matches (paycheck amount changes)

Plaid metadata (when available):
  11. Plaid transaction with payroll transaction_code → hint toward Paychecks
  12. Merchant history takes priority over Plaid hint if both exist
  13. Plaid hint used only when no merchant history exists
```

### T1.9 Migration — fix existing data (Step 9)

```
Test: One-time migration corrects historical sign errors and classifies transactions

Before migration:
  1. Query: SELECT count(*) FROM Transaction t JOIN Category c ON t.categoryId = c.id
     WHERE c.type = 'income' AND t.amount < 0
     → should return > 0 (e.g., Ledyard Bank)

Run migration script.

After migration:
  2. Same query → returns 0
  3. Ledyard Bank transaction: amount = +$1,583.33
  4. Dividend Received: amount = +$64.31 (was already correct, unchanged)
  5. Groceries transactions: all still negative
  6. All "Transfer" category transactions: classification = 'transfer'
  7. All "Credit Card Payment" transactions: classification = 'transfer'
  8. All income category transactions: classification = 'income'
  9. All other transactions: classification = 'expense'
  10. Overview page totals reflect corrected signs and exclude transfers
  11. Spending Breakdown total drops from ~$26K to ~$3-5K range
```

### T1.10 AI Insights with corrected data (Step 10)

```
Test: Insights reflect accurate budget data

Verify:
  1. "Generate Insights" / "Generate Review" button triggers successfully
  2. Response returns within reasonable time (<30s)
  3. The "$2,823 Spent Outside Your Budget" alert is gone or significantly reduced
  4. Efficiency score sub-components have changed from pre-fix values
  5. API error handling: graceful error message on failure, not crash
  6. Dismiss flow works: dismiss an insight → it doesn't reappear
```

### T1.11 Unbudgeted categories surfaced (R6.7)

```
Test: Categories with transactions but no budget appear on Budgets page

Setup:
  - Ensure at least one category has transactions but no budget entry

Verify:
  1. Budgets page has an "Unbudgeted" or "Other Spending" section
  2. Each unbudgeted category shows: name, actual spend this month
  3. User can click to create a budget from the unbudgeted entry
  4. Total unbudgeted spending amount shown
  5. This section does NOT include income categories (only expense)
  6. This section does NOT include transfer-classified transactions
```

### T1.12 AI Budget Builder regeneration (R6.4a)

```
Test: AI Budget Builder works when budgets already exist

Setup: Budgets page with existing fixed and flexible budgets

First use (no budgets):
  1. Click "AI Budget Builder" → generates budget suggestions
  2. Suggestions appear for review before applying

With existing budgets:
  3. Click "AI Budget Builder" → does NOT silently do nothing
  4. Modal/menu offers options: "Regenerate all", "Add missing", or Cancel
  5. "Regenerate all" → confirmation dialog ("This will replace X existing budgets")
  6. Confirm → existing budgets replaced with new AI suggestions
  7. "Add missing" → only creates budgets for categories that have
     transactions but no budget (fills gaps without touching existing)
  8. Cancel → no changes, returns to Budgets page
  9. After regeneration: Budgets page reflects new values immediately
```

### T1.13 Paycheck sign regression (R1.11)

```
Test: All income transactions have positive amounts

Setup: Database with existing imported transactions

Audit:
  1. Query all transactions where classification = 'income'
  2. ZERO results should have negative amounts
  3. Query all transactions where category type = 'income' (category.type)
  4. ZERO results should have negative amounts
  5. Specifically check January paychecks — all positive
  6. Migration handles edge cases: transactions with income category
     but expense classification, or vice versa

Fix verification:
  7. Run migration → count of flipped records logged
  8. Re-query: zero negative income transactions
  9. Budget and spending totals on Overview reflect corrected values
```

### T1.14 CSV import account default (R1.12)

```
Test: "Import into account" dropdown defaults to no selection

  1. Navigate to CSV import page
  2. "Import into account" dropdown shows placeholder ("Select account..." or blank)
  3. Does NOT pre-select any existing account
  4. If user does not select account AND Account column not mapped → validation error
  5. If Account column is mapped → per-row values used, dropdown ignored
```

### T1.15 Category connection audit (R1.13)

```
Test: All transactions link to valid categories

  1. Query transactions where categoryId is NULL → should be zero (or only truly uncategorized)
  2. Query transactions where categoryId points to non-existent category → zero
  3. No duplicate categories with same name for same user
  4. Each category belongs to exactly one group
  5. On CSV re-import: "Groceries" maps to existing Groceries, doesn't create duplicate
  6. Category page shows correct transaction counts per category
```

### T1.16 Overview Cash Available + Account Balances (R1.14, R1.5b)

```
Test: Overview displays "Cash Available" and account balances work correctly

Cash Available card:
  1. Overview shows "Cash Available" (not "Total Balance across N accounts")
  2. Cash Available = sum of balances for Checking + Savings accounts ONLY
  3. Credit Card, Loan, Investment accounts excluded from Cash Available
  4. With no baselines entered, Cash Available = $0

Account baseline balances:
  5. Account edit form has "Current balance" and "Balance as of" date fields
  6. Enter $5,200 as of Feb 25, 2026 for checking account
  7. Account balance = $5,200 immediately
  8. New transaction on Feb 26 for -$50 → balance adjusts to $5,150
  9. Transactions before the as-of date do NOT affect balance
  10. Plaid accounts: balance comes from API, baseline fields hidden

No recalculate endpoint:
  11. No "Recalculate Balances" button in Settings
  12. No POST /api/accounts/recalculate endpoint

Income/Expenses:
  13. Total Income = sum of income-classified transactions for current month
  14. Total Expenses = sum of expense-classified transactions for current month
  15. Transfers excluded from both
  16. True Remaining consistent with Budgets page
```

### T1.17 Data integrity audit (R1.15)

```
Test: Comprehensive data consistency check

Run after R1.11–R1.14 fixes:
  1. Every transaction has: non-null categoryId, non-null accountId, 
     non-null classification, amount with correct sign
  2. No orphaned categoryIds (pointing to deleted categories)
  3. No duplicate categories per user (same name, case-insensitive)
  4. Income transactions: positive amounts, classification = 'income'
  5. Expense transactions: negative amounts, classification = 'expense'
  6. Transfer transactions: classification = 'transfer', excluded from totals
  7. Account balances: CSV accounts = manually entered or $0, no transaction sums
  8. All monetary displays: 2 decimal places, no floating point artifacts
```

### T1.18 Ground truth verification (R1.15)

```
Test: App numbers match source CSV for February 2026

Source CSV has 4,825 transactions. After all fixes:

February 2026 expected values (from CSV analysis):
  1. Income ≈ $7,284 (Paychecks + Other Income + Interest + Dividends)
  2. Expenses ≈ $3,932 (all non-transfer, non-CC-payment, non-income)
  3. Transfer total ≈ $761 (Transfer + Credit Card Payment categories)
  4. Overview Income card shows ≈ $7,284, NOT $5,048
  5. Overview Expenses card shows ≈ $3,932, NOT $26,863
  6. Total Balance = sum of account.balance fields (all $0 for CSV), NOT $3,520,319
  7. Spending page: categories across MULTIPLE groups, NOT 1 "Imported" group
  8. Fixed Bills: Mortgage actual ≈ matches ONLY Mortgage-categorized transactions
  9. Net this Month ≈ $3,352 surplus, NOT -$21,815 deficit

Household members:
  10. Exactly ONE "Caroline" (no duplicates)
  11. No "Cgrubbs14" entry

Monthly Review:
  12. No "Excessive" or "High" colored labels on benchmarks
```

---

*Run after Steps 11–13 are complete.*

### T2.1 Household members (Step 11)

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

Account-person linking (R3.2a):
  15. Accounts page: each account has optional "Owner" dropdown (household members)
  16. Set Platinum Card owner → "Gavin" — all Platinum Card transactions default person = Gavin
  17. Set Venture X owner → "Cgrubbs14" — all Venture X transactions default person = Cgrubbs14
  18. Per-transaction person tag overrides account-level default
  19. Changing account owner updates future imports only (not retroactive unless user chooses)
```

### T2.2 Property tagging (Step 12)

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

### T2.3 Debts page (Step 13)

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

Client state (R5.7):
  21. Add new debt → debt appears in list immediately WITHOUT page refresh
  22. Edit existing debt → changes reflected immediately
  23. Delete debt → removed from list immediately

Regression:
  24. All Phase 1 tests still pass
```

---

## Phase 3 Tests: Reshape the Experience

*Run after Steps 14–21 are complete.*

### T3.1 Overview redesign (Step 14)

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

### T3.2 Navigation restructure (Step 15)

```
Test: Nav matches PRD spec

Verify nav order:
  1. Section 1 (daily): Overview, Budgets, Spending, Annual Plan, Debts, Transactions
  2. Section 2 (periodic): Monthly Review
  3. Section 3 (setup): Settings, Accounts, Categories
  4. Spacing or divider between sections (not header labels)
  5. "Insights" text appears nowhere in nav — replaced by "Monthly Review"
  6. /insights route redirects to /monthly-review (or equivalent)
  7. Debts appears in nav and links to /debts
  8. Settings appears in nav and links to /settings
  9. All nav links work and load correct pages
```

### T3.3 Settings page (Step 16)

```
Test: Settings page consolidates all setup functions

Profile:
  1. Current name and email displayed
  2. Edit name → saves, reflected in sidebar/welcome message
  3. Change email → saves, new email works for login
  4. Change password → requires current password, validates new password, saves
  5. Invalid current password → rejected with error

Household members:
  6. List of existing household members displayed
  7. Add member → appears in list and in transaction Person dropdown
  8. Edit member name → updated everywhere
  9. Delete member → removed, transactions with that member set to null
  10. "Shared" or default member clearly indicated
  11. Add duplicate name "Caroline" when "Caroline" exists → validation error, not silent duplicate
  12. Name matching is case-insensitive ("caroline" matches "Caroline")

Properties:
  11. List of existing properties displayed
  12. Add property with name + type (Personal/Rental) → appears in list
  13. Edit property → updated everywhere
  14. Delete property → removed, transactions set to null
  15. Default property (Personal) clearly indicated
  16. Add duplicate name "Nicoll St Duplex" when it exists → validation error, not silent duplicate

Connected accounts:
  16. List of Plaid-connected institutions shown (after Plaid is built)
  17. "Disconnect" button per institution → removes Plaid link
  18. Manual accounts not shown here (managed on Accounts page)

Data export:
  19. "Export transactions" button → downloads CSV
  20. CSV includes: date, merchant, category, amount, person, property, account

Delete account:
  21. "Delete my account" button → confirmation dialog with "type DELETE to confirm"
  22. Confirmed deletion → removes all user data, redirects to landing page
  23. Deleted user cannot log in again
```

### T3.4 Spending views (Step 17)

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

Click-through (R3.3a):
  9. Tap person name on By Person → Transactions filtered by that person + month
  10. Tap property name on By Property → Transactions filtered by that property + month

Transactions page:
  11. Property filter dropdown exists above table
  12. Selecting a property filters the transaction list
  13. Person column is visible and filterable
```

### T3.5 Mortgage escrow (Step 18)

```
Test: Escrow field on Debt model and UI

Schema:
  1. Debt model has escrowAmount Float? field

Add/Edit form:
  2. When debt type = MORTGAGE: "Monthly Escrow (taxes & insurance)" field appears
  3. Field is optional — can be left blank
  4. Non-mortgage debt types: escrow field does not appear
  5. "Monthly payment" field captures total amount user pays (e.g., $4,400)

Debt card display:
  6. If escrow is set: P&I = monthly payment minus escrow ($4,400 - $800 = $3,600)
  7. Payment breakdown bar shows three segments:
     - Green: Principal (computed from P&I amortization)
     - Ember: Interest (computed from P&I amortization)
     - Gray: Escrow (e.g., $800)
  8. Total monthly cost label shows full payment ($4,400.00/mo)
  9. Payoff math uses P&I only ($3,600) — escrow doesn't reduce balance
  7. If escrow is null: bar shows only P&I (unchanged from current)

Summary:
  8. Total Monthly Payments in summary includes escrow amounts
  9. Escrow does NOT affect debt balance, payoff progress, or est. remaining
```

### T3.6 Category click-through (Step 19)

```
Test: Tap category → filtered transaction list

Budgets page — Fixed:
  1. Tap "Mortgage Payment" → navigates to Transactions filtered by
     Mortgage category + current month
  2. URL includes query params (e.g., /transactions?category=X&month=2026-02)

Budgets page — Flexible:
  3. Tap "Groceries" → Transactions filtered by Groceries + current month
  4. Transaction count matches the spent amount on Budgets page

Budgets page — Unbudgeted:
  5. Tap an unbudgeted category → same filtered view

Spending page:
  6. Tap any category in spending breakdown → filtered Transactions

Navigation:
  7. Back button or breadcrumb returns to previous page
  8. Filters are pre-applied on arrival (category dropdown shows correct value)
```

### T3.7 Monthly snapshots (Step 20)

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

### T3.8 Monthly Review trajectory (Step 21)

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

Recommendation action loop (R7.5a):
  14. Mark complete → text field for action notes appears
  15. Submit → record saved with: recommendation text, user notes, timestamp, projected savings
  16. Completed recommendations visible in Monthly Review history/completed section
  17. Next AI-generated review includes completion context in prompt
  18. AI follows up on whether savings materialized (compares category spend before/after)
  19. AI does NOT re-suggest completed optimizations

  20. Dismiss → structured reason picker appears (existing UI works)
  21. Select reason → record saved with: recommendation text, dismiss reason, timestamp
  22. "Other reason" freetext included in saved record
  23. Next AI-generated review includes dismiss context in prompt
  24. AI does NOT re-suggest dismissed items
  25. AI adapts to user preferences learned from dismiss patterns

De-emphasize benchmarks (R7.3a):
  26. "Spending vs Benchmark" section removed or moved below fold with caveat
  27. No "Excessive" / "High" labels based on context-free national medians
```

### T3.9 Transaction-debt linking (R5.8)

```
Test: Transactions can be linked to debts

Schema:
  1. Transaction model has optional debtId field
  2. Debt model has relation to linked transactions

Linking:
  3. On transaction edit, debt dropdown shows user's debts
  4. Link $8,000 payment to "Student Loan" debt
  5. Linked transaction visible from Debts page → click debt → payment history
  6. Debt currentBalance reflects linked payments (reduced by payment amounts)
  7. Unlinking a transaction restores the balance

Classification:
  8. Debt payments classified as expenses, not transfers
  9. Debt payments appear in budget/spending if category assigned
  10. Annual Plan can track debt payment categories

Edge cases:
  11. Same transaction cannot link to multiple debts
  12. Deleting a debt unlinks all associated transactions (doesn't delete them)
```

### T3.10 Monthly Review time-scoping (R7.8)

```
Test: Monthly Review scoped to specific month with click-through

Month selection:
  1. Monthly Review defaults to current month
  2. Month selector allows navigation to any previous month
  3. All data blocks update when month changes
  4. AI-generated content reflects selected month's data

Click-through:
  5. Tap spending category block → Transactions filtered by category + selected month
  6. Tap debt payment block → Transactions filtered by debt-linked transactions + month
  7. Tap person breakdown → Transactions filtered by person + month
  8. Tap property breakdown → Transactions filtered by property + month
  9. Back navigation returns to Monthly Review at same month

Data accuracy:
  10. January review shows January transactions only
  11. $8K student loan payment appears in correct month (Jan or Feb)
  12. Spending totals match Spending page for same month
```

### T3.11 Overview navigation (R8.5)

```
Test: All Overview clickable elements work

  1. "View all" on recent transactions → navigates to Transactions page
  2. "View all" on budget section → navigates to Budgets page
  3. All other clickable cards/buttons on Overview navigate correctly
  4. No dead links or non-functional buttons
```

### T3.12 Net Worth on Monthly Review (R7.9)

```
Test: Net Worth section appears on Monthly Review with trend

  1. Monthly Review shows "Net Worth" section
  2. Net Worth = assets (Checking + Savings + Investment balances) minus liabilities (Credit Card + Loan balances)
  3. Monthly snapshot captures net worth value
  4. Trend line shows net worth over time (month-over-month)
  5. Shows delta from previous month ("up $X" or "down $X")
  6. Net Worth does NOT appear on Overview page
  7. With no account baselines entered, net worth = $0
```

---

## Phase 4 Tests: Bank Connectivity

*Run after Steps 22–24 are complete.*

### T4.1 Plaid API routes (Step 22)

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

### T4.2 Plaid Link UI (Step 23)

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

### T4.3 Daily sync cron (Step 24)

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

---

## Phase 5 Tests: Security, Brand, and Ship

*Run after Steps 25–29 are complete.*

### T5.0 Security hardening (Step 25)

```
Test: All R11 requirements met

Authentication:
  1. grep -ri "password" src/ → no plaintext storage, only bcrypt hashes
  2. JWT stored in HttpOnly cookie (not localStorage)
     Check: document.cookie in browser console should NOT show the token
     Check: Set-Cookie response header includes HttpOnly, Secure, SameSite=Strict
  3. Token expiry: decode JWT → exp claim is ~1 hour from issue
  4. Login rate limiting: attempt 6 logins with wrong password →
     6th attempt returns 429 Too Many Requests
  5. Register rate limiting: attempt 4 registrations from same IP →
     4th attempt returns 429

Data isolation:
  6. Create User A and User B with different transactions
  7. As User A: GET /api/transactions → only User A's data
  8. As User A: GET /api/transactions/[User-B-transaction-id] → 404 or 403
  9. As User A: GET /api/budgets → only User A's budgets
  10. As User A: GET /api/debts → only User A's debts
  11. No API endpoint accepts userId as a query parameter

Plaid security:
  12. In database: plaid access_token column is encrypted (not readable plaintext)
  13. GET any API endpoint → response body never contains access_token or item_id
  14. Frontend code (grep src/): no reference to access_token
  15. PLAID_ENCRYPTION_KEY exists in env vars

AI data handling:
  16. Find the Anthropic API call in the codebase
  17. Read the prompt construction: verify it sends aggregated summaries
  18. Verify NO bank account numbers in prompt
  19. Verify NO Plaid tokens in prompt
  20. Verify NO email addresses or passwords in prompt
  21. Verify NO internal database IDs in prompt

Infrastructure:
  22. .env is in .gitignore
  23. grep -r "sk-ant\|sk_live\|PLAID_SECRET" src/ → 0 results
  24. .env.example exists with placeholder values
  25. No http:// URLs in source code (all https://)
  26. No prisma.$queryRaw calls without parameterization

Security page:
  27. /security page exists and is publicly accessible
  28. Content covers: bank credentials (Plaid), data encryption, AI handling, no data sales
  29. Linked from landing page footer
```

### T5.1 Rebrand (Step 26)

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

### T5.2 Domain (Step 27)

```
Test: App accessible at new domain

Verify:
  1. GitHub repo URL is github.com/gavinarnold1-ctrl/oversikt (or redirects)
  2. App loads at oversikt.app (or oversikt.vercel.app)
  3. HTTPS works (no certificate errors)
  4. Old URL (clear-path-wheat.vercel.app) redirects or is decommissioned
```

### T5.3 Landing page and demo (Step 28)

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

### T5.4 Mobile responsive (Step 29)

```
Test: All pages at 375px viewport width

For each page (Overview, Budgets, Spending, Annual Plan, Debts,
Transactions, Monthly Review, Settings, Accounts, Categories):

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
  16. Settings: all sections accessible, forms usable, delete confirmation works
```

---

## Final Verification (Step 30)

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
  7. Security page accessible from landing page footer
  8. Settings page: all sections render and save correctly
```

---

## Test Status Tracker

Update this as phases complete:

| Phase | Tests | Status |
|-------|-------|--------|
| Phase 1: Foundation | T1.1–T1.18 | 🔴 T1.13–T1.18 new; T1.1–T1.5 REGRESSION (re-verify) |
| Phase 2: Data Model | T2.1–T2.3 | 🟢 |
| Phase 3: Experience | T3.1–T3.12 | 🔴 T3.9–T3.12 new (debt linking, review, overview, net worth) |
| Phase 4: Plaid | T4.1–T4.3 | ⬜ |
| Phase 5: Security/Brand/Ship | T5.0–T5.4 | ⬜ |
| Final Verification | All | ⬜ |
