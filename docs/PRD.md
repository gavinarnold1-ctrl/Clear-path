# Oversikt — Product Requirements Document

*Version 2.0 — February 23, 2026*
*This is the single source of truth. All other docs are reference material.*

-----

## How to use this document

This PRD lives in the repo at `/docs/PRD.md`. It is the authority.

**In this chat (Claude.ai):** Discuss, debate, refine. Decisions get written here.

**In Claude Code:** Every task starts with "Read /docs/PRD.md. Implement Step [N]." Don't freelance. If ambiguous, stop and ask.

**When something changes:** PRD first, then code. Never the reverse.

-----

## Purpose

Oversikt is a smart financial tool that helps people make better decisions by giving them access to their data and the insights that drive decisions.

It shows what's true and what it means. The user decides what to do.

-----

## Design Principles

1. **True Remaining over Total Balance.** Lead with the number that answers "what can I spend?" — income minus fixed obligations minus annual set-asides.
1. **What's true + what it means.** Every screen presents data and context together.
1. **Trajectory over snapshot.** Show whether you're improving. The Monthly Review is the proof.
1. **Tag everything.** Transactions carry person, property, and category. This is the foundation for household management, tax prep, and meaningful analysis.
1. **The user decides.** Surface facts and patterns, don't prescribe actions.
1. **Start recording immediately.** Monthly snapshots from day one. Every month without one is lost trajectory data.

-----

## Release Plan

|Release|What it is                |Core question                                                                                     |
|-------|--------------------------|--------------------------------------------------------------------------------------------------|
|**V1** |Complete financial picture|"What's true about my money, who spent it, what's it for, what do I owe, and am I getting better?"|
|**V2** |Intelligence + tax        |"How do I optimize, and is my tax picture clean?"                                                 |

-----

## V1 — What we're shipping

### Definition

A financial tool for households with real-world complexity: multiple people, at least one property, debts, and the need to understand whether their financial life is improving. Connects to banks, tracks budgets across three tiers, and delivers a monthly review that shows progress.

### Pages

**Daily use:**

|Page        |Purpose                                                                        |
|------------|-------------------------------------------------------------------------------|
|Overview    |What's true right now — True Remaining hero, budget pulse, recent transactions |
|Budgets     |Am I on track — Fixed (paid/missed), Flexible (progress bars), Annual (summary)|
|Spending    |Where did it go — by category, by person, by property                          |
|Annual Plan |Am I prepared — forecast chart, Auto-Fund, set-aside tracking                  |
|Debts       |What I owe — balances, rates, principal vs interest breakdown                  |
|Transactions|The raw ledger — filterable by person, property, category, account             |

**Periodic:**

|Page          |Purpose                                                                              |
|--------------|-------------------------------------------------------------------------------------|
|Monthly Review|Am I getting better — trajectory since you started, AI efficiency score, what changed|

**Setup:**

|Page      |Purpose                                                |
|----------|-------------------------------------------------------|
|Accounts  |Connected money — Plaid Link, manual accounts, balances|
|Categories|How things are organized — edit, merge, delete         |

### Requirements

#### R1. Accurate data

|ID  |Requirement                                                            |Status|
|----|-----------------------------------------------------------------------|------|
|R1.1|Budget spent computed from transactions on read, never stored          |🟢     |
|R1.2|Fixed expense paid/missed matches transactions by category within month|🟢     |
|R1.3|Amount signs enforced at API level for all mutation endpoints          |🟢     |
|R1.4|CSV import preserves original data, applies correct signs              |🟢     |
|R1.5|Plaid import flips sign convention                                     |⬜     |

#### R2. Bank connectivity

|ID  |Requirement                                      |Status|
|----|-------------------------------------------------|------|
|R2.1|Connect banks via Plaid Link on Accounts page    |⬜     |
|R2.2|Daily transaction sync via Plaid cursor-based API|⬜     |
|R2.3|Account balances refresh from Plaid              |⬜     |
|R2.4|Manual accounts supported alongside Plaid        |🟢     |

#### R3. Household awareness

|ID  |Requirement                           |Status|
|----|--------------------------------------|------|
|R3.1|Create household members (names)      |⬜     |
|R3.2|Tag transactions to a household member|⬜     |
|R3.3|Spending: "By Person" view            |⬜     |
|R3.4|Monthly Review: per-person breakdown  |⬜     |

#### R4. Property separation

|ID  |Requirement                                     |Status|
|----|------------------------------------------------|------|
|R4.1|Create properties (name, type: Personal/Rental) |⬜     |
|R4.2|Tag transactions to a property                  |⬜     |
|R4.3|Spending: "By Property" view                    |⬜     |
|R4.4|Transactions: property filter                   |⬜     |
|R4.5|Filter Rental → all rental expenses for the year|⬜     |

#### R5. Debt visibility

|ID  |Requirement                                           |Status|
|----|------------------------------------------------------|------|
|R5.1|Add debts (name, type, balance, rate, minimum payment)|⬜     |
|R5.2|Debts page: principal vs interest breakdown           |⬜     |
|R5.3|Debts page: total summary (owed, payments, avg rate)  |⬜     |
|R5.4|Debt links to property (mortgage → rental)            |⬜     |
|R5.5|Monthly Review: debt trajectory                       |⬜     |

#### R6. Budget tracking

|ID  |Requirement                                         |Status|
|----|----------------------------------------------------|------|
|R6.1|Fixed: paid/missed from transaction matching        |🟢     |
|R6.2|Flexible: accurate spent/limit with $/day remaining |🟢     |
|R6.3|Annual: funding progress with set-aside calculations|🟢     |
|R6.4|Annual Plan: apply-cash and link-transaction funding|🟢     |
|R6.5|Auto-Fund All distributes True Remaining            |🟢     |
|R6.6|True Remaining as primary metric on Overview        |🟡     |

#### R7. Monthly Review

|ID  |Requirement                              |Status|
|----|-----------------------------------------|------|
|R7.1|Monthly snapshots capture key metrics    |⬜     |
|R7.2|"Since you started" trajectory comparison|⬜     |
|R7.3|AI-generated review with efficiency score|🟢     |
|R7.4|Includes person and property breakdowns  |⬜     |
|R7.5|Includes debt paydown progress           |⬜     |
|R7.6|Baseline snapshot on first data import   |⬜     |
|R7.7|Monthly cron on 1st of each month        |⬜     |

#### R8. Information architecture

|ID  |Requirement                                                                                                     |Status|
|----|----------------------------------------------------------------------------------------------------------------|------|
|R8.1|Overview leads with True Remaining                                                                              |🟡     |
|R8.2|Nav: Overview → Budgets → Spending → Annual Plan → Debts → Transactions / Monthly Review / Accounts → Categories|🟡     |
|R8.3|"Insights" renamed "Monthly Review"                                                                             |⬜     |
|R8.4|Nav grouped: daily / periodic / setup                                                                           |⬜     |

#### R9. Brand and deployment

|ID  |Requirement                                     |Status|
|----|------------------------------------------------|------|
|R9.1|Codebase renamed to oversikt                    |🟡     |
|R9.2|Deployed to oversikt.app or oversikt.vercel.app |🔴     |
|R9.3|GitHub repo renamed                             |⬜     |
|R9.4|Landing page: definition + create account + demo|⬜     |
|R9.5|Demo mode with full seed data                   |⬜     |
|R9.6|All pages work at 375px mobile                  |🟡     |

-----

## Implementation Order

20 steps. 5 phases. Each step references requirement IDs.

### Phase 1: Fix the foundation

*Every number on screen is correct.*

|Step|Req |Do                                                                   |
|----|----|---------------------------------------------------------------------|
|1   |R1.1|Remove `Budget.spent`. Compute from transactions on read.            |
|2   |R1.2|Fix fixed expense matching — categoryId within month, not exact date.|
|3   |R1.3|Verify amount signs at API level for all mutation endpoints.         |
|4   |R7.3|Re-test AI insights with corrected data.                             |

### Phase 2: Complete the data model

*Transactions carry the metadata that makes Oversikt useful.*

|Step|Req      |Do                                                      |
|----|---------|--------------------------------------------------------|
|5   |R3.1–R3.2|HouseholdMember model + person tag on transactions + UI.|
|6   |R4.1–R4.2|Property model + property tag on transactions + UI.     |
|7   |R5.1–R5.4|Debt model + Debts page.                                |

### Phase 3: Reshape the experience

*True Remaining first, trajectory over time.*

|Step|Req                  |Do                                                                       |
|----|---------------------|-------------------------------------------------------------------------|
|8   |R8.1, R6.6           |Overview redesign: True Remaining hero, budget pulse, chart below fold.  |
|9   |R8.2–R8.4            |Reorder nav. Rename Insights → Monthly Review. Add Debts. Group sections.|
|10  |R3.3–R3.4, R4.3–R4.5 |"By Person" + "By Property" on Spending. Property filter on Transactions.|
|11  |R7.1, R7.6–R7.7      |MonthlySnapshot model + cron. Baseline on first import.                  |
|12  |R7.2, R7.4–R7.5, R5.5|"Since you started" on Monthly Review with debt, person, property.       |

### Phase 4: Bank connectivity

*The app stays current automatically.*

|Step|Req       |Do                                |
|----|----------|----------------------------------|
|13  |R2.1, R1.5|Plaid SDK + API routes. Sign flip.|
|14  |R2.1      |Plaid Link on Accounts page.      |
|15  |R2.2–R2.3 |Daily sync cron. Balance refresh. |

### Phase 5: Brand and ship

*Live on oversikt.app.*

|Step|Req      |Do                               |
|----|---------|---------------------------------|
|16  |R9.1     |Rebrand codebase.                |
|17  |R9.2–R9.3|Domain + rename repo.            |
|18  |R9.4–R9.5|Landing page + demo mode.        |
|19  |R9.6     |Mobile responsive audit at 375px.|
|20  |—        |Final verification. Ship.        |

-----

## V2 — What comes after

V2 adds intelligence and tax. "Shows you what's true" becomes "helps you optimize."

|ID   |Scope                                                          |
|-----|---------------------------------------------------------------|
|R10.1|Tax system — Schedule E, IRS crosswalk, deduction strategies   |
|R10.2|Spending benchmarks — BLS data comparisons                     |
|R10.3|Debt payoff modeling — avalanche/snowball, what-if scenarios   |
|R10.4|Multi-user household — separate logins, permissions, settlement|
|R10.5|Contextual AI on every page — inline observations, cached daily|
|R10.6|Share/export Monthly Review                                    |
|R10.7|Smart auto-tagging — AI suggests person/property from patterns |
|R10.8|Onboarding wizard                                              |
|R10.9|Depreciation tracking for rental improvements                  |

-----

## Working with Claude Code

### Starting a task

```
Read /docs/PRD.md. Implement Step [N], requirements [R-IDs].
```

### Rules

1. Read the PRD first. Every time.
1. Implement what's specified. Nothing outside current step.
1. Ambiguous? Stop and ask.
1. Conflict? Flag it.
1. When done: files changed, schema changes, open questions.
1. Don't touch other steps.

### After a session

Update PRD status columns. Commit. Next step.

-----

## Schema Reference

### MonthlySnapshot (Step 11)

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

### HouseholdMember (Step 5)

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

### Property (Step 6)

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

### Debt (Step 7)

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

-----

## Changelog

|Date      |Version|Change                                                                                    |
|----------|-------|------------------------------------------------------------------------------------------|
|2026-02-23|1.0    |Initial PRD. 24 steps, V1/V1.1/V2 split.                                                  |
|2026-02-23|2.0    |Simplified. Two releases: V1 and V2. Household, property, debts in V1. 20 steps, 5 phases.|
