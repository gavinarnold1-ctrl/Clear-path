-- ============================================================================
-- Migration: signed_amounts_and_monarch
-- Converts the data model to use signed amounts (negative = expense) and
-- restructures Category/Transaction for Monarch Money CSV compatibility.
-- ============================================================================

-- ─── Category table changes ─────────────────────────────────────────────────

-- 1. Add new columns with defaults so existing rows survive
ALTER TABLE "Category" ADD COLUMN "group" TEXT NOT NULL DEFAULT 'Other';
ALTER TABLE "Category" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Category" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Category" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. Convert type from TransactionType enum to plain text (lowercase)
ALTER TABLE "Category" ADD COLUMN "type_new" TEXT;
UPDATE "Category" SET "type_new" = LOWER("type"::text);
ALTER TABLE "Category" ALTER COLUMN "type_new" SET NOT NULL;
ALTER TABLE "Category" DROP COLUMN "type";
ALTER TABLE "Category" RENAME COLUMN "type_new" TO "type";

-- 3. Make userId nullable (null = system default category)
ALTER TABLE "Category" ALTER COLUMN "userId" DROP NOT NULL;

-- 4. Drop the color column (replaced by emoji icons)
ALTER TABLE "Category" DROP COLUMN IF EXISTS "color";

-- 5. Add unique constraint and indexes
CREATE UNIQUE INDEX "Category_userId_type_group_name_key" ON "Category"("userId", "type", "group", "name");
CREATE INDEX "Category_type_idx" ON "Category"("type");
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- ─── Transaction table changes ──────────────────────────────────────────────

-- 1. Rename description → merchant
ALTER TABLE "Transaction" RENAME COLUMN "description" TO "merchant";

-- 2. Add new optional columns
ALTER TABLE "Transaction" ADD COLUMN "transactionType" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "originalStatement" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "tags" TEXT;

-- 3. Convert amounts: negate EXPENSE amounts so negative = money out
UPDATE "Transaction" SET "amount" = -ABS("amount") WHERE "type"::text = 'EXPENSE';
UPDATE "Transaction" SET "amount" = ABS("amount") WHERE "type"::text = 'INCOME';

-- 4. Drop the type column (no longer needed — sign encodes direction)
ALTER TABLE "Transaction" DROP COLUMN "type";

-- 5. Make accountId nullable
ALTER TABLE "Transaction" ALTER COLUMN "accountId" DROP NOT NULL;

-- 6. Add indexes
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");
CREATE INDEX "Transaction_userId_categoryId_idx" ON "Transaction"("userId", "categoryId");
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- ─── Clean up enum ──────────────────────────────────────────────────────────
DROP TYPE IF EXISTS "TransactionType";
