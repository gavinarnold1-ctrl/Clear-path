-- ============================================================================
-- Baseline migration: creates the full schema from scratch.
-- Fully idempotent — safe to run against a partially-initialized database.
-- Matches schema.prisma as of 2026-02-22.
-- ============================================================================

-- ─── Enums (idempotent) ─────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "BudgetTier" AS ENUM ('FIXED', 'FLEXIBLE', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop legacy enum if it exists from a previous partial migration
DROP TYPE IF EXISTS "TransactionType";

-- ─── User ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- ─── Account ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Category ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "budgetTier" "BudgetTier",
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Category_userId_type_group_name_key" ON "Category"("userId", "type", "group", "name");
CREATE INDEX IF NOT EXISTS "Category_type_idx" ON "Category"("type");
CREATE INDEX IF NOT EXISTS "Category_userId_idx" ON "Category"("userId");

DO $$ BEGIN
    ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Transaction ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Transaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "merchant" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionType" TEXT,
    "originalStatement" TEXT,
    "notes" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "accountId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Transaction_userId_date_idx" ON "Transaction"("userId", "date");
CREATE INDEX IF NOT EXISTS "Transaction_userId_categoryId_idx" ON "Transaction"("userId", "categoryId");
CREATE INDEX IF NOT EXISTS "Transaction_accountId_idx" ON "Transaction"("accountId");

DO $$ BEGIN
    ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Budget ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Budget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "period" "BudgetPeriod" NOT NULL,
    "tier" "BudgetTier" NOT NULL DEFAULT 'FLEXIBLE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isAutoPay" BOOLEAN,
    "dueDay" INTEGER,
    "varianceLimit" DOUBLE PRECISION,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Budget_userId_tier_idx" ON "Budget"("userId", "tier");

DO $$ BEGIN
    ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── AnnualExpense ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AnnualExpense" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "annualAmount" DOUBLE PRECISION NOT NULL,
    "dueMonth" INTEGER NOT NULL,
    "dueYear" INTEGER NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "monthlySetAside" DOUBLE PRECISION NOT NULL,
    "funded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "actualCost" DOUBLE PRECISION,
    "actualDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AnnualExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnnualExpense_budgetId_key" ON "AnnualExpense"("budgetId");
CREATE INDEX IF NOT EXISTS "AnnualExpense_userId_dueYear_dueMonth_idx" ON "AnnualExpense"("userId", "dueYear", "dueMonth");
CREATE INDEX IF NOT EXISTS "AnnualExpense_budgetId_idx" ON "AnnualExpense"("budgetId");

DO $$ BEGIN
    ALTER TABLE "AnnualExpense" ADD CONSTRAINT "AnnualExpense_budgetId_fkey"
        FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AnnualExpense" ADD CONSTRAINT "AnnualExpense_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Insight ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Insight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "savingsAmount" DOUBLE PRECISION,
    "actionItems" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dismissReason" TEXT,
    "completionNotes" TEXT,
    "contextSnapshot" TEXT,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Insight_userId_status_idx" ON "Insight"("userId", "status");
CREATE INDEX IF NOT EXISTS "Insight_userId_category_idx" ON "Insight"("userId", "category");

DO $$ BEGIN
    ALTER TABLE "Insight" ADD CONSTRAINT "Insight_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── InsightFeedback ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "InsightFeedback" (
    "id" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER,
    "helpful" BOOLEAN,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InsightFeedback_insightId_userId_key" ON "InsightFeedback"("insightId", "userId");
CREATE INDEX IF NOT EXISTS "InsightFeedback_userId_idx" ON "InsightFeedback"("userId");

DO $$ BEGIN
    ALTER TABLE "InsightFeedback" ADD CONSTRAINT "InsightFeedback_insightId_fkey"
        FOREIGN KEY ("insightId") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "InsightFeedback" ADD CONSTRAINT "InsightFeedback_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── EfficiencyScore ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "EfficiencyScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "spendingScore" DOUBLE PRECISION NOT NULL,
    "savingsScore" DOUBLE PRECISION NOT NULL,
    "debtScore" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "breakdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EfficiencyScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EfficiencyScore_userId_period_key" ON "EfficiencyScore"("userId", "period");
CREATE INDEX IF NOT EXISTS "EfficiencyScore_userId_idx" ON "EfficiencyScore"("userId");

DO $$ BEGIN
    ALTER TABLE "EfficiencyScore" ADD CONSTRAINT "EfficiencyScore_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
