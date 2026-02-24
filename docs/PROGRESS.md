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
| 5    | R1.5  | CSV account linking                               | 🟢 Done | T1.5    |
| 6    | R1.6  | CSV category matching                             | 🟢 Done |         |
| 7    | R1.7  | Transaction classification                        | 🟢 Done |         |
| 8    | R1.8  | Auto-categorization                               | ⬜ TODO |         |
| 9    | R1.9  | Migration: fix existing sign errors               | 🟢 Done | T1.6    |
| 10   | R7.3  | Re-test AI insights with corrected data           | 🟢 Done | T1.7    |

### Notes

- **R1.1**: Schema has no `spent` field. Budgets page, dashboard, and budget-context all compute spent from current-month transactions grouped by categoryId. No `recalculateBudget` functions exist.
- **R1.2**: `FixedBudgetSection.tsx` matches strictly by `categoryId` — no merchant name or date matching. Fixed Date mocking in T1.2 test (switched from broken `vi.spyOn(Date)` to `vi.useFakeTimers()`).
- **R1.8**: Not yet implemented — requires merchant history lookup + Plaid metadata hints.
- **R1.10**: Plaid import sign flip — deferred to Phase 4.

---

## Phase 2: Complete the Data Model

| Step | Req       | Description                            | Status |
|------|-----------|----------------------------------------|--------|
| 11   | R3.1–R3.2 | HouseholdMember + person tag           | 🟢 Done |
| 12   | R4.1–R4.2 | Property + property tag                | 🟢 Done |
| 13   | R5.1–R5.4 | Debt model + Debts page                | 🟢 Done |

---

## Phase 3: Reshape the Experience

| Step | Req                        | Description                               | Status |
|------|----------------------------|-------------------------------------------|--------|
| 14   | R8.1, R6.6                 | Overview: True Remaining hero             | 🟢 Done |
| 15   | R8.2–R8.4                  | Nav reorder, rename Insights → Monthly Review | 🟢 Done |
| 16   | R10.1–R10.6                | Settings page                             | 🟢 Done |
| 17   | R3.3–R3.4, R4.3–R4.5, R6.7| Spending views + unbudgeted               | 🟢 Done |
| 18   | R5.6                       | Mortgage escrow                           | 🟢 Done |
| 19   | R6.8                       | Category click-through                    | 🟢 Done |
| 20   | R7.1, R7.6–R7.7            | MonthlySnapshot + cron                    | 🟢 Done |
| 21   | R7.2, R7.4–R7.5, R5.5     | Monthly Review trajectory                 | 🟢 Done |

---

## Phase 4: Bank Connectivity

| Step | Req        | Description                          | Status |
|------|------------|--------------------------------------|--------|
| 22   | R2.1, R1.10| Plaid SDK + API routes, sign flip    | ⬜ TODO |
| 23   | R2.1       | Plaid Link on Accounts page          | ⬜ TODO |
| 24   | R2.2–R2.3  | Daily sync cron, balance refresh     | ⬜ TODO |

---

## Phase 5: Security, Brand, and Ship

| Step | Req          | Description                     | Status |
|------|--------------|---------------------------------|--------|
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
| Phase 1: Foundation          | T1.1–T1.8 | 🟢 T1.1 ✅, T1.2 ✅ (31/31 pass) |
| Phase 2: Data Model          | T2.1–T2.3 | 🟢 |
| Phase 3: Experience          | T3.1–T3.8 | 🟡 In progress |
| Phase 4: Plaid               | T4.1–T4.3 | ⬜ |
| Phase 5: Security/Brand/Ship | T5.0–T5.4 | ⬜ |
| Final Verification           | All       | ⬜ |
