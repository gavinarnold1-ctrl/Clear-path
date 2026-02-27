# UAT Round 3 Follow-Up Fixes

## Context
UAT Round 3 results: 3/7 fully passed (account balance, income surplus, flexible UX), 4/7 need follow-up work. Plus two regressions and a new feature request. Read docs/briefs/uat-round3-fixes.md for Round 3 context. Current: 419/432 tests (13 pre-existing).

## Fixes (6 items)

### 1. Annual Click-Through — Hard Debug Required
**Bug:** Annual budget row click-through STILL maps to the wrong category. "Home & Property Maintenance" navigates to "Auto Maintenance" transactions. This was reported in R2 and R3 and the fix didn't resolve it.

**Root cause investigation required:**
1. Inspect the actual URL/query parameter generated when clicking an annual budget row
2. Trace where the categoryId or category name is resolved for the navigation link
3. Check if the annual expense categoryId is pointing to the wrong category record in the database, or if the link component is using a different field
4. Log the exact category name and ID at each step: annual expense record → link generation → transaction filter

**Fix:** The navigation must use the annual expense item's own categoryId directly — not look up a category by name, not do any fuzzy matching, not do substring matching. Direct ID pass-through.

**Acceptance:** Every annual budget row click navigates to transactions matching that exact category. Test specifically: "Home & Property Maintenance" → shows only Home & Property Maintenance transactions.

### 2. Annual Plan Duplicate Prevention Regression
**Bug:** Transactions that are already linked to one annual plan item are appearing in the LinkTransactionModal for other annual plan items. The 409 server-side check may still work, but the client-side filtering regressed — transactions should not even be selectable if they're already claimed.

**Fix:**
1. In LinkTransactionModal, query which transactions are already linked to ANY AnnualExpense (not just the current one)
2. Filter those out of the available list entirely — they should not appear
3. If a transaction is already linked, it belongs to one and only one annual plan item
4. The server 409 is a safety net, not the primary UX — the modal should never show already-linked transactions

**Acceptance:** Link transaction A to "Car Maintenance." Open link modal for "Home Improvement." Transaction A should not appear in the list at all.

### 3. Annual Plan — Separate Spent vs Funded Tracking
**Bug:** Linking a transaction currently updates both Spent AND Funded simultaneously. These are two different concepts:
* Spent = actual transactions linked to this annual item (money already gone)
* Funded = money set aside / allocated to this annual item (saving toward it)

**Implementation:**
1. Add a fundedAmount field to AnnualExpense (Float, default 0). This is the manually-set funded amount, independent of linked transactions.
2. The progress section should show TWO indicators:
   * Funded: $X of $Y budgeted (how much is saved/set aside) — shown as a primary progress bar
   * Spent: $X (sum of linked transactions) — shown as an overlay or secondary indicator on the same bar, different color
3. Linking a transaction increases Spent only. Funded stays unchanged.
4. User can manually adjust Funded via an "Add Funds" button or inline edit on each annual plan item.
5. If Spent > Funded, show a warning (you've spent more than you saved for this item)

**Visual design:**
* Progress bar background = total budgeted amount
* Green/pine fill = funded amount
* Ember overlay or marker = spent amount
* If spent > funded, the ember portion extends past green (overspent indicator)

**Acceptance:**
* Linking a transaction to "Car Maintenance" increases Spent but NOT Funded
* User can manually set Funded to $500 via edit/button
* Progress bar shows funded and spent as separate visual indicators
* Unlinking a transaction decreases Spent only

### 4. Refund Detection Redesign
**Bug:** Refund detection is not catching real refunds and previously was flagging false positives (credit card payments). The merchant-matching approach doesn't work for real-world refunds.

**New detection algorithm:** A potential refund is identified when ALL of these are true:
1. Same account — both transactions on the same account
2. Same exact amount — the credit amount equals the debit amount (exact match, no tolerance needed for V1)
3. Opposite direction — one is a debit, the other is a credit
4. Within 30 days — the credit occurs within 30 days of the debit
5. NOT a payment/transfer — exclude transactions matching payment/transfer patterns

**Acceptance:**
* $709 debit on account A, then $709 credit on account A within 30 days → flagged as refund pair ✅
* $2,500 credit card payment → NOT flagged ✅
* $50 debit at Target, $50 credit at Target 5 days later → flagged as refund ✅
* $50 debit at Target, $47 credit at Target → NOT flagged (amount mismatch) ✅

### 5. Smart Learning Auto-Apply Fix
**Bug:** Category mappings are being captured when the user reclassifies a transaction, but they're not being auto-applied to other transactions with similar characteristics.

**Expected flow:**
1. User reclassifies transaction → UserCategoryMapping upserted
2. New transactions come in (via CSV import) → query UserCategoryMapping
3. Match criteria: normalized merchant name matches AND direction matches AND amount is within range
4. If match found with confidence >= 0.7 → auto-apply the category silently
5. Increment timesApplied on the mapping

**Acceptance:**
* Recategorize a $50 debit at "Trader Joe's" as "Groceries"
* Import new transactions including a $45 debit at "Trader Joe's"
* The new transaction should auto-categorize as "Groceries"

### 6. Flexible Budget Pace Line
**Feature:** Add a daily pace indicator to the flexible budget progress bars.

**Calculation:**
* dailyPace = budgetAmount / daysInMonth
* expectedSpendToDate = dailyPace × currentDayOfMonth
* status = actualSpend < expectedSpendToDate ? "ahead" : "behind"

**Implementation:**
* On each flexible budget progress bar, add a small vertical line/marker at the expectedSpendToDate position
* Add a subtle label: "On track" / "$X ahead" / "$X behind"
* Apply to both individual flexible budget rows AND the rollup summary

**Acceptance:**
* On day 15 of a 30-day month with a $600 grocery budget, the pace marker sits at $300 (50%)
* If actual grocery spending is $250, the bar fill stops before the marker → visually "ahead"
* Rollup row also shows an aggregate pace marker

## General Instructions
* Run full test suite after each fix
* Do not break existing passing tests
* Commit brief to docs/briefs/uat-round3-followup.md
* Target: 419/432 minimum (maintain, don't regress)
* Items 1 and 2 are bugs/regressions — fix first
* Item 3 (spent vs funded) is the most complex architectural change — take care
* Item 4 (refund redesign) is a complete rewrite of the detection logic
