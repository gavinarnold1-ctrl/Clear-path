/**
 * Migration script: Encrypt existing Plaid access tokens.
 *
 * Reads all Account rows with a plaintext plaidAccessToken (not yet encrypted),
 * encrypts each one using AES-256-GCM, and writes back the encrypted value.
 *
 * Idempotent: already-encrypted tokens (containing colons) are skipped.
 *
 * Usage:
 *   npx tsx scripts/migrate-encrypt-tokens.ts
 *
 * Requires PLAID_ENCRYPTION_KEY and DATABASE_URL environment variables.
 */
import { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from '../src/lib/encryption'

async function main() {
  const db = new PrismaClient()

  try {
    const accounts = await db.account.findMany({
      where: { plaidAccessToken: { not: null } },
      select: { id: true, plaidAccessToken: true },
    })

    console.log(`Found ${accounts.length} accounts with Plaid access tokens`)

    let migrated = 0
    let skipped = 0

    for (const account of accounts) {
      const token = account.plaidAccessToken!

      // Skip already-encrypted tokens (they contain colons from iv:authTag:ciphertext format)
      if (token.includes(':')) {
        // Verify it's actually decryptable
        try {
          decrypt(token)
          skipped++
          continue
        } catch {
          console.warn(`Account ${account.id}: token contains colons but failed to decrypt, encrypting...`)
        }
      }

      const encrypted = encrypt(token)
      await db.account.update({
        where: { id: account.id },
        data: { plaidAccessToken: encrypted },
      })
      migrated++
    }

    console.log(`Migration complete: ${migrated} encrypted, ${skipped} already encrypted`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
