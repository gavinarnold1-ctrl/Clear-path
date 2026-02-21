# CLAUDE.md — AI Assistant Guide for Clear-path

This file provides context, conventions, and workflows for AI assistants (Claude and others) working in this repository. Keep it up to date as the project evolves.

---

## Project Overview

**Clear-path** is a personal budgeting web app. Users can:

- Track income and expenses across multiple accounts
- Set spending budgets by category and period
- View summary stats and recent transactions on an overview dashboard
- Manage account balances (checking, savings, credit, investment, cash)

---

## Tech Stack

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | Next.js (App Router) | ^15.1 |
| Language | TypeScript | ^5.7 |
| Styling | Tailwind CSS | ^3.4 |
| ORM | Prisma | ^5.22 |
| Database | SQLite (dev) — swap `DATABASE_URL` for PostgreSQL in prod | — |
| Testing | Vitest + Testing Library | ^2.1 |
| Runtime | Node.js | ≥ 22 |
| Package manager | npm | — |

---

## Repository Structure

```
Clear-path/
├── prisma/
│   ├── schema.prisma        # Database schema (User, Account, Transaction, Budget, Category)
│   └── seed.ts              # Demo seed data
├── src/
│   ├── app/
│   │   ├── (auth)/          # Route group: login, register pages
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/     # Route group: protected pages behind the sidebar layout
│   │   │   ├── layout.tsx       # Sidebar nav wrapper
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── transactions/page.tsx
│   │   │   ├── budgets/page.tsx
│   │   │   └── accounts/page.tsx
│   │   ├── api/
│   │   │   ├── accounts/route.ts
│   │   │   ├── budgets/route.ts
│   │   │   ├── categories/route.ts
│   │   │   └── transactions/
│   │   │       ├── route.ts         # GET list, POST create
│   │   │       └── [id]/route.ts    # GET one, PATCH, DELETE
│   │   ├── globals.css
│   │   ├── layout.tsx           # Root layout (Inter font, metadata)
│   │   └── page.tsx             # Landing page
│   ├── components/
│   │   ├── charts/          # Spending / budget visualizations
│   │   ├── forms/           # TransactionForm, BudgetForm, AccountForm, …
│   │   └── ui/              # Design-system primitives (Button, Input, Card, …)
│   ├── hooks/               # Custom React hooks (e.g. useTransactions, useBudgets)
│   ├── lib/
│   │   ├── db.ts            # Prisma client singleton (hot-reload safe)
│   │   └── utils.ts         # formatCurrency, formatDate, budgetProgress, cn
│   └── types/
│       └── index.ts         # Shared TypeScript types mirroring the Prisma schema
├── tests/
│   └── lib/
│       └── utils.test.ts    # Unit tests for utility functions
├── .env.example             # Environment variable template
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── prettier.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── CLAUDE.md                # ← you are here
```

---

## Data Model Summary

```
User
 ├── Account[]        (checking, savings, credit, …)
 ├── Category[]       (Groceries, Salary, Rent, …)
 ├── Transaction[]    (INCOME | EXPENSE | TRANSFER)
 └── Budget[]         (amount limit per category / period)
```

Key relationships:
- A `Transaction` belongs to one `Account` and optionally one `Category`.
- A `Budget` optionally targets one `Category` and has a `BudgetPeriod` (weekly / monthly / quarterly / yearly / custom).
- All resources are scoped to a `User` via `userId`; cascade-delete on user removal.

---

## Development Commands

```bash
npm install            # Install dependencies
cp .env.example .env   # Set up local environment

npm run db:push        # Sync Prisma schema → local SQLite DB
npm run db:seed        # Populate with demo data
npm run db:studio      # Open Prisma Studio GUI

npm run dev            # Start dev server at localhost:3000
npm run build          # Production build
npm run lint           # ESLint
npm run format         # Prettier

npm test               # Run tests once
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

---

## Coding Conventions

### TypeScript

- `strict: true` — no `any`, no implicit `undefined`.
- Import types with `import type { … }` when no runtime value is needed.
- Shared domain types live in `src/types/index.ts`; Prisma types are available via `@prisma/client`.

### Tailwind CSS

- Use the utility-first approach; avoid custom CSS unless Tailwind cannot express it.
- Three shared component classes are defined in `globals.css`:
  - `.card` — white rounded card with shadow
  - `.btn-primary` — filled indigo button
  - `.btn-secondary` — outlined gray button
  - `.input` — standard form input
- Brand colors: `brand-{50..900}`, plus `income` (#22c55e), `expense` (#ef4444), `transfer` (#f59e0b).

### API Routes

- Route handlers live in `src/app/api/`.
- Always return `{ error: string }` with an appropriate HTTP status on failure.
- User identity is currently passed as a query param (`?userId=…`) — replace with a proper session lookup when auth is wired up.
- Use `NextResponse.json()` for all responses.

### Database / Prisma

- The singleton client is exported from `src/lib/db.ts` as `db`. Always import from there — never instantiate `PrismaClient` elsewhere.
- Use `db.$transaction([…])` for multi-step writes.
- After changing `schema.prisma`, run `npm run db:push` (dev) or a migration in production.

### Components

- UI primitives go in `src/components/ui/` (Button, Input, Card, Badge, …).
- Form components go in `src/components/forms/` and should be controlled or use React Hook Form.
- Data-fetching components should be React Server Components where possible; use `'use client'` only when client interactivity is required.

### Testing

- Test files live in `tests/` mirroring the `src/` structure.
- Unit tests use Vitest with `globals: true` (no need to import `describe`, `it`, `expect`).
- Component tests use `@testing-library/react`.
- Mock Prisma in API tests — never hit a real database in CI.

---

## Git Workflow

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable, production-ready code |
| `claude/<description>-<id>` | AI-driven feature / fix branches |

- AI assistant branches must start with `claude/` and end with the session ID suffix from the task context.

### Commits

- Imperative mood: `Add budget progress bar`, not `Added …`.
- One logical change per commit; never mix unrelated concerns.
- Never commit `.env`, secrets, or large binaries.

### Push

```bash
git push -u origin <branch-name>
```

- Do not force-push `main`.
- Retry on network failure with exponential backoff (2 s → 4 s → 8 s → 16 s).

---

## AI Assistant Guidelines

### Before Making Changes

1. **Read every file you intend to modify** before editing.
2. **Follow existing patterns** — don't introduce new conventions when the codebase already has one.
3. **Stay in scope** — implement only what was requested; do not refactor surrounding code.

### Code Quality

- No security vulnerabilities: avoid SQL injection (use Prisma's parameterized queries), XSS, command injection.
- Do not add comments or docstrings to code you did not change.
- Remove dead code; do not leave `// removed` stubs.

### When in Doubt

- Ask before deleting files or resetting the database.
- Confirm before pushing to any branch other than the designated feature branch.
- If a task requires a new dependency, call it out explicitly rather than silently adding it.

---

## Updating This File

Update CLAUDE.md whenever:

- A new dependency is added or an existing one is upgraded significantly.
- The directory structure changes.
- New coding conventions are established.
- The database schema changes materially.
- Deployment or environment setup changes.
