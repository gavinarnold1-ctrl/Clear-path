/**
 * Default category group mapping table (R1.6).
 *
 * When a CSV import creates a new category that doesn't match any existing one,
 * this table assigns it to the best-fit group based on keyword matching.
 * Never assigns to "Imported" — always picks a real group.
 */

const GROUP_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': [
    'groceries', 'grocery', 'restaurant', 'dining', 'food', 'coffee',
    'fast food', 'bars', 'bakery', 'deli', 'takeout', 'delivery',
    'pizza', 'sushi', 'cafe', 'lunch', 'dinner', 'snack', 'meal',
  ],
  'Housing': [
    'mortgage', 'rent', 'hoa', 'property tax', 'home', 'housing',
    'maintenance', 'repair', 'plumber', 'electrician', 'lawn',
    'garden', 'cleaning', 'furniture', 'appliance', 'renovation',
  ],
  'Auto & Transport': [
    'gas', 'fuel', 'car', 'auto', 'vehicle', 'parking', 'toll',
    'uber', 'lyft', 'taxi', 'transit', 'bus', 'train', 'subway',
    'metro', 'oil change', 'mechanic', 'tire', 'car wash',
    'registration', 'dmv',
  ],
  'Utilities': [
    'electric', 'electricity', 'water', 'sewer', 'gas bill',
    'internet', 'cable', 'phone', 'cell', 'mobile', 'utility',
    'utilities', 'trash', 'garbage', 'waste', 'heating', 'cooling',
  ],
  'Health & Wellness': [
    'health', 'medical', 'doctor', 'dentist', 'pharmacy', 'prescription',
    'hospital', 'therapy', 'counseling', 'gym', 'fitness', 'wellness',
    'vitamin', 'supplement', 'vision', 'optometrist', 'dermatolog',
  ],
  'Shopping': [
    'shopping', 'clothing', 'clothes', 'shoes', 'electronics', 'amazon',
    'target', 'walmart', 'costco', 'retail', 'department store', 'mall',
    'online shopping', 'apparel', 'accessories',
  ],
  'Entertainment': [
    'entertainment', 'movie', 'theater', 'concert', 'streaming',
    'netflix', 'hulu', 'spotify', 'music', 'game', 'gaming',
    'hobby', 'recreation', 'park', 'museum', 'event', 'ticket',
  ],
  'Personal Care': [
    'personal care', 'haircut', 'salon', 'spa', 'beauty', 'cosmetic',
    'grooming', 'barber', 'skincare', 'nail',
  ],
  'Education': [
    'education', 'tuition', 'school', 'college', 'university', 'course',
    'book', 'textbook', 'training', 'class', 'student', 'loan',
  ],
  'Financial': [
    'insurance', 'life insurance', 'bank', 'fee', 'interest', 'finance',
    'investment', 'saving', 'retirement', '401k', 'ira', 'brokerage',
    'financial advisor', 'tax', 'accounting', 'atm',
  ],
  'Gifts & Donations': [
    'gift', 'donation', 'charity', 'church', 'tithe', 'nonprofit',
    'present', 'contribution', 'fundraiser',
  ],
  'Travel': [
    'travel', 'hotel', 'flight', 'airline', 'airbnb', 'vacation',
    'luggage', 'rental car', 'resort', 'cruise', 'booking',
  ],
  'Kids & Family': [
    'child', 'kid', 'baby', 'daycare', 'childcare', 'school supply',
    'diaper', 'toy', 'pediatr', 'family',
  ],
  'Pets': [
    'pet', 'vet', 'veterinar', 'dog', 'cat', 'grooming',
    'pet food', 'animal',
  ],
  'Subscriptions': [
    'subscription', 'membership', 'monthly', 'recurring', 'annual plan',
  ],
  'Income': [
    'income', 'salary', 'wage', 'paycheck', 'deposit', 'dividend',
    'interest earned', 'bonus', 'refund', 'reimbursement', 'cashback',
    'rental income', 'freelance', 'side hustle',
  ],
  'Transfer': [
    'transfer', 'credit card payment', 'payment transfer',
    'internal transfer', 'account transfer', 'zelle', 'venmo', 'paypal',
  ],
}

/**
 * Infer the best-fit category group for a given category name.
 * Returns a real group name — never "Imported".
 */
export function inferCategoryGroup(categoryName: string, categoryType: string): string {
  const nameLower = categoryName.toLowerCase()

  // Check each group's keywords for a match
  let bestGroup: string | null = null
  let bestScore = 0

  for (const [group, keywords] of Object.entries(GROUP_KEYWORDS)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword) || keyword.includes(nameLower)) {
        const score = Math.min(keyword.length, nameLower.length) / Math.max(keyword.length, nameLower.length)
        if (score > bestScore) {
          bestScore = score
          bestGroup = group
        }
      }
    }
  }

  if (bestGroup && bestScore >= 0.3) {
    return bestGroup
  }

  // Fallback based on category type
  if (categoryType === 'income') return 'Income'
  if (categoryType === 'transfer') return 'Transfer'

  return 'Other'
}
