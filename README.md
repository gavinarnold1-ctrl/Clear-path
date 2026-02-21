# Clear-path

A simple, honest budgeting app — track income and expenses, set budgets by category, and see where your money goes.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (dev) → PostgreSQL (prod) via Prisma |
| Testing | Vitest + Testing Library |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Set up your environment
cp .env.example .env

# 3. Push the schema to the local SQLite database
npm run db:push

# 4. (Optional) Seed demo data
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Run tests once |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run db:push` | Sync Prisma schema → database |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |

## Project structure

```
src/
├── app/
│   ├── (auth)/          # Login & register pages
│   ├── (dashboard)/     # Protected dashboard pages + sidebar layout
│   ├── api/             # Route handlers (transactions, accounts, budgets, categories)
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Landing page
├── components/
│   ├── ui/              # Reusable primitives (buttons, inputs, cards)
│   ├── forms/           # Form components (TransactionForm, BudgetForm, …)
│   └── charts/          # Spending / budget charts
├── hooks/               # Custom React hooks
├── lib/
│   ├── db.ts            # Prisma client singleton
│   └── utils.ts         # formatCurrency, formatDate, budgetProgress, cn
└── types/
    └── index.ts         # Shared TypeScript types

prisma/
├── schema.prisma        # Database schema
└── seed.ts              # Demo seed data

tests/
└── lib/
    └── utils.test.ts    # Unit tests for utility functions
```
