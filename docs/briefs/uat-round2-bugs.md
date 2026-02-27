# UAT Round 2 — 8 Bugs (Feb 26 Testing)

## Bug 1: Flexible budget rows not all clickable
Every flexible budget row should be tappable to drill into transactions.

## Bug 2: Unbudgeted section shows budgeted categories
"Travel & Vacation" appears in Unbudgeted even though "Vacation & Travel" is an Annual budget. Fix: match by categoryId, not string name.

## Bug 3: Flexible catch-all budgets show $0
Flexible budgets like "Miscellaneous"/"Uncategorized" should be catch-all buckets absorbing unmatched transactions. Currently show $0.

## Bug 4: Negative sign wraps to separate line
Negative sign wraps to separate line from dollar amount. Add whitespace-nowrap to amount cells.

## Bug 5: Refund detection
Same merchant, same amount, opposite sign within 30 days. Flag pairs as "Refunded", exclude from spending calcs and budget usage.

## Bug 6: Account rows not clickable
Can't click into an account to view its transactions. Make account rows clickable → filtered transaction list.

## Bug 7: Account figures stale after save
Account figures stale after save until browser refresh. Audit ALL mutation flows across the entire app — every save/edit/delete needs router.refresh() client-side and revalidatePath() server-side.

## Bug 8: Mortgage amortization shows 78y 11m
The calc uses $3,600/mo total but $1,000 is escrow. Subtract escrow before amortization: P&I = $3,600 - $1,000 = $2,600.

## Acceptance Criteria
1. All flexible budget rows clickable → show transactions
2. "Travel & Vacation" spend appears under its budget, not Unbudgeted
3. Misc/Uncategorized flexible budgets absorb unmatched spend
4. Amount negative signs never wrap to a new line
5. Refund pairs detected and excluded from spending totals
6. Accounts clickable → filtered transaction view
7. ALL save/edit flows refresh UI immediately (full app audit)
8. Mortgage Est. Remaining shows ~30yr (escrow excluded from amortization)
9. No new test failures beyond the pre-existing 12 (420/432 baseline)
