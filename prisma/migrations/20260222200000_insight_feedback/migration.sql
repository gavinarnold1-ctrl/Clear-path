-- AlterTable: Insight — add feedback and context fields
ALTER TABLE "Insight" ADD COLUMN "dismissReason" TEXT;
ALTER TABLE "Insight" ADD COLUMN "completionNotes" TEXT;
ALTER TABLE "Insight" ADD COLUMN "contextSnapshot" TEXT;

-- CreateTable: InsightFeedback
CREATE TABLE "InsightFeedback" (
    "id" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER,
    "helpful" BOOLEAN,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsightFeedback_insightId_userId_key" ON "InsightFeedback"("insightId", "userId");
CREATE INDEX "InsightFeedback_userId_idx" ON "InsightFeedback"("userId");

-- AddForeignKey
ALTER TABLE "InsightFeedback" ADD CONSTRAINT "InsightFeedback_insightId_fkey"
    FOREIGN KEY ("insightId") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsightFeedback" ADD CONSTRAINT "InsightFeedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
