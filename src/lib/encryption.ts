/**
 * AES-256-GCM authenticated encryption for sensitive data at rest.
 * Used to encrypt Plaid access tokens before storing in the database.
 *
 * Encrypted format: iv:authTag:ciphertext (all base64-encoded, colon-delimited)
 * Encryption key: 32-byte hex string from PLAID_ENCRYPTION_KEY env var.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128-bit auth tag

// Validate encryption key at module load time — fail fast rather than silently
if (!process.env.PLAID_ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  throw new Error(
    'FATAL: PLAID_ENCRYPTION_KEY environment variable is not set. ' +
    'Plaid access tokens cannot be encrypted/decrypted. Set this in your deployment environment.'
  )
}
if (!process.env.PLAID_ENCRYPTION_KEY) {
  console.warn('[oversikt] PLAID_ENCRYPTION_KEY not set — Plaid operations will fail')
}

function getEncryptionKey(): Buffer {
  const keyHex = process.env.PLAID_ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error(
      'PLAID_ENCRYPTION_KEY environment variable is required. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  if (keyHex.length !== 64) {
    throw new Error(
      'PLAID_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(keyHex, 'hex')
}

/**
 * Validate the encryption key at startup. Throws with a clear message if
 * PLAID_ENCRYPTION_KEY is missing or malformed.
 */
export function validateEncryptionKeyOrThrow(): void {
  try {
    getEncryptionKey()
  } catch (err) {
    throw new Error(
      `[oversikt] Encryption key validation failed at startup: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all base64-encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypt an encrypted string (iv:authTag:ciphertext format) using AES-256-GCM.
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey()
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected iv:authTag:ciphertext')
  }

  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const ciphertext = parts[2]

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
