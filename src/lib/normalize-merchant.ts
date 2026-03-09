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
  /^wpy\*\s*/i,         // WePay: "WPY*MERCHANT"
  /^goo\*\s*/i,         // Google: "GOO*GOOGLE STORAGE"
  /^amzn\s*\*?\s*/i,    // Amazon variants: "AMZN* MARKETPLACE"
  /^apt\*\s*/i,         // Autopay: "APT*MERCHANT"
  /^dbt\s+(purchase\s+)?/i, // Debit purchase: "DBT PURCHASE MERCHANT"
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

/**
 * Canonical merchant name map — resolves brand variants to a single key.
 * Plaid and CSV sources often report the same merchant differently:
 *   Plaid: "Uber Eats"   CSV: "UBER* EATS ORDER"
 *   Plaid: "Starbucks"   CSV: "STARBUCKS STORE #12345"
 *
 * canonicalizeMerchant() normalizes first, then maps known variants
 * to a single canonical name for cross-source dedup matching.
 */
const CANONICAL_MAP: [RegExp, string][] = [
  // Coffee
  [/\bstarbucks\b/i, 'Starbucks'],
  [/\bdunkin['']?\s*(donuts)?\b/i, 'Dunkin'],
  [/\bpeet['']?s\s*coffee\b/i, "Peet's Coffee"],
  // Ride share
  [/\buber\s*eats\b/i, 'Uber Eats'],
  [/\buber\b(?!\s*eats)/i, 'Uber'],
  [/\blyft\b/i, 'Lyft'],
  // Food delivery
  [/\bdoordash\b/i, 'DoorDash'],
  [/\bgrubhub\b/i, 'Grubhub'],
  [/\bpostmates\b/i, 'Postmates'],
  [/\binstacart\b/i, 'Instacart'],
  // Fast food
  [/\bmcdonald['']?s?\b/i, "McDonald's"],
  [/\bchick[\s-]*fil[\s-]*a\b/i, 'Chick-fil-A'],
  [/\bchipotle\b/i, 'Chipotle'],
  [/\bsubway\b/i, 'Subway'],
  [/\bwendy['']?s?\b/i, "Wendy's"],
  [/\btaco\s*bell\b/i, 'Taco Bell'],
  [/\bpanera\b/i, 'Panera Bread'],
  // Grocery
  [/\bwhole\s*foods\b/i, 'Whole Foods'],
  [/\btrader\s*joe['']?s?\b/i, "Trader Joe's"],
  [/\bcostco\b/i, 'Costco'],
  [/\bwalmart\b/i, 'Walmart'],
  [/\btarget\b/i, 'Target'],
  [/\bkroger\b/i, 'Kroger'],
  [/\baldi\b/i, 'Aldi'],
  [/\bsafeway\b/i, 'Safeway'],
  [/\bpublix\b/i, 'Publix'],
  // Gas
  [/\bshell\s*(oil)?\b/i, 'Shell'],
  [/\bchevron\b/i, 'Chevron'],
  [/\bexxon\s*(mobil)?\b/i, 'Exxon'],
  [/\bbp\s+(gas|station)?\b/i, 'BP'],
  // Shopping
  [/\bamazon\s*(\.com|marketplace|prime)?\b/i, 'Amazon'],
  [/\bamzn\s*mktp\b/i, 'Amazon'],
  [/\bapple\.com\b/i, 'Apple'],
  [/\bapple\s*store\b/i, 'Apple Store'],
  [/\bbest\s*buy\b/i, 'Best Buy'],
  [/\bhome\s*depot\b/i, 'Home Depot'],
  [/\blowe['']?s\b/i, "Lowe's"],
  // Subscriptions
  [/\bnetflix\b/i, 'Netflix'],
  [/\bspotify\b/i, 'Spotify'],
  [/\bhulu\b/i, 'Hulu'],
  [/\bdisney\s*\+?\b/i, 'Disney+'],
  [/\bapple\s*(music|tv\+?|icloud|one)\b/i, 'Apple Services'],
  [/\byoutube\s*(premium|tv|music)?\b/i, 'YouTube'],
  [/\bgoogle\s*(storage|one|cloud)\b/i, 'Google One'],
  // Peer-to-peer
  [/\bvenmo\b/i, 'Venmo'],
  [/\bzelle\b/i, 'Zelle'],
  [/\bcashapp\b|cash\s*app\b/i, 'Cash App'],
  [/\bpaypal\b/i, 'PayPal'],
  // Utilities
  [/\bat\s*&?\s*t\b/i, 'AT&T'],
  [/\bverizon\b/i, 'Verizon'],
  [/\bt[\s-]*mobile\b/i, 'T-Mobile'],
  [/\bcomcast\b|\bxfinity\b/i, 'Xfinity'],
  // Pharmacy
  [/\bcvs\b/i, 'CVS'],
  [/\bwalgreens\b/i, 'Walgreens'],
  // Insurance
  [/\bgeico\b/i, 'GEICO'],
  [/\bstate\s*farm\b/i, 'State Farm'],
  [/\bprogressive\b/i, 'Progressive'],
  [/\ballstate\b/i, 'Allstate'],
  // Fitness
  [/\bplanet\s*fitness\b/i, 'Planet Fitness'],
  [/\bequinox\b/i, 'Equinox'],
  [/\borangetheory\b|\botf\b/i, 'Orangetheory'],
  [/\bpeloton\b/i, 'Peloton'],
  // Streaming / Digital
  [/\bamazon\s*prime\s*video\b/i, 'Prime Video'],
  [/\bmax\s*(\(hbo\))?\b/i, 'Max'],
  [/\bhbo\s*max\b/i, 'Max'],
  [/\bparamount\s*\+?\b/i, 'Paramount+'],
  [/\bpeacock\b/i, 'Peacock'],
  // Grocery (additional)
  [/\bh[\s-]*e[\s-]*b\b/i, 'H-E-B'],
  [/\bwegmans\b/i, 'Wegmans'],
  [/\bsprouts\b/i, 'Sprouts'],
  // Home improvement
  [/\bmenards\b/i, 'Menards'],
  [/\bikea\b/i, 'IKEA'],
  // Travel
  [/\bairbnb\b/i, 'Airbnb'],
  [/\bbooking\.com\b/i, 'Booking.com'],
  [/\bdelta\s*(air)?\s*(lines?)?\b/i, 'Delta Airlines'],
  [/\bunited\s*(air)?\s*(lines?)?\b/i, 'United Airlines'],
  [/\bsouthwest\s*(air)?\s*(lines?)?\b/i, 'Southwest Airlines'],
]

/**
 * Reduce a merchant name to its canonical form for cross-source dedup.
 * Returns a lowercase key suitable for comparison.
 */
export function canonicalizeMerchant(raw: string): string {
  const normalized = normalizeMerchant(raw)
  const lower = normalized.toLowerCase()
  for (const [pattern, canonical] of CANONICAL_MAP) {
    if (pattern.test(lower)) {
      return canonical.toLowerCase()
    }
  }
  return lower
}

/**
 * Full cleanup pipeline: normalize → canonicalize → return display-ready name.
 * Use this as the single entry point for merchant name display.
 */
export function cleanMerchantName(raw: string): string {
  const normalized = normalizeMerchant(raw)
  const lower = normalized.toLowerCase()
  for (const [pattern, canonical] of CANONICAL_MAP) {
    if (pattern.test(lower)) {
      return canonical
    }
  }
  return normalized
}
