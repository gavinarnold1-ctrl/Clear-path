# Brief: Stress Test Follow-Up Fixes

## PRD Reference
Requirement IDs: R1.3 (budget tracking), R9.1 (dashboard)

## What
Fix two issues discovered during the Feb 26 stress test: (1) Fixed bill matching on the Budget Health view incorrectly marks paid bills as "MISSED" and shows wrong amounts for matched transactions, and (2) the dashboard shows stale $0 data after CSV import until a manual page reload.

## Why
Fixed bill matching is a core trust signal — if a user pays rent on the 1st and the app says "MISSED," they lose confidence immediately. The stale dashboard issue makes new users think their CSV import failed, which is a critical first-impression moment.

## Scope
- **In:** Fixed bill paid/unpaid detection logic, fixed bill amount matching, dashboard data refresh after CSV import
- **Out:** AI budget builder proposal logic (working correctly), CSV import pipeline itself (working correctly), flexible/annual budget tracking

## Design Decisions
1. **Fixed bill matching** should match by budget name → category → transaction description chain, not just by category alone. A budget named "Rent" with category "Rent" should match transactions in the "Rent" category for that month. The "paid" status should be true if any matching transaction exists in the current month on or after the bill's due date (or before, since bills can be paid early).
2. **Fixed bill amount display** should show the actual transaction amount that matched (e.g., $1,850 for rent), not a sum of unrelated transactions in the same category.
3. **Dashboard cache invalidation** — after the CSV import API returns success, the client should invalidate/refetch dashboard data. This could be via router.refresh(), cache revalidation, or a redirect that forces a fresh server render.

## Acceptance Criteria
- [ ] When rent ($1,850) is paid on the 1st, Budget Health shows Rent as paid with $1,850 amount (not "MISSED")
- [ ] When insurance ($156) is paid, it shows the correct $156 amount (not an inflated number)
- [ ] When internet ($89.99) is paid, it shows $89.99 (not $260 or other wrong amount)
- [ ] Bills paid before their due date are still marked as "paid"
- [ ] After CSV import completes and user navigates to dashboard, income/expense/transaction data appears immediately without needing a page reload
- [ ] Existing test suite passes (no regressions)

## Files Likely Involved
- `src/app/budgets/page.tsx` — Budget Health view rendering, fixed bill matching logic
- `src/app/api/budgets/route.ts` or related API — may contain server-side bill matching
- `src/app/transactions/import/page.tsx` — CSV import success handler, needs cache invalidation
- `src/app/dashboard/page.tsx` — may need revalidation tags
- `src/lib/` — any utility for matching transactions to budgets

## Notes
- The fixed bill matching bug may stem from matching transactions by category group rather than specific category. For example, a "Utilities" group could contain Electric, Water, AND Internet, causing cross-contamination of amounts.
- The "MISSED" status for Rent is especially puzzling since the $1,850 transaction exists on Feb 1 and the budget says "due 1st." Investigate whether the T12:00:00 date fix (Bug 3) interacts with the due-date comparison.
- For the dashboard cache issue, check whether Next.js ISR or client-side caching is involved. The import API route returns success, but the dashboard may be serving a cached server component.
- Test data available: stress-test-transactions.csv in the repo's docs/ folder can be used to reproduce.
