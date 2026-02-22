-- CreateEnum
CREATE TYPE "BudgetTier" AS ENUM ('FIXED', 'FLEXIBLE', 'ANNUAL');

-- AlterTable: Category — add budgetTier
ALTER TABLE "Category" ADD COLUMN "budgetTier" "BudgetTier";

-- AlterTable: Budget — add tier + fixed-tier fields
ALTER TABLE "Budget" ADD COLUMN "tier" "BudgetTier" NOT NULL DEFAULT 'FLEXIBLE';
ALTER TABLE "Budget" ADD COLUMN "isAutoPay" BOOLEAN;
ALTER TABLE "Budget" ADD COLUMN "dueDay" INTEGER;
ALTER TABLE "Budget" ADD COLUMN "varianceLimit" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Budget_userId_tier_idx" ON "Budget"("userId", "tier");

-- CreateTable: AnnualExpense
CREATE TABLE "AnnualExpense" (
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

-- CreateIndex
CREATE UNIQUE INDEX "AnnualExpense_budgetId_key" ON "AnnualExpense"("budgetId");
CREATE INDEX "AnnualExpense_userId_dueYear_dueMonth_idx" ON "AnnualExpense"("userId", "dueYear", "dueMonth");
CREATE INDEX "AnnualExpense_budgetId_idx" ON "AnnualExpense"("budgetId");

-- AddForeignKey
ALTER TABLE "AnnualExpense" ADD CONSTRAINT "AnnualExpense_budgetId_fkey"
    FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnualExpense" ADD CONSTRAINT "AnnualExpense_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
