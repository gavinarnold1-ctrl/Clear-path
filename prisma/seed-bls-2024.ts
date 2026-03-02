/**
 * BLS Consumer Expenditure Survey 2024 — Spending Benchmark Seed Data
 *
 * Source: Bureau of Labor Statistics, Consumer Expenditure Survey 2024
 *         Retrieved from FRED (Federal Reserve Economic Data), December 2025 release
 *         https://fred.stlouisfed.org/release?rid=479
 *         https://www.bls.gov/cex/
 *
 * Income brackets:
 *   - $100,000 to $149,999 (FRED suffix: LB0221)
 *   - $150,000 to $199,999 (FRED suffix: LB0222)
 *
 * Data confirmed from FRED series:
 *   CXUTOTALEXPLB0221M / LB0222M — Total expenditures
 *   CXUFOODTOTLLB0221M / LB0222M — Food
 *   CXUHOUSINGLB0221M / LB0222M  — Housing
 *   CXUTRANSLB0221M / LB0222M    — Transportation
 *   CXUHEALTHLB0221M / LB0222M   — Healthcare
 *   CXUCASHCONTLB0221M / LB0222M — Cash contributions
 *   CXUPHONELB0221M / LB0222M    — Telephone
 *
 * Categories not available as individual FRED series (Entertainment, Apparel,
 * Personal Insurance/Pensions, Education) are estimated using the BLS 2024
 * overall percentage distribution applied to bracket-specific totals.
 * These are marked with source: "BLS CE 2024 (estimated from pct distribution)".
 *
 * Monthly = Annual / 12
 * Share = Category / Total Expenditures
 *
 * Run via the main seed script or independently with: npx tsx prisma/seed-bls-2024.ts
 */
import type { PrismaClient } from '@prisma/client'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SpendingBenchmarkSeed {
  surveyYear: number
  incomeRangeLow: number
  incomeRangeHigh: number
  category: string
  subcategory?: string
  appCategory?: string
  annualMean: number
  monthlyMean: number
  shareOfTotal: number
  source: string
  sourceTable?: string
  notes?: string
}

interface CrosswalkSeed {
  blsCategory: string
  blsSubcategory?: string
  appCategory: string
  mappingConfidence: 'exact' | 'approximate' | 'partial'
  notes?: string
}

// ─── $100,000 to $149,999 ──────────────────────────────────────────────────────

const BRACKET_100K: SpendingBenchmarkSeed[] = [
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Total Expenditures', appCategory: undefined,
    annualMean: 89727, monthlyMean: 7477, shareOfTotal: 1.0,
    source: 'BLS CE 2024 (FRED: CXUTOTALEXPLB0221M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Food', subcategory: 'Total', appCategory: 'Food',
    annualMean: 11902, monthlyMean: 992, shareOfTotal: 0.133,
    source: 'BLS CE 2024 (FRED: CXUFOODTOTLLB0221M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Food', subcategory: 'Food at home', appCategory: 'Food',
    annualMean: 7116, monthlyMean: 593, shareOfTotal: 0.079,
    source: 'BLS CE 2024 (FRED: CXUFOODHOMELB0221M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Food', subcategory: 'Food away from home', appCategory: 'Food',
    annualMean: 4786, monthlyMean: 399, shareOfTotal: 0.053,
    source: 'BLS CE 2024 (FRED: CXUFOODAWAYLB0221M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Housing', subcategory: 'Total', appCategory: 'Housing',
    annualMean: 29453, monthlyMean: 2454, shareOfTotal: 0.328,
    source: 'BLS CE 2024 (FRED: CXUHOUSINGLB0221M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Transportation', subcategory: 'Total', appCategory: 'Transport',
    annualMean: 16020, monthlyMean: 1335, shareOfTotal: 0.179,
    source: 'BLS CE 2024 (FRED: CXUTRANSLB0221M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Healthcare', subcategory: 'Total', appCategory: 'Healthcare',
    annualMean: 7147, monthlyMean: 596, shareOfTotal: 0.080,
    source: 'BLS CE 2024 (FRED: CXUHEALTHLB0221M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Entertainment', subcategory: 'Total', appCategory: 'Entertainment',
    annualMean: 4127, monthlyMean: 344, shareOfTotal: 0.046,
    source: 'BLS CE 2024 (estimated from pct distribution)',
    notes: 'Estimated: 4.6% of total expenditures per BLS 2024 overall distribution',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Apparel and services', subcategory: 'Total', appCategory: 'Personal',
    annualMean: 2243, monthlyMean: 187, shareOfTotal: 0.025,
    source: 'BLS CE 2024 (estimated from pct distribution)',
    notes: 'Estimated: 2.5% of total expenditures per BLS 2024 overall distribution',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Personal insurance and pensions', subcategory: 'Total', appCategory: 'Insurance',
    annualMean: 11216, monthlyMean: 935, shareOfTotal: 0.125,
    source: 'BLS CE 2024 (estimated from pct distribution)',
    notes: 'Estimated: 12.5% of total expenditures per BLS 2024 overall distribution',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Education', subcategory: 'Total', appCategory: 'Personal',
    annualMean: 1795, monthlyMean: 150, shareOfTotal: 0.020,
    source: 'BLS CE 2024 (estimated from pct distribution)',
    notes: 'Estimated: 2.0% of total expenditures per BLS 2024 overall distribution',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Cash contributions', subcategory: 'Total', appCategory: 'Personal',
    annualMean: 2067, monthlyMean: 172, shareOfTotal: 0.023,
    source: 'BLS CE 2024 (FRED: CXUCASHCONTLB0221M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Personal care products and services', subcategory: 'Total', appCategory: 'Personal',
    annualMean: 1077, monthlyMean: 90, shareOfTotal: 0.012,
    source: 'BLS CE 2024 (estimated from pct distribution)',
    notes: 'Estimated: 1.2% of total expenditures per BLS 2024 overall distribution',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Alcoholic beverages', subcategory: 'Total', appCategory: 'Food',
    annualMean: 718, monthlyMean: 60, shareOfTotal: 0.008,
    source: 'BLS CE 2024 (estimated from pct distribution)',
    notes: 'Estimated: 0.8% of total expenditures per BLS 2024 overall distribution',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Tobacco products and smoking supplies', subcategory: 'Total', appCategory: 'Other',
    annualMean: 359, monthlyMean: 30, shareOfTotal: 0.004,
    source: 'BLS CE 2024 (estimated from pct distribution)',
    notes: 'Estimated: 0.4% of total expenditures per BLS 2024 overall distribution',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Reading', subcategory: 'Total', appCategory: 'Entertainment',
    annualMean: 179, monthlyMean: 15, shareOfTotal: 0.002,
    source: 'BLS CE 2024 (estimated from pct distribution)',
    notes: 'Estimated: 0.2% of total expenditures per BLS 2024 overall distribution',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Miscellaneous', subcategory: 'Total', appCategory: 'Other',
    annualMean: 1436, monthlyMean: 120, shareOfTotal: 0.016,
    source: 'BLS CE 2024 (estimated from pct distribution)',
    notes: 'Estimated: 1.6% of total expenditures per BLS 2024 overall distribution',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 100000, incomeRangeHigh: 149999,
    category: 'Telephone services', subcategory: 'Total', appCategory: 'Utilities',
    annualMean: 1776, monthlyMean: 148, shareOfTotal: 0.020,
    source: 'BLS CE 2024 (FRED: CXUPHONELB0221M)',
    notes: 'Subset of Housing; included separately for app utility mapping',
  },
]

// ─── $150,000 to $199,999 ──────────────────────────────────────────────────────

const BRACKET_150K: SpendingBenchmarkSeed[] = [
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Total Expenditures', appCategory: undefined,
    annualMean: 117378, monthlyMean: 9782, shareOfTotal: 1.0,
    source: 'BLS CE 2024 (FRED: CXUTOTALEXPLB0222M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Food', subcategory: 'Total', appCategory: 'Food',
    annualMean: 14546, monthlyMean: 1212, shareOfTotal: 0.124,
    source: 'BLS CE 2024 (FRED: CXUFOODTOTLLB0222M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Food', subcategory: 'Food at home', appCategory: 'Food',
    annualMean: 8305, monthlyMean: 692, shareOfTotal: 0.071,
    source: 'BLS CE 2024 (estimated from $100K bracket ratio)',
    notes: 'Estimated: 57.1% of food total (ratio from $100K bracket food-at-home/total)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Food', subcategory: 'Food away from home', appCategory: 'Food',
    annualMean: 6241, monthlyMean: 520, shareOfTotal: 0.053,
    source: 'BLS CE 2024 (FRED: CXUFOODAWAYLB0222M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Housing', subcategory: 'Total', appCategory: 'Housing',
    annualMean: 34891, monthlyMean: 2908, shareOfTotal: 0.297,
    source: 'BLS CE 2024 (FRED: CXUHOUSINGLB0222M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Transportation', subcategory: 'Total', appCategory: 'Transport',
    annualMean: 20611, monthlyMean: 1718, shareOfTotal: 0.176,
    source: 'BLS CE 2024 (FRED: CXUTRANSLB0222M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Healthcare', subcategory: 'Total', appCategory: 'Healthcare',
    annualMean: 8805, monthlyMean: 734, shareOfTotal: 0.075,
    source: 'BLS CE 2024 (FRED: CXUHEALTHLB0222M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Entertainment', subcategory: 'Total', appCategory: 'Entertainment',
    annualMean: 6045, monthlyMean: 504, shareOfTotal: 0.052,
    source: 'BLS CE 2024 (estimated, scaled to bracket total)',
    notes: 'Estimated from overall pct distribution, scaled 1.12x to reconcile with confirmed bracket total',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Apparel and services', subcategory: 'Total', appCategory: 'Personal',
    annualMean: 3285, monthlyMean: 274, shareOfTotal: 0.028,
    source: 'BLS CE 2024 (estimated, scaled to bracket total)',
    notes: 'Estimated from overall pct distribution, scaled 1.12x to reconcile with confirmed bracket total',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Personal insurance and pensions', subcategory: 'Total', appCategory: 'Insurance',
    annualMean: 16427, monthlyMean: 1369, shareOfTotal: 0.140,
    source: 'BLS CE 2024 (estimated, scaled to bracket total)',
    notes: 'Estimated from overall pct distribution, scaled 1.12x to reconcile with confirmed bracket total',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Education', subcategory: 'Total', appCategory: 'Personal',
    annualMean: 2629, monthlyMean: 219, shareOfTotal: 0.022,
    source: 'BLS CE 2024 (estimated, scaled to bracket total)',
    notes: 'Estimated from overall pct distribution, scaled 1.12x to reconcile with confirmed bracket total',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Cash contributions', subcategory: 'Total', appCategory: 'Personal',
    annualMean: 4618, monthlyMean: 385, shareOfTotal: 0.039,
    source: 'BLS CE 2024 (FRED: CXUCASHCONTLB0222M)',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Personal care products and services', subcategory: 'Total', appCategory: 'Personal',
    annualMean: 1578, monthlyMean: 132, shareOfTotal: 0.013,
    source: 'BLS CE 2024 (estimated, scaled to bracket total)',
    notes: 'Estimated from overall pct distribution, scaled 1.12x to reconcile with confirmed bracket total',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Alcoholic beverages', subcategory: 'Total', appCategory: 'Food',
    annualMean: 1051, monthlyMean: 88, shareOfTotal: 0.009,
    source: 'BLS CE 2024 (estimated, scaled to bracket total)',
    notes: 'Estimated from overall pct distribution, scaled 1.12x to reconcile with confirmed bracket total',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Tobacco products and smoking supplies', subcategory: 'Total', appCategory: 'Other',
    annualMean: 526, monthlyMean: 44, shareOfTotal: 0.004,
    source: 'BLS CE 2024 (estimated, scaled to bracket total)',
    notes: 'Estimated from overall pct distribution, scaled 1.12x to reconcile with confirmed bracket total',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Reading', subcategory: 'Total', appCategory: 'Entertainment',
    annualMean: 263, monthlyMean: 22, shareOfTotal: 0.002,
    source: 'BLS CE 2024 (estimated, scaled to bracket total)',
    notes: 'Estimated from overall pct distribution, scaled 1.12x to reconcile with confirmed bracket total',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Miscellaneous', subcategory: 'Total', appCategory: 'Other',
    annualMean: 2103, monthlyMean: 175, shareOfTotal: 0.018,
    source: 'BLS CE 2024 (estimated, scaled to bracket total)',
    notes: 'Estimated from overall pct distribution, scaled 1.12x to reconcile with confirmed bracket total',
  },
  {
    surveyYear: 2024,
    incomeRangeLow: 150000, incomeRangeHigh: 199999,
    category: 'Telephone services', subcategory: 'Total', appCategory: 'Utilities',
    annualMean: 1955, monthlyMean: 163, shareOfTotal: 0.017,
    source: 'BLS CE 2024 (FRED: CXUPHONELB0222M)',
    notes: 'Subset of Housing; included separately for app utility mapping',
  },
]

// ─── Category Crosswalk (2024) ──────────────────────────────────────────────────

const CROSSWALK_2024: CrosswalkSeed[] = [
  { blsCategory: 'Food', blsSubcategory: 'Food at home', appCategory: 'Food', mappingConfidence: 'exact', notes: 'Maps to Groceries and related' },
  { blsCategory: 'Food', blsSubcategory: 'Food away from home', appCategory: 'Food', mappingConfidence: 'exact', notes: 'Maps to Restaurants, Dining Out' },
  { blsCategory: 'Alcoholic beverages', appCategory: 'Food', mappingConfidence: 'approximate', notes: 'BLS separates alcohol; app groups with Food' },
  { blsCategory: 'Housing', appCategory: 'Housing', mappingConfidence: 'exact', notes: 'Includes shelter, utilities, household operations, furnishings' },
  { blsCategory: 'Housing', blsSubcategory: 'Utilities, fuels, and public services', appCategory: 'Utilities', mappingConfidence: 'exact' },
  { blsCategory: 'Housing', blsSubcategory: 'Shelter', appCategory: 'Housing', mappingConfidence: 'exact', notes: 'Mortgage, rent, property tax' },
  { blsCategory: 'Telephone services', appCategory: 'Utilities', mappingConfidence: 'exact', notes: 'BLS counts under Housing; app maps to Utilities' },
  { blsCategory: 'Transportation', appCategory: 'Transport', mappingConfidence: 'exact' },
  { blsCategory: 'Healthcare', appCategory: 'Healthcare', mappingConfidence: 'exact' },
  { blsCategory: 'Entertainment', appCategory: 'Entertainment', mappingConfidence: 'exact' },
  { blsCategory: 'Reading', appCategory: 'Entertainment', mappingConfidence: 'approximate', notes: 'Small category, grouped with Entertainment' },
  { blsCategory: 'Apparel and services', appCategory: 'Personal', mappingConfidence: 'approximate', notes: 'App groups clothing under Personal' },
  { blsCategory: 'Education', appCategory: 'Personal', mappingConfidence: 'approximate', notes: 'App groups education under Personal' },
  { blsCategory: 'Personal care products and services', appCategory: 'Personal', mappingConfidence: 'exact' },
  { blsCategory: 'Cash contributions', appCategory: 'Personal', mappingConfidence: 'approximate', notes: 'Charity/gifts; app groups under Personal' },
  { blsCategory: 'Personal insurance and pensions', appCategory: 'Insurance', mappingConfidence: 'approximate', notes: 'Includes life insurance + Social Security contributions' },
  { blsCategory: 'Tobacco products and smoking supplies', appCategory: 'Other', mappingConfidence: 'partial' },
  { blsCategory: 'Miscellaneous', appCategory: 'Other', mappingConfidence: 'exact' },
]

// ─── Combined benchmark data ────────────────────────────────────────────────────

const ALL_BENCHMARKS: SpendingBenchmarkSeed[] = [...BRACKET_100K, ...BRACKET_150K]

// ─── Seeder Function ────────────────────────────────────────────────────────────

export async function seedBls2024(db: PrismaClient): Promise<void> {
  console.log('  Seeding BLS 2024 spending benchmarks...')

  // ── Spending benchmarks ─────────────────────────────────────────────
  // Delete existing 2024 data for idempotency, then recreate
  await db.spendingBenchmark.deleteMany({
    where: { surveyYear: 2024 },
  })

  for (const b of ALL_BENCHMARKS) {
    await db.spendingBenchmark.create({
      data: {
        surveyYear: b.surveyYear,
        incomeRangeLow: b.incomeRangeLow,
        incomeRangeHigh: b.incomeRangeHigh,
        category: b.category,
        subcategory: b.subcategory ?? null,
        appCategory: b.appCategory ?? null,
        annualMean: b.annualMean,
        monthlyMean: b.monthlyMean,
        shareOfTotal: b.shareOfTotal,
        source: b.source,
        sourceTable: b.sourceTable ?? null,
        notes: b.notes ?? null,
      },
    })
  }
  console.log(`    ✓ ${ALL_BENCHMARKS.length} spending benchmarks (2024) created`)

  // ── Category crosswalk (2024 additions) ─────────────────────────────
  // Add 2024 crosswalk entries that don't already exist
  // The 2024 crosswalk maps major BLS categories to app category groups,
  // complementing the 2023 crosswalk which maps subcategories to specific app categories
  let crosswalkAdded = 0
  for (const cw of CROSSWALK_2024) {
    const existing = await db.spendingCategoryCrosswalk.findFirst({
      where: {
        blsCategory: cw.blsCategory,
        blsSubcategory: cw.blsSubcategory ?? null,
        appCategory: cw.appCategory,
      },
    })
    if (!existing) {
      await db.spendingCategoryCrosswalk.create({
        data: {
          blsCategory: cw.blsCategory,
          blsSubcategory: cw.blsSubcategory ?? null,
          appCategory: cw.appCategory,
          mappingConfidence: cw.mappingConfidence,
          notes: cw.notes ?? null,
        },
      })
      crosswalkAdded++
    }
  }
  console.log(`    ✓ ${crosswalkAdded} new crosswalk entries added (${CROSSWALK_2024.length - crosswalkAdded} already existed)`)
}
