import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
})

export const plaidClient = new PlaidApi(config)
export const PLAID_PRODUCTS = [Products.Transactions] as Products[]
export const PLAID_COUNTRY_CODES = [CountryCode.Us]

/**
 * Map Plaid account type/subtype to our AccountType enum.
 */
export function mapPlaidAccountType(
  type: string,
  subtype: string | null,
): 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH' | 'MORTGAGE' | 'AUTO_LOAN' | 'STUDENT_LOAN' {
  switch (type) {
    case 'depository':
      if (subtype === 'savings' || subtype === 'money market' || subtype === 'cd') return 'SAVINGS'
      return 'CHECKING'
    case 'credit':
      return 'CREDIT_CARD'
    case 'investment':
      return 'INVESTMENT'
    case 'loan':
      if (subtype === 'mortgage') return 'MORTGAGE'
      if (subtype === 'auto') return 'AUTO_LOAN'
      if (subtype === 'student') return 'STUDENT_LOAN'
      return 'STUDENT_LOAN' // default loan type
    default:
      return 'CHECKING'
  }
}

/**
 * Map Plaid's personal_finance_category.primary to our category groups.
 * Returns { group, name, type } for category matching/creation.
 */
export function mapPlaidCategory(primary: string): { group: string; name: string; type: string } {
  const mapping: Record<string, { group: string; name: string; type: string }> = {
    'INCOME': { group: 'Income', name: 'Other Income', type: 'income' },
    'TRANSFER_IN': { group: 'Transfers', name: 'Transfer', type: 'transfer' },
    'TRANSFER_OUT': { group: 'Transfers', name: 'Transfer', type: 'transfer' },
    'LOAN_PAYMENTS': { group: 'Financial', name: 'Loan Payment', type: 'expense' },
    'BANK_FEES': { group: 'Financial', name: 'Bank Fees', type: 'expense' },
    'ENTERTAINMENT': { group: 'Entertainment', name: 'Entertainment', type: 'expense' },
    'FOOD_AND_DRINK': { group: 'Food', name: 'Restaurants & Bars', type: 'expense' },
    'GENERAL_MERCHANDISE': { group: 'Personal', name: 'Shopping', type: 'expense' },
    'HOME_IMPROVEMENT': { group: 'Housing', name: 'Home Improvement', type: 'expense' },
    'MEDICAL': { group: 'Healthcare', name: 'Medical', type: 'expense' },
    'PERSONAL_CARE': { group: 'Personal', name: 'Personal Care', type: 'expense' },
    'GENERAL_SERVICES': { group: 'Other', name: 'Services', type: 'expense' },
    'GOVERNMENT_AND_NON_PROFIT': { group: 'Other', name: 'Government', type: 'expense' },
    'TRANSPORTATION': { group: 'Transport', name: 'Transportation', type: 'expense' },
    'TRAVEL': { group: 'Entertainment', name: 'Travel', type: 'expense' },
    'RENT_AND_UTILITIES': { group: 'Housing', name: 'Rent & Utilities', type: 'expense' },
  }
  return mapping[primary] ?? { group: 'Other', name: 'Uncategorized', type: 'expense' }
}
