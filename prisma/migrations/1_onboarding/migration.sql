-- ============================================================================
-- Migration: Onboarding quiz + profile models
-- Adds UserProfile, HouseholdMember, Property tables.
-- Extends AccountType enum, Account, Category, and Transaction models.
-- Fully idempotent — safe to run against a partially-initialized database.
-- ============================================================================

-- ─── Extend AccountType enum ────────────────────────────────────────────────

DO $$ BEGIN
    ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'MORTGAGE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'AUTO_LOAN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'STUDENT_LOAN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Account: new columns ───────────────────────────────────────────────────

ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "institution" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "isManual" BOOLEAN NOT NULL DEFAULT true;

-- ─── Category: new columns ──────────────────────────────────────────────────

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isTaxRelevant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "scheduleECategory" TEXT;

-- ─── Transaction: new columns ───────────────────────────────────────────────

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "originalCategory" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "importSource" TEXT;

-- ─── UserProfile ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "primaryGoal" TEXT,
    "householdType" TEXT,
    "hasRentalProperty" BOOLEAN NOT NULL DEFAULT false,
    "debtLevel" TEXT,
    "categoryMode" TEXT,
    "pendingSetup" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_userId_key" ON "UserProfile"("userId");

DO $$ BEGIN
    ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── HouseholdMember ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "HouseholdMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HouseholdMember_userId_idx" ON "HouseholdMember"("userId");

DO $$ BEGIN
    ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Property ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Property" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Property_userId_idx" ON "Property"("userId");

DO $$ BEGIN
    ALTER TABLE "Property" ADD CONSTRAINT "Property_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
