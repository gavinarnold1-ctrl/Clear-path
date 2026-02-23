-- ============================================================================
-- Migration: Reference databases (tax rules + spending benchmarks)
-- Creates read-only reference tables that power AI recommendations.
-- Also drops stale Transaction.annualExpenseId column if it exists from
-- a previous db:push that is no longer in the Prisma schema.
-- Fully idempotent — safe to run against a partially-initialized database.
-- ============================================================================

-- ─── Cleanup: drop stale column from Transaction ──────────────────────────
-- A previous db:push may have added this column, but it was never part of
-- the intended schema. The Prisma schema does not define it.

ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "annualExpenseId";

-- ─── Tax Rules ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tax_rules" (
    "id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tax_year" INTEGER NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "form" TEXT,
    "form_line" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "applies_to" JSONB NOT NULL DEFAULT '[]',
    "property_types" JSONB NOT NULL DEFAULT '[]',
    "filing_statuses" JSONB NOT NULL DEFAULT '[]',
    "annual_limit" DOUBLE PRECISION,
    "income_phase_out_start" DOUBLE PRECISION,
    "income_phase_out_end" DOUBLE PRECISION,
    "percentage_limit" DOUBLE PRECISION,
    "irc_section" TEXT,
    "source_url" TEXT,
    "effective_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "last_verified" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tax_rules_rule_code_key" ON "tax_rules"("rule_code");
CREATE INDEX IF NOT EXISTS "tax_rules_tax_year_idx" ON "tax_rules"("tax_year");
CREATE INDEX IF NOT EXISTS "tax_rules_category_idx" ON "tax_rules"("category");
CREATE INDEX IF NOT EXISTS "tax_rules_form_idx" ON "tax_rules"("form");

-- ─── Tax Rule Thresholds ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tax_rule_thresholds" (
    "id" TEXT NOT NULL,
    "tax_rule_id" TEXT NOT NULL,
    "filing_status" TEXT NOT NULL,
    "bracket_floor" DOUBLE PRECISION NOT NULL,
    "bracket_ceiling" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "flat_amount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rule_thresholds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_rule_thresholds_tax_rule_id_idx" ON "tax_rule_thresholds"("tax_rule_id");

DO $$ BEGIN
    ALTER TABLE "tax_rule_thresholds" ADD CONSTRAINT "tax_rule_thresholds_tax_rule_id_fkey"
        FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Deduction Category Mappings ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "deduction_category_mappings" (
    "id" TEXT NOT NULL,
    "spending_category" TEXT NOT NULL,
    "property_type" TEXT,
    "tax_rule_id" TEXT,
    "form" TEXT NOT NULL,
    "form_line" TEXT,
    "schedule_e_category" TEXT,
    "allocation_method" TEXT,
    "default_allocation_pct" DOUBLE PRECISION,
    "allocation_notes" TEXT,
    "requires_receipt" BOOLEAN NOT NULL DEFAULT false,
    "min_amount_threshold" DOUBLE PRECISION,
    "max_deductible" DOUBLE PRECISION,
    "tax_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deduction_category_mappings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "deduction_category_mappings_spending_category_idx" ON "deduction_category_mappings"("spending_category");
CREATE INDEX IF NOT EXISTS "deduction_category_mappings_tax_year_idx" ON "deduction_category_mappings"("tax_year");

DO $$ BEGIN
    ALTER TABLE "deduction_category_mappings" ADD CONSTRAINT "deduction_category_mappings_tax_rule_id_fkey"
        FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Tax Calendar ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tax_calendar" (
    "id" TEXT NOT NULL,
    "tax_year" INTEGER NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "event_type" TEXT NOT NULL,
    "description" TEXT,
    "applies_to" JSONB NOT NULL DEFAULT '[]',
    "action_required" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_calendar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_calendar_tax_year_idx" ON "tax_calendar"("tax_year");
CREATE INDEX IF NOT EXISTS "tax_calendar_event_date_idx" ON "tax_calendar"("event_date");

-- ─── Spending Benchmarks ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "spending_benchmarks" (
    "id" TEXT NOT NULL,
    "survey_year" INTEGER NOT NULL,
    "income_range_low" DOUBLE PRECISION,
    "income_range_high" DOUBLE PRECISION,
    "income_quintile" INTEGER,
    "household_size" INTEGER,
    "region" TEXT,
    "age_range_low" INTEGER,
    "age_range_high" INTEGER,
    "housing_tenure" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "app_category" TEXT,
    "annual_mean" DOUBLE PRECISION NOT NULL,
    "monthly_mean" DOUBLE PRECISION NOT NULL,
    "annual_median" DOUBLE PRECISION,
    "share_of_total" DOUBLE PRECISION,
    "sample_size" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'BLS Consumer Expenditure Survey',
    "source_table" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spending_benchmarks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "spending_benchmarks_income_range_idx" ON "spending_benchmarks"("income_range_low", "income_range_high");
CREATE INDEX IF NOT EXISTS "spending_benchmarks_region_idx" ON "spending_benchmarks"("region");
CREATE INDEX IF NOT EXISTS "spending_benchmarks_category_idx" ON "spending_benchmarks"("category");
CREATE INDEX IF NOT EXISTS "spending_benchmarks_app_category_idx" ON "spending_benchmarks"("app_category");

-- ─── Spending Category Crosswalk ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "spending_category_crosswalk" (
    "id" TEXT NOT NULL,
    "bls_category" TEXT NOT NULL,
    "bls_subcategory" TEXT,
    "app_category" TEXT NOT NULL,
    "mapping_confidence" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spending_category_crosswalk_pkey" PRIMARY KEY ("id")
);

-- ─── Income Benchmarks ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "income_benchmarks" (
    "id" TEXT NOT NULL,
    "survey_year" INTEGER NOT NULL,
    "metric" TEXT NOT NULL,
    "region" TEXT,
    "household_type" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_benchmarks_pkey" PRIMARY KEY ("id")
);
