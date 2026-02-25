# Oversikt — Product Requirements Document

*Version 2.17 — February 25, 2026*
*This is the single source of truth. All other docs are reference material.*

---

## How to use this document

This PRD lives in the repo at `/docs/PRD.md`. It is the authority.

**In this chat (Claude.ai):** Discuss, debate, refine. Decisions get written here.

**In Claude Code:** Every task starts with "Read /docs/PRD.md. Implement Step [N]." Don't freelance. If ambiguous, stop and ask.

**When something changes:** PRD first, then code. Never the reverse.

---

## Purpose

Oversikt is a smart financial tool that helps people make better decisions by giving them access to their data and the insights that drive decisions.

It shows what's true and what it means. The user decides what to do.

---

## Design Principles

1. **True Remaining over Total Balance.** Lead with the number that answers "what can I spend?" — income minus fixed obligations minus annual set-asides.
2. **What's true + what it means.** Every screen presents data and context together.
3. **Trajectory over snapshot.** Show whether you're improving. The Monthly Review is the proof.
4. **Tag everything.** Transactions carry person, property, and category. This is the foundation for household management, tax prep, and meaningful analysis.
5. **The user decides.** Surface facts and patterns, don't prescribe actions.
6. **Start recording immediately.** Monthly snapshots from day one. Every month without one is lost trajectory data.
7. **Logic lives in modules, not routes.** Tax rules, amortization math, and benchmark calculations are standalone libraries in `/lib/engines/`. API routes call them. This keeps the intelligence layer decoupled from the interface — the consumer app is the first client, not the only one.

---

## Release Plan

| Release | What it is | Core question |
|---------|-----------|--------------|
| **V1** | Complete financial picture | "What's true about my money, who spent it, what's it for, what do I owe, and am I getting better?" |
| **V2** | Intelligence + tax | "How do I optimize, and is my tax picture clean?" |

---

## V1 — What we're shipping

### Definition
A financial tool for households with real-world complexity: multiple people, at least one property, debts, and the need to understand whether their financial life is improving. Connects to banks, tracks budgets across three tiers, and delivers a monthly review that shows progress. The consumer app is the first interface to these engines. Not the only one.

### Pages

**Daily use:**
| Page | Purpose |
|------|---------|
| Overview | What's true right now — True Remaining hero, budget pulse, recent transactions |
| Budgets | Am I on track — Fixed (paid/missed), Flexible (progress bars), Annual (summary) |
| Spending | Where did it go — by category, by person, by property |
| Annual Plan | Am I prepared — forecast chart, Auto-Fund, set-aside tracking |
| Debts | What I owe — balances, rates, principal vs interest breakdown |
| Transactions | The raw ledger — filterable by person, property, category, account |

**Periodic:**
| Page | Purpose |
|------|---------|
| Monthly Review | Am I getting better — trajectory since you started, AI efficiency score, what changed |

**Setup:**
| Page | Purpose |
|------|---------|
| Settings | Your profile, household members, properties, connected accounts, security |
| Accounts | Connected money — Plaid Link, manual accounts, balances |
| Categories | How things are organized — edit, merge, delete |

### Requirements

#### R1. Accurate data

| ID | Requirement | Status |
|----|------------|--------|
| R1.1 | Budget spent computed from transactions on read, never stored | 🟢 |
| R1.2 | Fixed expense paid/missed matches transactions STRICTLY by categoryId within month. Currently Mortgage Payment budget is $1,847 but shows $7,672.92 actual — pulling in transactions from wrong categories. Must match only on the exact categoryId assigned to the fixed expense. | 🔴 REGRESSION |
| R1.3 | CSV import sign logic: if category type=income, amount stays positive. If type=expense, amount stored negative. Feb income should be $7,284 but app shows $5,048 — $2,236 of income is sign-flipped or misclassified. | 🔴 REGRESSION |
| R1.4 | CSV import mapping: add Person and Property to the column mapping dropdown (currently only Date, Merchant, Amount, Category, Account, Ignore) | 🟢 |
| R1.5 | CSV import account linking: Account column is auto-detected but "Import into account" overrides to "No account". Resolve conflict — if Account column is mapped, use per-row values. If not mapped, use the global "Import into account" dropdown. Auto-create accounts that don't exist. | 🟢 |
| R1.5a | Account type detection: auto-created accounts should infer type from name (e.g., "Platinum Card", "Venture X" → Credit Card, "Savings" → Savings, "Checking" → Checking). Currently all accounts default to Checking. Account type dropdown on Accounts page should include: Checking, Savings, Credit Card, Investment, Loan, Other. | 🟢 |
| R1.5b | Account balances: manual/CSV accounts store a **baseline balance** with a **balance-as-of date**. User enters "my checking account has $5,200 as of Feb 25, 2026." New transactions after that date adjust the running balance. Until user enters a baseline, balance = $0. Never compute balance by summing all historical transactions (no starting point = meaningless). Only Plaid-connected accounts get real balances from API. Fix floating point display errors (show 2 decimal places, never raw floats). Remove any "Recalculate Balances from Transactions" endpoint or Settings button. | 🔴 REGRESSION |
| R1.6 | CSV import category matching: imported categories must map to existing categories AND their groups. Spending page shows all 24 categories in a single "Imported" group — group assignment is not running. New categories must be assigned to correct group via default mapping table (see R1.6a). Also: malformed category names from CSV parse errors ("CT CT\"", "FRISCO CO\"") must be caught and placed in Uncategorized, not created as categories. | 🔴 REGRESSION |
| R1.6a | Default category-to-group mapping table. On import, every category must be assigned to a group. Mapping: **Housing:** Mortgage, Rent, Home Improvement, Furniture & Housewares. **Transportation:** Gas, Auto Maintenance, Auto Payment, Parking & Tolls, Taxi & Ride Shares, Public Transit. **Food:** Groceries, Restaurants & Bars, Coffee Shops. **Utilities:** Gas & Electric, Phone, Internet & Cable, Water, Garbage. **Insurance:** Insurance. **Health:** Medical, Dentist, Fitness. **Personal:** Clothing, Personal, Shopping, Electronics, Gifts, Education. **Entertainment:** Entertainment & Recreation, Travel & Vacation. **Pets:** Pets. **Financial:** Financial Fees, Interest, Credit Card Payment, Loan Repayment, Student Loans, Taxes. **Income:** Paychecks, Other Income, Dividends & Capital Gains. **Transfers:** Transfer, Cash & ATM. **Business:** Business Utilities & Communication, Office Supplies & Expenses, Postage & Shipping. **Other:** Miscellaneous, Wedding, Charity, Uncategorized, Buy. Any category not in this table → Other. | 🔴 NEW |
| R1.7 | Transaction classification: every transaction has a classification — expense, income, or transfer. Transfers excluded from spending totals, budget calculations, and Spending Breakdown. Feb expenses show $26,863 but real expenses are $3,932 — app is counting transfers ($11,881) and CC payments as expenses. Credit card payments and internal account movements must classify as transfer. Classification rules: categories "Transfer", "Credit Card Payment", "Cash & ATM" → transfer. Categories "Paychecks", "Other Income", "Interest", "Dividends & Capital Gains" → income. Everything else → expense. | 🔴 REGRESSION |
| R1.8 | Auto-categorization hierarchy for new transactions (Plaid sync or CSV import): (1) Merchant history — match merchant name to most recent categorized transaction for that merchant/user. If match, apply same category and classification. (2) Plaid metadata — use personal_finance_category and transaction_code as hint (e.g., payroll code → Paychecks/income, not transfer). (3) Uncategorized — if no signal matches, leave uncategorized. User categorizes once, merchant history handles it going forward. Never use amount-based rules. | ⬜ |
| R1.9 | Migration: fix all existing transactions where category type=income but amount is negative (flip sign). Classify existing transactions (transfer categories → transfer, income → income, rest → expense). Run once. Previous migration did not work — income still negative, transfers still counted as expenses. Must re-run with correct logic. | 🔴 REGRESSION |
| R1.10 | Plaid import flips sign convention | ⬜ |
| R1.11 | Paycheck sign audit: query ALL transactions with income-type categories (Paychecks, Other Income, Interest, Dividends). Any with negative amounts → flip to positive. Any with classification != 'income' → fix classification. Jan paychecks total should be $11,407 positive, not negative. | 🔴 |
| R1.12 | CSV "Import into account" dropdown must default to blank/no selection — not pre-select an existing account. User explicitly chooses target account or maps Account column. Current default silently assigns all imports to wrong account. | 🔴 |
| R1.13 | Categories not connecting: Spending page shows 24 categories all in "Imported" group. Verify every transaction has a valid categoryId pointing to a real category. Verify every category has a valid groupId pointing to a real group. Remove duplicate categories (same name, same user). Remove malformed categories (parse errors like "CT CT\""). | 🔴 |
| R1.14 | Overview balance display: replace "Total Balance across N accounts" with **"Cash Available"** — sum of balances for Checking + Savings accounts only. Credit cards, loans, and investments excluded. Account balances: Plaid accounts get real balance from API. Manual/CSV accounts: user enters a balance-as-of-date (baseline). New transactions after that date adjust the balance. Until entered, balance = $0. Do NOT compute balances by summing all historical transactions (no starting point = meaningless number). Remove any "Recalculate Balances from Transactions" endpoint/button. | 🔴 |
| R1.15 | Data integrity audit: after fixing R1.2–R1.14, run comprehensive check. Every transaction: valid categoryId (exists), valid accountId (exists), correct sign (income=positive, expense=negative), correct classification. Every category: valid groupId (exists), no duplicates, no malformed names. Every account: balance is manual entry or $0, not transaction sum. Log all violations, fix all, re-verify zero violations. | 🔴 |

#### R2. Bank connectivity

| ID | Requirement | Status |
|----|------------|--------|
| R2.1 | Connect banks via Plaid Link on Accounts page | ⬜ |
| R2.2 | Daily transaction sync via Plaid cursor-based API | ⬜ |
| R2.3 | Account balances refresh from Plaid | ⬜ |
| R2.4 | Manual accounts supported alongside Plaid | 🟢 |

#### R3. Household awareness

| ID | Requirement | Status |
|----|------------|--------|
| R3.1 | Create household members (names) | 🟢 |
| R3.2 | Tag transactions to a household member | 🟢 |
| R3.2a | Link accounts to a person (e.g., "Gavin's Amex"). Account owner becomes default person tag for all transactions in that account. Per-transaction person tag overrides account default. | ⬜ |
| R3.3 | Spending: "By Person" view | 🟢 |
| R3.3a | Person click-through: tap a person on By Person view → filtered transactions for that person + current month | 🟢 |
| R3.4 | Monthly Review: per-person breakdown | 🟢 |

#### R4. Property separation

| ID | Requirement | Status |
|----|------------|--------|
| R4.1 | Create properties (name, type: Personal/Rental) | 🟢 |
| R4.2 | Tag transactions to a property | 🟢 |
| R4.3 | Spending: "By Property" view | 🟢 |
| R4.4 | Transactions: property filter | 🟢 |
| R4.5 | Filter Rental → all rental expenses for the year | 🟢 |

#### R5. Debt visibility

| ID | Requirement | Status |
|----|------------|--------|
| R5.1 | Add debts (name, type, balance, rate, minimum payment) | 🟢 |
| R5.2 | Debts page: principal vs interest breakdown | 🟢 |
| R5.3 | Debts page: total summary (owed, payments, avg rate) | 🟢 |
| R5.4 | Debt links to property (mortgage → rental) | 🟢 |
| R5.5 | Monthly Review: debt trajectory | 🟢 |
| R5.6 | Mortgage escrow: "Monthly payment" field captures the full amount the user pays (P&I + escrow). Optional "Escrow amount" field (taxes + insurance). App computes P&I = payment minus escrow. Payment breakdown bar shows: Principal (green), Interest (ember), Escrow (gray). Debt payoff math uses P&I only (escrow doesn't reduce balance). | 🟢 |
| R5.7 | Add Debt: new debt appears immediately in list without page refresh. Invalidate/refetch after successful POST. | 🟢 |
| R5.8 | Transaction-debt linking: transactions can be linked to a debt (e.g., $8K student loan payment links to Student Loan debt). Debt payments should reduce the debt's currentBalance when linked. Linked transactions visible from Debts page (click debt → see payment history). Debt payments should also appear in Annual Plan if budgeted there. Classification: large debt payments are expenses (reduce balance), not transfers. | 🔴 |

#### R6. Budget tracking

| ID | Requirement | Status |
|----|------------|--------|
| R6.1 | Fixed: paid/missed from transaction matching | 🟢 |
| R6.2 | Flexible: accurate spent/limit with $/day remaining | 🟢 |
| R6.3 | Annual: funding progress with set-aside calculations | 🟢 |
| R6.4 | Annual Plan: apply-cash and link-transaction funding | 🟢 |
| R6.4a | Budgets page AI Budget Builder: if budgets already exist, button should offer to regenerate/adjust (not silently do nothing). Options: "Regenerate all" (replaces existing), "Add missing" (fills gaps only), or dismiss. Show confirmation before overwriting. | 🟢 |
| R6.5 | Auto-Fund All distributes True Remaining | 🟢 |
| R6.6 | True Remaining as primary metric on Overview | 🟢 |
| R6.7 | Unbudgeted spending surfaced: categories with transactions but no budget shown on Budgets page as "Unbudgeted" section with actual spend | 🟢 |
| R6.8 | Category click-through: tap any category on Budgets, Spending, or Unbudgeted section → filtered transaction list for that category and current month | 🟢 |
| R6.9 | Annual budget form: "Due month" label → "Planned month". Flexible budget: time frame dropdown defaults to "Monthly" (not blank). | 🟢 |
| R6.10 | Income vs Expenses graph: income should be green (Trail #52B788), expenses should be ember/red. Currently using wrong colors. | 🟢 |

#### R7. Monthly Review

| ID | Requirement | Status |
|----|------------|--------|
| R7.1 | Monthly snapshots capture key metrics | 🟢 |
| R7.2 | "Since you started" trajectory comparison | 🟢 |
| R7.3 | AI-generated review with efficiency score | 🟢 |
| R7.3a | Remove or de-emphasize "Spending vs Benchmark" section from V1 Monthly Review. Still showing "Excessive" and "High" labels (e.g., Shopping $623 vs $200 median marked "Excessive"). Either remove entirely from V1 or: remove colored judgment labels, use neutral gray styling only, add prominent caveat. Benchmarking done properly in V2.8. | 🔴 REGRESSION |
| R7.4 | Includes person and property breakdowns | 🟢 |
| R7.5 | Includes debt paydown progress | 🟢 |
| R7.5a | Recommendation action loop — both actions save feedback records that are fed into future AI prompts: |
| | **Mark complete:** saves timestamped entry (recommendation, user action notes, date, projected savings). Completed actions visible in Monthly Review history. AI follows up on whether savings materialized by comparing category spend before/after. |
| | **Dismiss:** UI exists with structured reasons ("Not relevant to me", "Already doing this", "Too difficult to implement", "I disagree with this", "Other reason"). Currently a dead end — dismiss data not stored or reused. Fix: persist dismiss records. Include in future AI prompts so AI doesn't re-suggest dismissed items and learns user preferences (e.g., values service quality over cost savings). "Other reason" freetext included in prompt context. | 🟢 |
| R7.6 | Baseline snapshot on first data import | 🟢 |
| R7.7 | Monthly cron on 1st of each month | 🟢 |
| R7.8 | Monthly Review must be scoped to a specific month (default: current). Each data block (spending categories, debt payments, person breakdowns) should be clickable → navigates to filtered transaction list for that block's data. Example: "Student Loan $8,000" in January review → click → see the actual transactions. Month selector lets user review any previous month. | 🔴 |
| R7.9 | Monthly Review includes **Net Worth** section: total assets (Checking + Savings + Investment balances) minus total liabilities (Credit Card + Loan balances). Tracked over time via monthly snapshots — shows trend line ("Net worth: $X, up/down $Y from last month"). Net worth does NOT appear on Overview — it's a periodic metric, not a daily one. | 🔴 |

#### R8. Information architecture

| ID | Requirement | Status |
|----|------------|--------|
| R8.1 | Overview leads with True Remaining | 🟢 |
| R8.2 | Nav: Overview → Budgets → Spending → Annual Plan → Debts → Transactions / Monthly Review / Settings → Accounts → Categories | 🟢 |
| R8.3 | "Insights" renamed "Monthly Review" | 🟢 |
| R8.4 | Nav grouped: daily / periodic / setup | 🟢 |
| R8.5 | Overview "View all" button does not navigate. Verify all clickable elements on Overview actually route to their target pages. | 🔴 |

#### R9. Brand and deployment

| ID | Requirement | Status |
|----|------------|--------|
| R9.1 | Codebase renamed to oversikt | 🟡 |
| R9.2 | Deployed to oversikt.app or oversikt.vercel.app | 🔴 |
| R9.3 | GitHub repo renamed | ⬜ |
| R9.4 | Landing page: definition + create account + demo | ⬜ |
| R9.5 | Demo mode with full seed data | ⬜ |
| R9.6 | All pages work at 375px mobile. Sidebar collapses to hamburger menu on mobile — currently stays full-width and dominates the screen. | 🟢 |

#### R10. Settings

| ID | Requirement | Status |
|----|------------|--------|
| R10.1 | Profile management: edit name, email, change password | 🟢 |
| R10.2 | Household members: create, edit, delete (R3.1 UI lives here) | 🟢 |
| R10.2a | Duplicate prevention: household members and properties must have unique names per user (case-insensitive). Screenshot shows "Caroline" listed TWICE plus "Cgrubbs14" (a username, not a name). Fix: (1) deduplicate existing records — merge duplicate Caroline entries, reassign transactions from deleted duplicate to surviving record. (2) Clean up "Cgrubbs14" — either rename or remove. (3) Enforce unique constraint on create so this can't happen again. | 🔴 REGRESSION |
| R10.3 | Properties: create, edit, delete (R4.1 UI lives here) | 🟢 |
| R10.4 | Connected accounts: view Plaid connections, disconnect | 🟢 |
| R10.5 | Data export: download transactions as CSV | 🟢 |
| R10.6 | Delete account: permanent, with confirmation | 🟢 |

#### R11. Security

| ID | Requirement | Status |
|----|------------|--------|
| R11.1 | Passwords hashed with bcrypt, never stored plaintext | 🟢 |
| R11.2 | JWT tokens: HttpOnly, Secure, SameSite=Strict cookies. Short expiry (1h) with refresh. | 🟡 |
| R11.3 | Rate limiting on auth endpoints (login, register) — prevent brute force | ⬜ |
| R11.4 | Every database query scoped by userId — no cross-user data leakage | 🟡 |
| R11.5 | Plaid access tokens encrypted at rest (AES-256), never sent to frontend | ⬜ |
| R11.6 | Plaid Link handles bank credentials — Oversikt never sees usernames/passwords | ⬜ |
| R11.7 | AI data minimization: send aggregated/anonymized data to Anthropic, not raw PII | 🟡 |
| R11.8 | No bank account numbers, routing numbers, or Plaid tokens in AI prompts | ⬜ |
| R11.9 | Anthropic API: data not used for model training (API ToS) | 🟢 |
| R11.10 | Environment secrets in Vercel env vars, never in code or git | 🟡 |
| R11.11 | HTTPS everywhere (Vercel default) | 🟢 |
| R11.12 | Input validation and SQL injection protection (Prisma parameterized queries) | 🟢 |
| R11.13 | CSRF protection on all mutation endpoints | ⬜ |
| R11.14 | Security page/statement accessible from landing page explaining data practices | ⬜ |

---

## Implementation Order

30 steps. 5 phases. Each step references requirement IDs.

### Phase 1: Fix the foundation
*Every number on screen is correct.*

| Step | Req | Do |
|------|-----|-----|
| 1 | R1.1 | Remove `Budget.spent`. Compute from transactions on read. |
| 2 | R1.2 | Fix fixed expense matching — categoryId within month, not exact date. |
| 3 | R1.3 | Fix CSV import sign logic: check category type before storing. Income → positive, Expense → negative. Currently converts all to negative. |
| 4 | R1.4 | Add Person and Property to CSV column mapping dropdown. Map "Owner" → Person, allow Property mapping. |
| 5 | R1.5 | Fix CSV account linking: per-row Account column values should look up or create accounts. "Import into account" dropdown only used when Account column is unmapped. |
| 6 | R1.6 | CSV category matching: on import, match each category name (case-insensitive) to existing categories. If match found, reuse that category (keeps group assignment like Food & Dining, Auto & Transport). If no match, create new category and assign to best-fit group using a default mapping table. Never create a flat "Imported" group. |
| 7 | R1.7 | Transaction classification: add `classification` field (expense/income/transfer) to Transaction model. Default: categories named "Transfer", "Credit Card Payment" → transfer. Income categories → income. Everything else → expense. Transfers excluded from Spending totals and budget spent calculations. Add reclassify action on transaction row (transfer ↔ income/expense). Never auto-classify as transfer based on account type or amount. |
| 8 | R1.8 | Auto-categorization: on new transaction (Plaid or CSV), (1) look up merchant history for this user — if found, apply same category + classification, (2) if Plaid, use personal_finance_category/transaction_code as hint, (3) else Uncategorized. No amount-based rules. |
| 9 | R1.9 | Write migration script: flip sign on all existing transactions where category type=income but amount<0. Classify existing transactions (transfer categories → transfer, income → income, rest → expense). Run once. |
| 10 | R7.3 | Re-test AI insights with corrected data. |

### Phase 2: Complete the data model
*Transactions carry the metadata that makes Oversikt useful.*

| Step | Req | Do |
|------|-----|-----|
| 11 | R3.1–R3.2 | HouseholdMember model + person tag on transactions. Setup UI on Settings page. |
| 12 | R4.1–R4.2 | Property model + property tag on transactions. Setup UI on Settings page. |
| 13 | R5.1–R5.4 | Debt model + Debts page. |

### Phase 3: Reshape the experience
*True Remaining first, trajectory over time, Settings consolidation.*

| Step | Req | Do |
|------|-----|-----|
| 14 | R8.1, R6.6 | Overview redesign: True Remaining hero, budget pulse, chart below fold. |
| 15 | R8.2–R8.4 | Reorder nav. Rename Insights → Monthly Review. Add Debts, Settings. Group sections. |
| 16 | R10.1–R10.6 | Settings page: profile, household members, properties, connected accounts, export, delete account. |
| 17 | R3.3–R3.4, R4.3–R4.5, R6.7 | "By Person" + "By Property" on Spending. Property filter on Transactions. Unbudgeted categories on Budgets page. |
| 18 | R5.6 | Add escrow fields to Debt model. Show escrow as third segment (gray) in payment breakdown bar. Total monthly cost = P&I + escrow. Optional field on Add/Edit debt form for mortgage type. |
| 19 | R6.8 | Category click-through: tap any category on Budgets, Spending, or Unbudgeted → navigate to Transactions filtered by that category + current month. |
| 20 | R7.1, R7.6–R7.7 | MonthlySnapshot model + cron. Baseline on first import. |
| 21 | R7.2, R7.4–R7.5, R5.5 | "Since you started" on Monthly Review with debt, person, property. |

### Phase 4: Bank connectivity
*The app stays current automatically.*

| Step | Req | Do |
|------|-----|-----|
| 22 | R2.1, R1.10 | Plaid SDK + API routes. Sign flip. |
| 23 | R2.1 | Plaid Link on Accounts page. |
| 24 | R2.2–R2.3 | Daily sync cron. Balance refresh. |

### Phase 5: Security, brand, and ship
*Hardened, branded, live.*

| Step | Req | Do |
|------|-----|-----|
| 25 | R11.1–R11.14 | Security hardening (see security spec below). |
| 26 | R9.1 | Rebrand codebase. |
| 27 | R9.2–R9.3 | Domain + rename repo. |
| 28 | R9.4–R9.5 | Landing page + demo mode. |
| 29 | R9.6 | Mobile responsive audit at 375px. |
| 30 | — | Final verification. Ship. |

---

## V2 — What comes after

V2 adds intelligence and tax. "Shows you what's true" becomes "helps you optimize."

| ID | Scope |
|----|-------|
| V2.1 | Tax system — Schedule E, IRS crosswalk, deduction strategies |
| V2.2 | Spending benchmarks — BLS data comparisons |
| V2.3 | Smart debt engine — type-aware payoff modeling: |
| | — Avalanche vs snowball vs hybrid strategies with projected payoff dates and total interest |
| | — Student loans: standard vs IDR vs forgiveness path modeling. Breakeven analysis (forgiveness tax hit vs payoff cost). Interest deduction ($2,500/yr cap). |
| | — Auto loans: interest deductible if vehicle is predominantly American-manufactured. Personal property tax on vehicle deductible (SALT, subject to $10K cap). Vehicle cost basis up to $40K for clean vehicle credit eligibility. Track manufacture origin flag on debt. |
| | — Mortgages: refinance modeling (rate comparison, breakeven month). Interest deduction. PMI dropoff point. Rental income offset. |
| | — Credit cards: always priority target, no tax benefit. Minimum payment trap visualization. |
| | — "What if" simulator: extra $X/month → how much faster, how much interest saved |
| V2.4 | Multi-user household — separate logins, permissions, settlement |
| V2.5 | Contextual AI on every page — inline observations, cached daily |
| V2.6 | Share/export Monthly Review |
| V2.7 | Smart auto-tagging — AI suggests person/property from patterns |
| V2.8 | Spending vs Benchmark — move from V1 Monthly Review to V2. Replace generic AI-generated medians with meaningful benchmarks: (a) user's own historical averages ("40% more than your 6-month avg"), (b) BLS Consumer Expenditure data filtered by household size and region. Current V1 medians lack context (household size, location, income) and feel arbitrary. |
| V2.9 | Onboarding wizard |
| V2.10 | Depreciation tracking for rental improvements |
| V2.11 | Property value and equity tracker — estimated value, equity = value minus balance, appreciation trends |
| V2.12 | API access layer — expose tax engine, debt modeling, and benchmarks as versioned endpoints. Enables CPA integrations, agent access, and B2B2C channels without rebuilding core logic. |

---

## Security Spec (Step 25)

Step 25 is a dedicated security hardening pass. Claude Code addresses each R11 requirement:

### Authentication (R11.1–R11.3)
```
R11.1 — Already done: bcrypt password hashing. Verify: no plaintext passwords
        anywhere in codebase (grep for password storage patterns).

R11.2 — JWT hardening:
  - Tokens set as HttpOnly cookies (not localStorage)
  - Secure flag = true (HTTPS only)
  - SameSite = Strict (no cross-site requests)
  - Token expiry: 1 hour access token, 7 day refresh token
  - Refresh token rotation: issue new refresh token on each use, invalidate old one
  - If currently using localStorage for JWT, migrate to HttpOnly cookies

R11.3 — Rate limiting on auth endpoints:
  - /api/auth/login: max 5 attempts per IP per 15 minutes
  - /api/auth/register: max 3 per IP per hour
  - Implementation: use Vercel Edge Middleware or upstash/ratelimit
  - Return 429 Too Many Requests with Retry-After header
```

### Data isolation (R11.4)
```
Audit every API route and Prisma query:
  - Every SELECT, UPDATE, DELETE must include WHERE userId = currentUser.id
  - No endpoint accepts a userId parameter from the client (derive from JWT)
  - Test: create two users, verify User A cannot access User B's
    transactions, budgets, debts, household members, or properties
  - Prisma middleware option: add a global filter that enforces userId scoping
```

### Plaid security (R11.5–R11.6)
```
R11.5 — Encrypt Plaid access tokens at rest:
  - Use AES-256-GCM encryption before storing in database
  - Encryption key stored in PLAID_ENCRYPTION_KEY env var (not in code)
  - Decrypt only server-side when making Plaid API calls
  - access_token, item_id never appear in API responses to frontend

R11.6 — Plaid Link architecture (inherent):
  - Bank credentials are entered in Plaid's hosted UI (Link)
  - Oversikt receives a public_token → exchanges for access_token server-side
  - Oversikt never sees, stores, or transmits bank usernames or passwords
  - Document this in the security page for users
```

### AI data handling (R11.7–R11.9)
```
R11.7 — Data minimization in AI prompts:
  Audit the Anthropic API call in the insights/review generation.
  The prompt should send:
    ✅ Aggregated spending by category (e.g., "Groceries: $211.48")
    ✅ Budget limits and utilization percentages
    ✅ Monthly totals (income, expenses, savings rate)
    ✅ Debt summary (total balance, avg rate — no account numbers)
    ✅ Person names (first name only, user-created)
    ✅ Property names and types
  The prompt must NOT send:
    ❌ Bank account numbers or routing numbers
    ❌ Plaid access tokens
    ❌ Full merchant names with location details (use category only where possible)
    ❌ Email addresses or full names from auth
    ❌ Transaction IDs or internal database IDs

R11.8 — Verify: grep AI prompt construction code. Confirm no Plaid tokens,
         account numbers, or sensitive identifiers in the prompt string.

R11.9 — Anthropic API data policy: API inputs/outputs are not used for
         model training. Document this on the security page.
         Reference: https://www.anthropic.com/policies/privacy
```

### Infrastructure (R11.10–R11.13)
```
R11.10 — Environment variables audit:
  - Verify .env is in .gitignore
  - Verify no secrets hardcoded in source files:
    grep -r "sk-ant\|sk_live\|access-development\|PLAID_SECRET" src/
  - All secrets in Vercel Environment Variables dashboard
  - .env.example lists required vars with placeholder values (no real secrets)

R11.11 — HTTPS: Vercel enforces by default. Verify no http:// URLs in code.

R11.12 — Input validation:
  - Prisma parameterized queries prevent SQL injection (inherent)
  - Verify: API routes validate input types (amounts are numbers, dates are dates)
  - Verify: no raw SQL queries (prisma.$queryRaw) without parameterization

R11.13 — CSRF protection:
  - If using HttpOnly cookies for auth: add CSRF token to mutation requests
  - Or: verify SameSite=Strict cookie prevents cross-origin requests
  - Next.js API routes with SameSite=Strict cookies are generally CSRF-safe
```

### Security page (R11.14)
```
Create /security (or /about/security) — a public page accessible from the
landing page footer. Content:

"How Oversikt protects your data"

1. Your bank credentials
   Oversikt never sees your bank username or password. We use Plaid, a
   trusted financial data platform used by thousands of apps, to connect
   to your bank. Your credentials are entered directly in Plaid's secure
   interface.

2. Your financial data
   - All data encrypted in transit (HTTPS/TLS)
   - Database encrypted at rest (provided by hosting infrastructure)
   - Each user's data is isolated — no one can see another user's information

3. AI-powered insights
   When generating your Monthly Review, we send aggregated spending
   summaries (like "Groceries: $211") to our AI provider (Anthropic).
   We never send bank account numbers, login credentials, or other
   sensitive identifiers. Anthropic does not use API data to train their
   models.

4. What we don't do
   - We don't sell your data
   - We don't share individual financial data with third parties
   - We don't store your bank login credentials
   - We don't display ads

5. Account control
   You can disconnect bank accounts, export your data, or delete your
   account entirely from Settings at any time.
```

---

## Working with Claude Code

### Starting a task
```
Read /docs/PRD.md. Implement Step [N], requirements [R-IDs].
```

### Rules
1. Read the PRD first. Every time.
2. Implement what's specified. Nothing outside current step.
3. Ambiguous? Stop and ask.
4. Conflict? Flag it.
5. When done: files changed, schema changes, open questions.
6. Don't touch other steps.
7. **Run `npm run build` after every file change.** Fix all type errors and build failures before moving to the next file or reporting the step as done. Never commit or deploy code that doesn't compile.
8. **Run `npx tsc --noEmit` before `npm run build`** to catch type errors early without a full build cycle.
9. **When editing a file, read the full file first.** Don't assume variable locations or declaration order. Check where variables are declared before referencing them.

### After a session
1. `npm run build` passes with zero errors — **non-negotiable**.
2. Update PRD status columns.
3. Commit.
4. Next step.

---

## Schema Reference

### MonthlySnapshot (Step 20)
```prisma
model MonthlySnapshot {
  id                String   @id @default(cuid())
  userId            String
  month             DateTime
  trueRemaining     Float
  totalIncome       Float
  totalExpenses     Float
  savingsRate       Float
  netSurplus        Float
  annualFundedPct   Float
  budgetsOnTrack    Int
  budgetsTotal      Int
  fixedPaid         Int
  fixedTotal        Int
  flexOverBudget    Int
  transactionCount  Int
  avgDailySpend     Float
  totalDebt         Float?
  totalDebtPayments Float?
  debtPaidDown      Float?
  personBreakdown   String?
  propertyBreakdown String?
  reviewHeadline    String?
  reviewBody        String?
  efficiencyScore   Int?
  spendingScore     Int?
  savingsScore      Int?
  debtScore         Int?
  createdAt         DateTime @default(now())
  user              User     @relation(fields: [userId], references: [id])
  @@unique([userId, month])
  @@index([userId])
}
```

### HouseholdMember (Step 11)
```prisma
model HouseholdMember {
  id           String        @id @default(cuid())
  userId       String
  name         String
  isDefault    Boolean       @default(false)
  createdAt    DateTime      @default(now())
  user         User          @relation(fields: [userId], references: [id])
  transactions Transaction[]
  @@index([userId])
}
```

### Property (Step 12)
```prisma
model Property {
  id           String        @id @default(cuid())
  userId       String
  name         String
  type         PropertyType
  isDefault    Boolean       @default(false)
  createdAt    DateTime      @default(now())
  user         User          @relation(fields: [userId], references: [id])
  transactions Transaction[]
  debts        Debt[]
  @@index([userId])
}
enum PropertyType { PERSONAL RENTAL }
```

### Debt (Step 13)
```prisma
model Debt {
  id              String    @id @default(cuid())
  userId          String
  name            String
  type            DebtType
  currentBalance  Float
  originalBalance Float?
  interestRate    Float
  minimumPayment  Float
  escrowAmount    Float?    // Optional: monthly taxes + insurance for mortgages
  paymentDay      Int?
  termMonths      Int?
  startDate       DateTime?
  propertyId      String?
  property        Property? @relation(fields: [propertyId], references: [id])
  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  user            User      @relation(fields: [userId], references: [id])
  @@index([userId])
}
enum DebtType { MORTGAGE STUDENT_LOAN AUTO CREDIT_CARD PERSONAL_LOAN OTHER }
```

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-02-23 | 1.0 | Initial PRD. 24 steps, V1/V1.1/V2 split. |
| 2026-02-23 | 2.0 | Simplified. Two releases: V1 and V2. Household, property, debts in V1. 20 steps, 5 phases. |
| 2026-02-23 | 2.1 | Added R10 (Settings), R11 (Security). Security spec with AI data handling, Plaid encryption, auth hardening. 22 steps. |
| 2026-02-23 | 2.2 | Fixed R1: income sign bug (Ledyard Bank -$1,583 should be +$1,583), CSV import must auto-create accounts. R1 now has 6 sub-requirements. 23 steps. |
| 2026-02-23 | 2.2 | Status update: Phase 1 ✅, Phase 2 ✅, Phase 3 🟡 in progress. R1–R5, R6.1–R6.2 all green. |
| 2026-02-23 | 2.3 | Reverted R1.1, R1.2, R6.1, R6.2 to 🔴 — screenshot confirms Budget.spent still $0 and Fixed expenses still MISSED. Added R6.7: surface unbudgeted categories. Phase 1 NOT complete. |
| 2026-02-23 | 2.4 | Added Claude Code rules 7-9: mandatory build check after every file change, tsc type-check, read full file before editing. |
| 2026-02-23 | 2.5 | CSV import: mapping UI exists but missing Person/Property in dropdown. Amount 1583.33 positive in CSV but stored as -$1,583.33 — sign logic inverted for income. Account column detected but "Import into account" overrides to none. R1.3–R1.6 rewritten. Added migration step. 25 steps. |
| 2026-02-23 | 2.6 | Added R5.6 (mortgage escrow — optional monthly escrow in payment breakdown), R6.8 (category click-through to filtered transactions). Added V2.10 (property value/equity tracker). 27 steps. |
| 2026-02-24 | 2.7 | Added R1.6 (CSV category matching to existing groups — fixes "Imported" flat group), R1.7 (transaction classification: expense/income/transfer — transfers excluded from spending to prevent double-counting). 29 steps. |
| 2026-02-24 | 2.8 | Added R1.8 (auto-categorization by merchant history + Plaid metadata — no amount-based rules), R6.9 (Annual "Due month"→"Planned month", Flexible defaults Monthly), R6.10 (income/expense graph colors), R1.2 updated (mortgage pulling credit card payments — strict categoryId match), R9.6 updated (sidebar doesn't collapse on mobile). 30 steps. |
| 2026-02-24 | 2.9 | Added R1.5a (account type detection — all defaulting to Checking), R1.5b (account balances computed from transaction sums — must be manual for CSV, Plaid-only for real balances, fix floating point display). Added R3.2a (link accounts to person — drives default person tag), R3.3a (person click-through to filtered transactions), R5.7 (debt add doesn't refresh). |
| 2026-02-24 | 2.10 | Added R10.2a (duplicate prevention — Caroline appears twice, Nicoll St Duplex appears twice on Settings). Added R6.4a (Budgets page AI Budget Builder does nothing when budgets exist — should offer regenerate/adjust). |
| 2026-02-24 | 2.11 | R5.6 escrow logic fixed (user enters total payment, subtracts escrow to get P&I). R5.7 debt add refresh bug. R7.5a recommendation action loop (complete + dismiss feedback persisted, fed to future AI prompts). R7.3a de-emphasize Spending vs Benchmark in V1 (medians lack context). V2.3 auto loan tax details corrected (American-manufactured interest deduction, personal property tax, $40K clean vehicle). V2.8 added (proper benchmarking with BLS data + historical self-comparison). 30 steps. |
| 2026-02-24 | 2.12 | Status sync from Claude Code PROGRESS.md. Phase 1: R1.1–R1.7, R1.9 → 🟢 (9/12 done, R1.5a, R1.5b, R1.8 remaining). Phase 2: all 🟢. Phase 3: all 🟢 (R3.3, R3.3a, R3.4, R4.3–R4.5, R5.5, R5.6, R6.6–R6.8, R7.1–R7.2, R7.4–R7.7, R8.1–R8.4, R9.6, R10.1–R10.6). Step 29 (mobile responsive) done early. |
| 2026-02-24 | 2.13 | Architecture: added Design Principle 7 (engine separation — tax, amortization, benchmark logic in /lib/engines/, not route handlers). Purpose statement updated ("first interface, not the only one"). Fixed Security Spec intro (Step 17 → Step 25). Fixed duplicate V2.8 (Onboarding wizard → V2.9, cascade renumbered). Added V2.12 (API access layer — versioned endpoints for tax engine, debt modeling, benchmarks). |
| 2026-02-24 | 2.14 | Status sync: Phases 1–3 fully complete. R1.5a, R1.5b, R5.7, R6.4a, R6.9, R6.10, R7.3a, R7.5a, R10.2a → 🟢. 108/108 tests passing. Only open V1 items: R1.8 (auto-categorization, deferred to Plaid), R3.2a (account-person linking), Phase 4 (Plaid), Phase 5 (Security/Brand/Ship). |
| 2026-02-24 | 2.15 | Data integrity pass: R1.11 (paycheck sign regression — $11K Jan paychecks negative), R1.12 (CSV import account dropdown defaults to wrong account), R1.13 (categories not connecting on import), R1.14 (Overview Total Balance inaccurate), R1.15 (comprehensive data audit). New features: R5.8 (transaction-debt linking — payments reduce balance, visible from Debts page), R7.8 (Monthly Review time-scoped with click-through to transactions), R8.5 (Overview "View all" button broken). Realign PROGRESS.md step numbers to PRD. |
| 2026-02-24 | 2.16 | REGRESSION AUDIT against live app + source CSV (4,825 transactions). Verified R1.2, R1.3, R1.5b, R1.6, R1.7, R1.9, R7.3a, R10.2a are all still broken despite 🟢 status. Reset to 🔴. Specific evidence: Feb income $5,048 vs CSV truth $7,284. Feb expenses $26,863 vs truth $3,932 (transfers counted as expenses). Total Balance $3.5M (transaction sums). All categories in single "Imported" group. Duplicate "Caroline" + "Cgrubbs14" in household members. Benchmark still shows "Excessive" labels. Added R1.6a (explicit category-to-group mapping table). Updated all requirement descriptions with specific failure evidence from production data. |
| 2026-02-25 | 2.17 | Balance model redesign. R1.14: Overview "Total Balance" → "Cash Available" (Checking + Savings only). R1.5b: manual accounts use baseline balance-as-of-date, adjusted by new transactions — never sum all history. Remove recalculate-from-transactions endpoint. R7.9: Net Worth (assets minus liabilities) lives on Monthly Review with trend line, not Overview. Classification hierarchy confirmed working — Feb income $7,284 exact match. |
