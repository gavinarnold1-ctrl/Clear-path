/**
 * Normalize merchant names from Plaid for consistent matching.
 *
 * Plaid returns messy merchant names like "UBER *EATS PENDING",
 * "TST* STARBUCKS #1234", or "SQ *CORNER BAKERY". This normalizer
 * strips common prefixes, suffixes, location numbers, and noise
 * to produce cleaner names for display and merchant→category matching.
 */

/** Common POS/processor prefixes that add noise */
const STRIP_PREFIXES = [
  /^sq\s*\*\s*/i,       // Square: "SQ *Corner Bakery"
  /^tst\*\s*/i,         // Toast: "TST* Starbucks"
  /^pp\*\s*/i,          // PayPal: "PP*MERCHANT"
  /^sp\s*\*\s*/i,       // Shopify: "SP * STORE"
  /^in\s*\*\s*/i,       // Invoice: "IN *MERCHANT"
  /^ckg\*\s*/i,         // Clover: "CKG*MERCHANT"
  /^chk\*\s*/i,         // Check: "CHK*MERCHANT"
  /^pos\s+(debit\s+)?/i, // POS prefix: "POS DEBIT MERCHANT"
  /^ach\s+(debit|credit)\s+/i, // ACH prefix
]

/** Trailing noise patterns */
const STRIP_SUFFIXES = [
  /\s+#\d+$/,                    // Store numbers: "#1234"
  /\s+\d{3,}$/,                  // Trailing long numbers
  /\s+\d{2,4}[/-]\d{2,4}$/,     // Dates in suffix
  /\s+\*+$/,                     // Trailing asterisks
  /\s+pending$/i,                // "PENDING" suffix
  /\s+recurring$/i,              // "RECURRING" suffix
  /\s+online$/i,                 // "ONLINE" suffix
  /\s+payment$/i,                // "PAYMENT" suffix (standalone)
  /\s+purchase$/i,               // "PURCHASE" suffix
  /\s+pos$/i,                    // "POS" suffix
  /\s+\w{2}\s+\d{5}(-\d{4})?$/, // State + zip: "CA 94105"
  /\s+\d{5}(-\d{4})?$/,         // Trailing zip code
]

export function normalizeMerchant(raw: string): string {
  let name = raw.trim()

  // Strip POS/processor prefixes
  for (const re of STRIP_PREFIXES) {
    name = name.replace(re, '')
  }

  // Strip trailing noise
  for (const re of STRIP_SUFFIXES) {
    name = name.replace(re, '')
  }

  // Collapse multiple spaces/special chars
  name = name.replace(/\s+/g, ' ').trim()

  // Title case if all uppercase (common in Plaid raw data)
  if (name === name.toUpperCase() && name.length > 2) {
    name = name
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  return name || raw.trim()
}
