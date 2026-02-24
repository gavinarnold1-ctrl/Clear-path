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
- **R1.8**: Not yet implemented — requires merchant history lookup + Plaid metadata hints.
- **R1.12**: CSV import "Import into account" dropdown defaults to blank (no pre-selected account).
- **R1.14**: Dashboard income/expense totals and chart exclude transfer-category transactions. Total Balance uses `account.balance` (not transaction sums).

### Additional Data Integrity (R1.11–R1.15)

| Req   | Description                                      | Status  |
|-------|--------------------------------------------------|---------|
| R1.12 | CSV import dropdown defaults to blank            | 🟢 Done |
| R1.14 | Exclude transfers from income/expense totals     | 🟢 Done |

---

## Phase 2: Complete the Data Model

| Step | Req       | Description                          | Status  | Tests   |
|------|-----------|--------------------------------------|---------|---------|
| 11   | R3.1–R3.2 | HouseholdMember + person tag         | 🟢 Done |         |
| 12   | R4.1–R4.2 | Property + property tag              | 🟢 Done |         |
| 13   | R5.1–R5.4 | Debt model + Debts page              | 🟢 Done | T2.3 ✅ |

### Notes

- **R3.2a**: Account-person linking: `ownerId` on Account → HouseholdMember. Account owner is default person tag for transactions created via that account. AccountManager inline edit shows Owner dropdown. CSV import uses account owner when no Person column is mapped.
- **R5.7**: DebtManager adds new debt to local state immediately after POST.
- **R5.8**: Transaction-debt linking: `debtId` on Transaction → Debt. Debt payments (negative amount transactions) reduce `currentBalance`. Debt detail API includes payment history. DebtManager shows recent payments per debt.
- **R10.2a**: PATCH handlers for household members and properties have case-insensitive duplicate name checks.

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
- **R7.3a**: SpendingComparison de-emphasized: muted styling, BLS caveat, returns `null` when no benchmarks.
- **R7.5a**: InsightCard supports dismiss with 5 reasons and completion with notes. AI prompt includes user history.
- **R6.4a**: BudgetBuilderCTA shows dropdown menu with "Regenerate all", "Add missing", and "Dismiss" when budgets exist.
- **R7.8**: Monthly Review has month selector dropdown scoped to available snapshots. Each data block (income, expenses, savings rate, debt) is clickable → filtered transactions/spending. Person and property breakdowns link to spending views.
- **R8.5**: Overview "View all" links carry `?month=` param for context-aware navigation.

### Additional Features

| Req   | Description                                      | Status  |
|-------|--------------------------------------------------|---------|
| R6.9  | Budget form: "Planned month", Flexible → Monthly | 🟢 Done |
| R6.10 | Income vs Expenses: Trail green + ember           | 🟢 Done |
| R7.5a | Recommendation feedback loop                     | 🟢 Done |
| R7.3a | De-emphasize Spending vs Benchmark               | 🟢 Done |
| R6.4a | AI Budget Builder: regenerate/add-missing/cancel  | 🟢 Done |
| R7.8  | Monthly Review month selector + clickable blocks  | 🟢 Done |
| R8.5  | Overview "View all" buttons navigate with context | 🟢 Done |

---

## Phase 4: Bank Connectivity

| Step | Req         | Description                          | Status  |
|------|-------------|--------------------------------------|---------|
| 22   | R2.1, R1.10 | Plaid SDK + API routes, sign flip    | ⬜ TODO |
| 23   | R2.1        | Plaid Link on Accounts page          | ⬜ TODO |
| 24   | R2.2–R2.3   | Daily sync cron, balance refresh     | ⬜ TODO |

---

## Phase 5: Security, Brand, and Ship

| Step | Req          | Description                     | Status  |
|------|--------------|---------------------------------|---------|
| 25   | R11.1–R11.14 | Security hardening              | ⬜ TODO |
| 26   | R9.1         | Rebrand codebase                | ⬜ TODO |
| 27   | R9.2–R9.3    | Domain + rename repo            | ⬜ TODO |
| 28   | R9.4–R9.5    | Landing page + demo mode        | ⬜ TODO |
| 29   | R9.6         | Mobile responsive audit (375px) | 🟢 Done |
| 30   | —            | Final verification              | ⬜ TODO |

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
