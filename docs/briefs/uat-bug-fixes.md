# Brief: UAT Bug Fixes (Feb 2026)

## PRD Reference
Requirement IDs: R1.8 (auto-categorization), R9.4 (onboarding). Also covers new issues not yet in PRD.

## What
Fix 6 bugs discovered during UAT testing on 2026-02-26. These are all blocking V1 public launch quality. The most critical is that the recommended category set has no income categories, which causes the dashboard to show $0 income and an inflated deficit for every new user.

## Why
A new user who signs up, adds their paycheck, and sees "$0 income / $5,314 expenses / deficit" will immediately lose trust and churn. The date bug and silent form failure also create confusion during the first session. These are first-impression killers.

## Scope
- **In:** Income categories, date timezone fix, form validation feedback, page title fix, chart ghost bar, annual expense duplication
- **Out:** AI budget builder changes, new features, UX redesign, onboarding flow changes beyond the title tag

## Design Decisions
1. **Income categories to add to the recommended set:** Salary/Wages, Freelance/Contract Income, Rental Income, Investment Income, Other Income. These should belong to an "Income" category group so `classifyTransaction()` correctly identifies them as income.
2. **Date fix:** The issue is likely in how the date input value (local timezone) gets stored. Use date-only storage (no time component) or ensure UTC midnight doesn't shift the date backward.
3. **Amount field:** The `min="0.01"` on the amount input is correct — users should enter positive amounts. But the form needs to show why it won't submit. Add a visible validation message. Do NOT allow negative input; the system auto-negates based on category group, which is the intended convention.
4. **Page title:** Change "Clear-path" to "oversikt" wherever it appears in `<title>` tags (onboarding pages specifically).

## Acceptance Criteria
- [ ] Recommended categories include at least: Salary/Wages, Freelance/Contract, Rental Income, Investment Income, Other Income — all in an "Income" category group
- [ ] A new user who adds a $5,500 transaction with the "Salary/Wages" category sees it as +$5,500 income on the dashboard (not as an expense)
- [ ] Transaction dates entered as 02/26 display as Feb 26 in the transaction list (not Feb 25)
- [ ] Entering an invalid amount (0, negative, blank) in the transaction form shows a visible error message near the field
- [ ] Page title on /onboarding reads "oversikt" not "Clear-path"
- [ ] Income vs Expenses chart on dashboard does not show bars for months with zero data
- [ ] Running AI budget proposal does not create duplicate annual expense entries
- [ ] All existing tests pass after changes (target: 432/432 or better)

## Files Likely Involved
- `src/lib/category-groups.ts` — where category groups are defined and `classifyTransaction()` lives
- `prisma/seed.ts` or equivalent — where recommended categories are seeded
- `src/app/onboarding/` — page titles
- `src/app/transactions/new/page.tsx` — amount input validation
- `src/components/TransactionForm.tsx` (or similar) — form validation display
- `src/app/dashboard/page.tsx` — Income vs Expenses chart rendering
- `src/app/api/budgets/` or AI budget route — annual expense duplication bug
- Transaction API route — date handling (check if using `new Date()` vs date-only string)

## Notes
- The category group → classification hierarchy is documented in repo CLAUDE.md. Income classification flows from category group, not from the sign of the amount. This is the intended design — just needs income groups to exist.
- The date bug may be in the API route (storing date with time) or the display layer (rendering with timezone offset). Check both.
- For the annual expense duplication: this was user-reported, not directly observed during UAT. The trigger is running the AI budget proposal when annual expenses already exist. May be an upsert-vs-insert issue.
- The chart ghost bar on December could be a Recharts default behavior when the data array includes months with `{ income: 0, expenses: 0 }` — may need to filter those out or set them to `null`.
