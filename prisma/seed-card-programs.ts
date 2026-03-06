/**
 * Seed script for credit card programs and benefits.
 * Run with: tsx prisma/seed-card-programs.ts
 * Idempotent — uses upsert on (issuer, name) unique constraint.
 */
import { PrismaClient } from '@prisma/client'
import cardPrograms from './seed-data/card-programs.json'

const db = new PrismaClient()

interface SeedBenefit {
  name: string
  type: string
  category?: string | null
  rewardRate?: number | null
  rewardUnit?: string | null
  maxReward?: number | null
  creditAmount?: number | null
  creditCycle?: string | null
  description: string
  terms?: string | null
}

interface SeedCardProgram {
  issuer: string
  name: string
  tier: string
  annualFee: number
  rewardsCurrency?: string | null
  signUpBonus?: string | null
  foreignTxFee: number
  plaidPatterns?: string[]
  benefits: SeedBenefit[]
}

export async function seedCardPrograms() {
  console.log('Seeding card programs...')

  for (const program of cardPrograms as SeedCardProgram[]) {
    const { benefits, plaidPatterns, ...programData } = program

    const upserted = await db.cardProgram.upsert({
      where: {
        issuer_name: { issuer: programData.issuer, name: programData.name },
      },
      create: {
        ...programData,
        tier: programData.tier as 'BASIC' | 'MID' | 'PREMIUM' | 'ULTRA_PREMIUM',
        plaidPatterns: plaidPatterns ?? [],
      },
      update: {
        ...programData,
        tier: programData.tier as 'BASIC' | 'MID' | 'PREMIUM' | 'ULTRA_PREMIUM',
        plaidPatterns: plaidPatterns ?? [],
      },
    })

    // Delete existing benefits and re-create (simpler than upserting each)
    await db.cardBenefit.deleteMany({ where: { cardProgramId: upserted.id } })

    for (const benefit of benefits) {
      await db.cardBenefit.create({
        data: {
          cardProgramId: upserted.id,
          name: benefit.name,
          type: benefit.type,
          category: benefit.category ?? null,
          rewardRate: benefit.rewardRate ?? null,
          rewardUnit: benefit.rewardUnit ?? null,
          maxReward: benefit.maxReward ?? null,
          creditAmount: benefit.creditAmount ?? null,
          creditCycle: benefit.creditCycle as 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CALENDAR_YEAR' | 'CARDMEMBER_YEAR' | undefined ?? undefined,
          description: benefit.description,
          terms: benefit.terms ?? null,
        },
      })
    }

    console.log(`  ✓ ${programData.issuer} ${programData.name} (${benefits.length} benefits)`)
  }

  console.log(`Seeded ${cardPrograms.length} card programs.`)
}

// Run directly
seedCardPrograms()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e)
    db.$disconnect()
    process.exit(1)
  })
