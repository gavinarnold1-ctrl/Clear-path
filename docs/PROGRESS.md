# Oversikt — Implementation Progress

*Tracks completion status against `/docs/PRD.md` requirements and `/docs/TESTS.md` test specs.*

---

## Phase 1: Fix the Foundation

| Step | Req   | Description                                      | Status | Tests   |
|------|-------|--------------------------------------------------|--------|---------|
| 1    | R1.1  | Budget.spent computed from transactions on read   | 🟢 Done | T1.1 ✅ |
| 2    | R1.2  | Fixed expense matching — strict categoryId only   | 🟢 Done | T1.2 ✅ |
| 3    | R1.3  | CSV import sign logic                             | 🟢 Done | T1.3 ✅ |
| 4    | R1.4  | CSV column mapping: Person + Property             | 🟢 Done | T1.4 ✅ |
| 5    | R1.5  | CSV account linking + type inference              | 🟢 Done | T1.5 ✅ |
| 5a   | R1.5a | Account type detection: infer from name, all 8 types in dropdown | 🟢 Done | T1.5 ✅ |
| 5b   | R1.5b | Account balances: CSV accounts $0, formatCurrency 2dp everywhere | 🟢 Done | — |
| 6    | R1.6  | CSV category matching                             | 🟢 Done |         |
| 7    | R1.7  | Transaction classification                        | 🟢 Done |         |
| 8    | R1.8  | Auto-categorization                               | ⬜ TODO |         |
| 9    | R1.9  | Migration: fix existing sign errors               | 🟢 Done | T1.6    |
| 10   | R7.3  | Re-test AI insights with corrected data           | 🟢 Done | T1.7    |

### Notes

- **R1.1**: Schema has no `spent` field. Budgets page, dashboard, and budget-context all compute spent from current-month transactions grouped by categoryId. No `recalculateBudget` functions exist.
- **R1.2**: `FixedBudgetSection.tsx` matches strictly by `categoryId` — no merchant name or date matching. Fixed Date mocking in T1.2 test (switched from broken `vi.spyOn(Date)` to `vi.useFakeTimers()`).
- **R1.5a**: `inferAccountType()` in import route detects Credit Card (card/visa/platinum/venture/sapphire/etc.), Savings, Mortgage, Auto Loan, Student Loan, Investment from account names. AccountForm dropdown now includes all 8 AccountType enum values.
- **R1.5b**: CSV-created accounts always default to balance $0. All balance displays use `formatCurrency()` which uses `Intl.NumberFormat` (always 2 decimal places). No floating point display issues found.
- **R1.8**: Not yet implemented — requires merchant history lookup + Plaid metadata hints.
- **R1.10**: Plaid import sign flip — deferred to Phase 4.

---

## Phase 2: Complete the Data Model

| Step | Req       | Description                                     | Status | Tests |
|------|-----------|------------------------------------------------ |--------|-------|
| 11   | R3.1–R3.2 | HouseholdMember + person tag                    | 🟢 Done |       |
| 12   | R4.1–R4.2 | Property + property tag                         | 🟢 Done |       |
| 13   | R5.1–R5.4 | Debt model + Debts page                         | 🟢 Done | T2.3 ✅ |
| 13a  | R5.7      | Add Debt immediate list refresh after POST      | 🟢 Done | T2.3 ✅ |
| 14   | R10.2a    | Duplicate name prevention: members + properties | 🟢 Done |       |

### Notes

- **R5.7**: DebtManager adds new debt to local state immediately after POST and calls `router.refresh()`. No page reload needed.
- **R10.2a**: POST handlers for household members and properties already had case-insensitive duplicate checks. Added matching duplicate validation to PATCH handlers (prevents rename collisions, excludes self).

---

## Phase 3: Reshape the Experience

| Step | Req                        | Description                               | Status | Tests |
|------|----------------------------|-------------------------------------------|--------|-------|
| 15   | R8.1, R6.6                 | Overview: True Remaining hero             | 🟢 Done |       |
| 16   | R8.2–R8.4                  | Nav reorder, rename Insights → Monthly Review | 🟢 Done | T3.8 ✅ |
| 17   | R10.1–R10.6                | Settings page                             | 🟢 Done | T3.8 ✅ |
| 18   | R3.3–R3.4, R4.3–R4.5, R6.7| Spending views + unbudgeted               | 🟢 Done |       |
| 19   | R5.6                       | Mortgage escrow                           | 🟢 Done |       |
| 20   | R6.8                       | Category click-through                    | 🟢 Done |       |
| 21   | R7.1, R7.6–R7.7            | MonthlySnapshot + cron                    | 🟢 Done | T3.8 ✅ |
| 22   | R7.2, R7.4–R7.5, R5.5     | Monthly Review trajectory                 | 🟢 Done | T3.8 ✅ |
| 23   | R6.9                       | Budget form: "Planned month", Flexible defaults Monthly | 🟢 Done | — |
| 24   | R6.10                      | Income vs Expenses graph: Trail green + ember | 🟢 Done | — |
| 25   | R7.5a                      | Recommendation feedback loop: persist + inject into AI | 🟢 Done | — |
| 26   | R7.3a                      | De-emphasize Spending vs Benchmark section | 🟢 Done | — |
| 27   | R6.4a                      | AI Budget Builder: regenerate/add-missing/cancel | 🟢 Done | — |

### Notes

- **R6.9**: BudgetForm already labels annual month as "Planned month" and defaults flexible period to MONTHLY.
- **R6.10**: MonthlyChart uses `#52B788` (Trail green) for income and `#C4704B` (ember) for expenses.
- **R7.5a**: InsightCard supports dismiss with 5 reasons and completion with notes. PATCH `/api/insights/{id}` persists `dismissReason` and `completionNotes`. `buildInsightHistory()` aggregates dismiss patterns and completion rates. AI prompt includes user history section with top dismiss reasons and previous titles.
- **R7.3a**: SpendingComparison component de-emphasized: muted styling (`bg-frost/50`), smaller heading (`text-sm text-stone`), added caveat about BLS national medians not accounting for household size/location/income. Returns `null` instead of empty state card when no benchmarks. Already rendered below fold (after Recommendations section).
- **R6.4a**: BudgetBuilderCTA shows dropdown menu with "Regenerate all", "Add missing", and "Dismiss" when budgets already exist. When no budgets, shows full CTA card.

---

## Phase 4: Bank Connectivity

| Step | Req        | Description                          | Status |
|------|------------|--------------------------------------|--------|
| 28   | R2.1, R1.10| Plaid SDK + API routes, sign flip    | ⬜ TODO |
| 29   | R2.1       | Plaid Link on Accounts page          | ⬜ TODO |
| 30   | R2.2–R2.3  | Daily sync cron, balance refresh     | ⬜ TODO |

---

## Phase 5: Security, Brand, and Ship

| Step | Req          | Description                     | Status |
|------|--------------|---------------------------------|--------|
| 31   | R11.1–R11.14 | Security hardening              | ⬜ TODO |
| 32   | R9.1         | Rebrand codebase                | ⬜ TODO |
| 33   | R9.2–R9.3    | Domain + rename repo            | ⬜ TODO |
| 34   | R9.4–R9.5    | Landing page + demo mode        | ⬜ TODO |
| 35   | R9.6         | Mobile responsive audit (375px) | 🟢 Done |
| 36   | —            | Final verification              | ⬜ TODO |

---

## Test Status

| Phase                        | Tests     | Status |
|------------------------------|-----------|--------|
| Phase 1: Foundation          | T1.1–T1.8 | 🟢 T1.1 ✅, T1.2 ✅, T1.5 ✅ (all source verification pass) |
| Phase 2: Data Model          | T2.1–T2.3 | 🟢 T2.3 ✅ (45/45 pass) |
| Phase 3: Experience          | T3.1–T3.8 | 🟢 T3.8 ✅ (34/34 pass) |
| Phase 4: Plaid               | T4.1–T4.3 | ⬜ |
| Phase 5: Security/Brand/Ship | T5.0–T5.4 | ⬜ |
| Final Verification           | All       | ⬜ |

### Latest Test Run (2026-02-24)

```
T1.5 (csv-person-property-mapping): 29/29 ✅
T2.3 (debts-page):                  45/45 ✅
T3.8 (phase3-experience):           34/34 ✅
Total:                              108/108 ✅
```
