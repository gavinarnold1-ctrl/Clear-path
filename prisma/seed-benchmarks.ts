/**
 * Seed script — populates consumer spending benchmark reference tables.
 * Data sourced from BLS Consumer Expenditure Survey (2023, latest available).
 * Run via the main seed script or independently with: npx tsx prisma/seed-benchmarks.ts
 */
import type { PrismaClient } from '@prisma/client'

// ─── BLS Category → App Category Crosswalk ──────────────────────────────────

type CrosswalkSeed = {
  blsCategory: string
  blsSubcategory?: string
  appCategory: string
  mappingConfidence: string
  notes?: string
}

const CATEGORY_CROSSWALK: CrosswalkSeed[] = [
  // Food
  {
    blsCategory: 'Food at home',
    appCategory: 'Groceries',
    mappingConfidence: 'exact',
  },
  {
    blsCategory: 'Food away from home',
    appCategory: 'Restaurants',
    mappingConfidence: 'approximate',
    notes: 'BLS includes all dining out; app separates coffee shops',
  },
  {
    blsCategory: 'Alcoholic beverages',
    appCategory: 'Drinks',
    mappingConfidence: 'exact',
  },

  // Housing
  {
    blsCategory: 'Shelter',
    blsSubcategory: 'Mortgage interest and charges',
    appCategory: 'Mortgage',
    mappingConfidence: 'exact',
  },
  {
    blsCategory: 'Utilities, fuels, and public services',
    blsSubcategory: 'Electricity',
    appCategory: 'Electric',
    mappingConfidence: 'exact',
  },
  {
    blsCategory: 'Utilities, fuels, and public services',
    blsSubcategory: 'Telephone services',
    appCategory: 'Cell Phone',
    mappingConfidence: 'approximate',
    notes: 'BLS includes landline; app category is mobile-focused',
  },
  {
    blsCategory: 'Household operations',
    appCategory: 'Home Improvement',
    mappingConfidence: 'partial',
    notes:
      'BLS household operations includes domestic services, not just improvements',
  },
  {
    blsCategory: 'Housekeeping supplies',
    appCategory: 'Home Improvement',
    mappingConfidence: 'partial',
  },

  // Transportation
  {
    blsCategory: 'Gasoline, other fuels, and motor oil',
    appCategory: 'Gas',
    mappingConfidence: 'exact',
  },
  {
    blsCategory: 'Vehicle insurance',
    appCategory: 'Car Insurance',
    mappingConfidence: 'exact',
  },

  // Healthcare
  {
    blsCategory: 'Health insurance',
    appCategory: 'Medical',
    mappingConfidence: 'approximate',
    notes: 'BLS separates insurance from services; app combines them',
  },
  {
    blsCategory: 'Medical services',
    appCategory: 'Medical',
    mappingConfidence: 'exact',
  },
  {
    blsCategory: 'Drugs',
    appCategory: 'Medical',
    mappingConfidence: 'exact',
  },

  // Entertainment
  {
    blsCategory: 'Entertainment',
    blsSubcategory: 'Fees and admissions',
    appCategory: 'Entertainment',
    mappingConfidence: 'exact',
  },
  {
    blsCategory: 'Entertainment',
    blsSubcategory: 'Audio and visual equipment',
    appCategory: 'Subscriptions',
    mappingConfidence: 'approximate',
    notes: 'BLS includes hardware purchases; app category is recurring subscriptions',
  },

  // Apparel & Personal care
  {
    blsCategory: 'Apparel and services',
    appCategory: 'Personal Care',
    mappingConfidence: 'approximate',
    notes: 'BLS apparel is clothing-specific; app Personal Care is broader',
  },
  {
    blsCategory: 'Personal care products and services',
    appCategory: 'Personal Care',
    mappingConfidence: 'exact',
  },

  // Travel
  {
    blsCategory: 'Transportation',
    blsSubcategory: 'Public and other transportation',
    appCategory: 'Travel',
    mappingConfidence: 'partial',
    notes: 'Includes commuting transit, not just travel',
  },
  {
    blsCategory: 'Shelter',
    blsSubcategory: 'Lodging away from home',
    appCategory: 'Travel',
    mappingConfidence: 'exact',
  },

  // Pets
  {
    blsCategory: 'Pets, toys, hobbies, and playground equipment',
    blsSubcategory: 'Pets',
    appCategory: 'Pets',
    mappingConfidence: 'exact',
  },
]

// ─── Spending Benchmarks ────────────────────────────────────────────────────

type BenchmarkSeed = {
  surveyYear: number
  incomeRangeLow?: number
  incomeRangeHigh?: number
  region: string
  householdSize?: number
  housingTenure: string
  category: string
  appCategory: string
  annualMean: number
  monthlyMean: number
  shareOfTotal?: number
  sourceTable: string
}

const SPENDING_BENCHMARKS: BenchmarkSeed[] = [
  // ── All Consumer Units — National Average (Table 1101) ────────────────
  // Fallback when specific segment data isn't available
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Food at home',
    appCategory: 'Groceries',
    annualMean: 5703,
    monthlyMean: 475.25,
    shareOfTotal: 0.0812,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Food away from home',
    appCategory: 'Restaurants',
    annualMean: 4349,
    monthlyMean: 362.42,
    shareOfTotal: 0.062,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Alcoholic beverages',
    appCategory: 'Drinks',
    annualMean: 628,
    monthlyMean: 52.33,
    shareOfTotal: 0.0089,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Shelter',
    appCategory: 'Mortgage',
    annualMean: 14001,
    monthlyMean: 1166.75,
    shareOfTotal: 0.1994,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Utilities',
    appCategory: 'Electric',
    annualMean: 4885,
    monthlyMean: 407.08,
    shareOfTotal: 0.0696,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Gasoline and motor oil',
    appCategory: 'Gas',
    annualMean: 2478,
    monthlyMean: 206.5,
    shareOfTotal: 0.0353,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Vehicle insurance',
    appCategory: 'Car Insurance',
    annualMean: 1894,
    monthlyMean: 157.83,
    shareOfTotal: 0.027,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Health insurance',
    appCategory: 'Medical',
    annualMean: 4002,
    monthlyMean: 333.5,
    shareOfTotal: 0.057,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Entertainment',
    appCategory: 'Entertainment',
    annualMean: 3458,
    monthlyMean: 288.17,
    shareOfTotal: 0.0493,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Apparel and services',
    appCategory: 'Personal Care',
    annualMean: 1977,
    monthlyMean: 164.75,
    shareOfTotal: 0.0282,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    region: 'all',
    housingTenure: 'all',
    category: 'Personal care',
    appCategory: 'Personal Care',
    annualMean: 866,
    monthlyMean: 72.17,
    shareOfTotal: 0.0123,
    sourceTable: 'Table 1101',
  },

  // ── $100,000–$149,999 Income Range (Table 1101) ───────────────────────
  // Primary segment for the target user
  {
    surveyYear: 2023,
    incomeRangeLow: 100000,
    incomeRangeHigh: 149999,
    region: 'all',
    housingTenure: 'all',
    category: 'Food at home',
    appCategory: 'Groceries',
    annualMean: 7137,
    monthlyMean: 594.75,
    shareOfTotal: 0.0742,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    incomeRangeLow: 100000,
    incomeRangeHigh: 149999,
    region: 'all',
    housingTenure: 'all',
    category: 'Food away from home',
    appCategory: 'Restaurants',
    annualMean: 5890,
    monthlyMean: 490.83,
    shareOfTotal: 0.0613,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    incomeRangeLow: 100000,
    incomeRangeHigh: 149999,
    region: 'all',
    housingTenure: 'all',
    category: 'Alcoholic beverages',
    appCategory: 'Drinks',
    annualMean: 820,
    monthlyMean: 68.33,
    shareOfTotal: 0.0085,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    incomeRangeLow: 100000,
    incomeRangeHigh: 149999,
    region: 'all',
    housingTenure: 'all',
    category: 'Shelter',
    appCategory: 'Mortgage',
    annualMean: 17523,
    monthlyMean: 1460.25,
    shareOfTotal: 0.1822,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    incomeRangeLow: 100000,
    incomeRangeHigh: 149999,
    region: 'all',
    housingTenure: 'all',
    category: 'Utilities',
    appCategory: 'Electric',
    annualMean: 5647,
    monthlyMean: 470.58,
    shareOfTotal: 0.0587,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    incomeRangeLow: 100000,
    incomeRangeHigh: 149999,
    region: 'all',
    housingTenure: 'all',
    category: 'Gasoline and motor oil',
    appCategory: 'Gas',
    annualMean: 3279,
    monthlyMean: 273.25,
    shareOfTotal: 0.0341,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    incomeRangeLow: 100000,
    incomeRangeHigh: 149999,
    region: 'all',
    housingTenure: 'all',
    category: 'Vehicle insurance',
    appCategory: 'Car Insurance',
    annualMean: 2445,
    monthlyMean: 203.75,
    shareOfTotal: 0.0254,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    incomeRangeLow: 100000,
    incomeRangeHigh: 149999,
    region: 'all',
    housingTenure: 'all',
    category: 'Health insurance',
    appCategory: 'Medical',
    annualMean: 5021,
    monthlyMean: 418.42,
    shareOfTotal: 0.0522,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    incomeRangeLow: 100000,
    incomeRangeHigh: 149999,
    region: 'all',
    housingTenure: 'all',
    category: 'Entertainment',
    appCategory: 'Entertainment',
    annualMean: 4547,
    monthlyMean: 378.92,
    shareOfTotal: 0.0473,
    sourceTable: 'Table 1101',
  },
  {
    surveyYear: 2023,
    incomeRangeLow: 100000,
    incomeRangeHigh: 149999,
    region: 'all',
    housingTenure: 'all',
    category: 'Apparel and services',
    appCategory: 'Personal Care',
    annualMean: 2667,
    monthlyMean: 222.25,
    shareOfTotal: 0.0277,
    sourceTable: 'Table 1101',
  },

  // ── Northeast Region (Table 3001) ─────────────────────────────────────
  // Regional adjustment for cost-of-living differences
  {
    surveyYear: 2023,
    region: 'northeast',
    housingTenure: 'all',
    category: 'Food at home',
    appCategory: 'Groceries',
    annualMean: 6240,
    monthlyMean: 520.0,
    shareOfTotal: 0.0798,
    sourceTable: 'Table 3001',
  },
  {
    surveyYear: 2023,
    region: 'northeast',
    housingTenure: 'all',
    category: 'Food away from home',
    appCategory: 'Restaurants',
    annualMean: 4872,
    monthlyMean: 406.0,
    shareOfTotal: 0.0624,
    sourceTable: 'Table 3001',
  },
  {
    surveyYear: 2023,
    region: 'northeast',
    housingTenure: 'all',
    category: 'Shelter',
    appCategory: 'Mortgage',
    annualMean: 17234,
    monthlyMean: 1436.17,
    shareOfTotal: 0.2208,
    sourceTable: 'Table 3001',
  },
  {
    surveyYear: 2023,
    region: 'northeast',
    housingTenure: 'all',
    category: 'Utilities',
    appCategory: 'Electric',
    annualMean: 5328,
    monthlyMean: 444.0,
    shareOfTotal: 0.0683,
    sourceTable: 'Table 3001',
  },
  {
    surveyYear: 2023,
    region: 'northeast',
    housingTenure: 'all',
    category: 'Gasoline and motor oil',
    appCategory: 'Gas',
    annualMean: 2196,
    monthlyMean: 183.0,
    shareOfTotal: 0.0282,
    sourceTable: 'Table 3001',
  },
]

// ─── Income Benchmarks ──────────────────────────────────────────────────────

type IncomeBenchmarkSeed = {
  surveyYear: number
  metric: string
  region?: string
  householdType?: string
  value: number
  source: string
}

const INCOME_BENCHMARKS: IncomeBenchmarkSeed[] = [
  {
    surveyYear: 2023,
    metric: 'median_household_income',
    region: 'all',
    householdType: 'all',
    value: 80610,
    source: 'U.S. Census Bureau, ACS 2023',
  },
  {
    surveyYear: 2023,
    metric: 'mean_household_income',
    region: 'all',
    householdType: 'all',
    value: 114700,
    source: 'BLS Consumer Expenditure Survey 2023',
  },
  {
    surveyYear: 2023,
    metric: 'median_household_income',
    region: 'northeast',
    householdType: 'all',
    value: 88190,
    source: 'U.S. Census Bureau, ACS 2023',
  },
  {
    surveyYear: 2023,
    metric: 'median_household_income',
    region: 'CT',
    householdType: 'all',
    value: 87455,
    source: 'U.S. Census Bureau, ACS 2023',
  },
  {
    surveyYear: 2023,
    metric: 'median_household_income',
    region: 'all',
    householdType: 'married_couple',
    value: 117432,
    source: 'U.S. Census Bureau, ACS 2023',
  },
]

// ─── Seeder Function ────────────────────────────────────────────────────────

export async function seedBenchmarks(db: PrismaClient): Promise<void> {
  console.log('  Seeding spending benchmarks...')

  // Seed category crosswalk
  // Delete and re-create for idempotency
  await db.spendingCategoryCrosswalk.deleteMany({})

  for (const cw of CATEGORY_CROSSWALK) {
    await db.spendingCategoryCrosswalk.create({
      data: {
        blsCategory: cw.blsCategory,
        blsSubcategory: cw.blsSubcategory ?? null,
        appCategory: cw.appCategory,
        mappingConfidence: cw.mappingConfidence,
        notes: cw.notes ?? null,
      },
    })
  }
  console.log(`    ✓ ${CATEGORY_CROSSWALK.length} category crosswalk entries created`)

  // Seed spending benchmarks
  // Delete 2023 data and re-create
  await db.spendingBenchmark.deleteMany({
    where: { surveyYear: 2023 },
  })

  for (const b of SPENDING_BENCHMARKS) {
    await db.spendingBenchmark.create({
      data: {
        surveyYear: b.surveyYear,
        incomeRangeLow: b.incomeRangeLow ?? null,
        incomeRangeHigh: b.incomeRangeHigh ?? null,
        region: b.region,
        householdSize: b.householdSize ?? null,
        housingTenure: b.housingTenure,
        category: b.category,
        appCategory: b.appCategory,
        annualMean: b.annualMean,
        monthlyMean: b.monthlyMean,
        shareOfTotal: b.shareOfTotal ?? null,
        sourceTable: b.sourceTable,
      },
    })
  }
  console.log(`    ✓ ${SPENDING_BENCHMARKS.length} spending benchmarks created`)

  // Seed income benchmarks
  await db.incomeBenchmark.deleteMany({
    where: { surveyYear: 2023 },
  })

  for (const ib of INCOME_BENCHMARKS) {
    await db.incomeBenchmark.create({
      data: {
        surveyYear: ib.surveyYear,
        metric: ib.metric,
        region: ib.region ?? null,
        householdType: ib.householdType ?? null,
        value: ib.value,
        source: ib.source,
      },
    })
  }
  console.log(`    ✓ ${INCOME_BENCHMARKS.length} income benchmarks created`)
}
