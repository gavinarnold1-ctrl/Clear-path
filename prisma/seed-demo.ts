/**
 * Standalone demo seed script.
 * Run with: npx tsx prisma/seed-demo.ts
 *
 * Uses tsx which resolves tsconfig path aliases, allowing us to
 * import the shared seedDemoData function from src/lib/seed-demo.ts.
 */
import { PrismaClient } from '@prisma/client'
import { seedDemoData } from '../src/lib/seed-demo'

const db = new PrismaClient()

seedDemoData(db)
  .then(() => console.log('Demo seed complete. User: demo@oversikt.app'))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
