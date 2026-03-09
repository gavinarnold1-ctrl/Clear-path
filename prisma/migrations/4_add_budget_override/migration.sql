-- AlterTable: Add optional budgetId to Transaction for manual budget override
ALTER TABLE "Transaction" ADD COLUMN "budgetId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_userId_budgetId_idx" ON "Transaction"("userId", "budgetId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
