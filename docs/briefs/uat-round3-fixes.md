# UAT Round 3 Fixes

## Context
UAT Round 3 on the follow-up fixes. 5/7 features working but with issues. 2 bugs remain. Read the brief at docs/briefs/uat-round2-bugs.md for original context. Run all tests after each fix. Current: 419/432 (13 pre-existing).

## Fixes (7 items)

### 1. Annual Click-Through Wrong Category Mapping
**Bug:** Home & Property Maintenance click-through navigates to Auto Maintenance transactions. The category lookup/mapping is wrong.

**Fix:** The click-through link from annual budget rows must use the exact category ID or exact category name from the annual expense item, not a fuzzy match. Debug the mapping between the annual expense categoryId and the transaction filter URL parameter. Likely the query is matching on a substring ("Maintenance") instead of the full category name.

**Acceptance:** Clicking "Home & Property Maintenance" on the Annual Plan page shows ONLY Home & Property Maintenance transactions. Every annual category maps to the correct transaction filter.

### 2. Annual Plan — Transaction Tracking Bar + Category-Agnostic Architecture
**Bug:** Linked transactions appear in the list view but do NOT show in the progress/tracking bar for that annual plan item.

**Fix (tracking bar):** The progress bar should calculate from the sum of linked transactions (the AnnualExpenseTransaction join table) vs the budgeted amount. Query the actual linked transactions, not category-filtered transactions.

**Design change (category-agnostic):** Annual plan items should NOT track spending by category. A user might spend $60 at Home Depot for home improvement AND $60 at Home Depot for a gift — different annual plan items. The tracking should be driven entirely by the AnnualExpenseTransaction linked records, not by category matching. The progress bar, spent amount, and remaining amount should all derive from linked transactions only.

**Acceptance:**
* Progress bar reflects the sum of linked transactions for that specific annual plan item
* A transaction linked to "Home Improvement" does not also count toward "Gifts" even if same merchant
* Unlinking a transaction updates the progress bar immediately

### 3. Flexible Budget UX Improvements
Three changes:

**a) Move Unallocated Flexible to bottom:** Currently at top of flexible section. Move it to the bottom — it's the catch-all, not the hero. Named budgets should be listed first.

**b) Add flexible budget tracking rollup:** At the TOP of the flexible section, add a summary row showing: "Flexible Budget: $X spent of $Y" with a progress bar. This is the rollup — total flexible spending vs total flexible budget. The user needs to see what they're tracking toward across all flexible categories.

**c) Remove empty catch-all rows:** If Miscellaneous, Personal, Other, or Uncategorized categories have $0 spending, do not render them as separate rows. Their $0 doesn't add value. Only show them if they have actual spending that flowed into them.

**Acceptance:**
* Flexible section order: rollup summary → named budgets (sorted) → unallocated flexible (bottom)
* Rollup shows total flexible spent vs total flexible budget with progress bar
* Empty catch-all categories are hidden

### 4. Account Balance Calculation Bug
**Bug:** After saving an account edit, the balance calculates incorrectly. The balance should be: known_balance + sum(transactions after known_balance_date). Currently appears to calculate from initial balance plus all transactions regardless of date.

**Fix:** In the account balance computation logic:
1. Use the balanceDate (the date the user last confirmed the balance) as the anchor
2. The balance field stores the known balance as of that date
3. Current balance = balance + sum of all transactions AFTER balanceDate
4. Transactions ON balanceDate should NOT be included (the known balance already accounts for them)

**Acceptance:** Edit an account, set balance to $5,000 as of Feb 1. If there are $500 in transactions after Feb 1, current balance should show $4,500 (or $5,500 depending on credit/debit direction). Transactions before or on Feb 1 should not affect the calculation.

### 5. Refund Detection Fix
**Bug:** Credit card payments are being flagged as refunds. A payment TO a credit card is a transfer, not a refund.

**Fix:** Refund detection logic must require ALL of:
* The transaction is a credit (positive amount / money coming back)
* There exists a prior debit transaction from the same merchant (not just same account)
* The credit amount is close to the debit amount (within 20% or exact match)
* The credit is NOT from a financial institution / credit card company (exclude merchants matching patterns like: "Payment", "Credit Card", "Bank", "Transfer", "ACH", known bank names)

Add an exclusion list for payment/transfer merchants. Credit card payments, bank transfers, ACH transfers, and loan payments should never be flagged as refunds.

**Acceptance:**
* A $50 credit from "Target" after a $50 debit from "Target" → flagged as refund ✅
* A $2,500 payment to "Chase Credit Card" → NOT flagged as refund ✅
* A $1,000 ACH transfer → NOT flagged as refund ✅

### 6. Smart Category Learning v2 — Multi-Signal Matching
**Bug:** Current matching uses merchant name only. This is too naive. Example: a paycheck deposited via Amex gets matched, then ALL Amex transactions get categorized as "Paycheck."

**Fix:** Upgrade UserCategoryMapping model to include additional matching signals:

```prisma
model UserCategoryMapping {
  id             String   @id @default(cuid())
  userId         String
  merchantName   String
  categoryId     String
  confidence     Float    @default(1.0)
  timesApplied   Int      @default(1)
  // NEW fields for multi-signal matching:
  direction      String?  // "credit" or "debit" — null means match both
  amountMin      Float?   // minimum amount range — null means no floor
  amountMax      Float?   // maximum amount range — null means no ceiling
  descKeywords   String?  // comma-separated keywords from description — null means ignore
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user           User     @relation(fields: [userId], references: [id])
  category       Category @relation(fields: [categoryId], references: [id])

  @@unique([userId, merchantName, direction, categoryId])
}
```

**Matching logic:**
1. When user reclassifies a transaction, capture: merchant name, direction (credit/debit), amount (set range as amount ± 25%), and description keywords
2. On match attempt: merchant name must match AND direction must match (if set) AND amount must be within range (if set)
3. Confidence scoring: exact merchant + direction + amount range = 1.0 (auto-apply). Merchant only = 0.7 (still apply but lower confidence). Partial matches below 0.7 = don't apply.
4. Settings UI should show the additional context: "Target (debit, $30-$80) → Groceries"

**Acceptance:**
* Recategorize a $4,200 credit from "Amex" as "Paycheck" → mapping stores direction=credit, amountMin=$3,150, amountMax=$5,250
* A subsequent $50 debit from "Amex" → does NOT get auto-categorized as "Paycheck" (direction mismatch)
* A subsequent $4,200 credit from "Amex" → DOES get auto-categorized as "Paycheck"

### 7. Expected Income Intelligence
**Enhancement:** Expected monthly income should be a stable baseline number representing regular salary/wages. When actual income in a month exceeds expected income, surface a financial intelligence prompt.

**Implementation:**
1. The expectedMonthlyIncome field on UserProfile already exists — keep it as the stable baseline
2. On the dashboard, compare actual income this month vs expected:
   * If actual <= expected: show normally ("$4,200 of $4,500 expected")
   * If actual > expected: highlight the surplus with a card/banner: "You received $X more than expected this month" with suggested actions (pay down debt, invest, add to annual fund, save for emergency). This is informational only — no action buttons needed for V1, just the insight.
3. The "edit" button for expected income should make it clear this is your regular monthly income, not a one-time number. Label: "Expected Monthly Income (salary/wages)"

**Acceptance:**
* Setting expected income to $4,500 and having $6,000 actual income shows a surplus insight
* The surplus message suggests constructive uses for the extra money
* Expected income label is clear that it means regular/recurring income

## General Instructions
* Run full test suite after each fix
* Do not break existing passing tests
* Commit the brief docs/briefs/uat-round3-fixes.md with a copy of these requirements
* Target: 419/432 minimum (maintain, don't regress)
