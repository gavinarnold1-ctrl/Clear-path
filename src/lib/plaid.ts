import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'

// Warn early if Plaid credentials are missing
if (process.env.NODE_ENV === 'production' && (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET)) {
  console.error('[oversikt] PLAID_CLIENT_ID or PLAID_SECRET not set — Plaid integration will fail')
}

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
 * Detect credit card payments by merchant/statement name patterns.
 * These should be classified as transfers, not expenses.
 */
export function detectCreditCardPayment(merchantOrStatement: string): boolean {
  const CC_PATTERNS = [
    /american express.*pmt/i,
    /capital one.*pmt/i,
    /chase.*payment/i,
    /citi.*payment/i,
    /discover.*payment/i,
    /barclays.*payment/i,
    /wells fargo.*card.*pmt/i,
    /credit card.*payment/i,
    /card payment/i,
  ]
  return CC_PATTERNS.some(p => p.test(merchantOrStatement))
}

/**
 * Map Plaid's personal_finance_category to our category groups.
 * Uses primary, detailed, and amount context for accurate classification.
 */
export function mapPlaidCategory(
  primary: string,
  detailed?: string | null,
  amount?: number,
  merchantName?: string | null,
): { group: string; name: string; type: string } {
  const merchantLower = (merchantName ?? '').toLowerCase()

  // Credit card payments — internal transfer, NOT an expense
  if (primary === 'LOAN_PAYMENTS' && detailed?.includes('CREDIT_CARD')) {
    return { group: 'Transfers', name: 'Credit Card Payment', type: 'transfer' }
  }

  // Mortgage payments — real expense
  if (primary === 'LOAN_PAYMENTS' && detailed?.includes('MORTGAGE')) {
    return { group: 'Housing', name: 'Mortgage', type: 'expense' }
  }

  // Dividend and interest income detection
  if (primary === 'INCOME' && detailed === 'INCOME_DIVIDENDS') {
    return { group: 'Income', name: 'Dividends & Capital Gains', type: 'income' }
  }
  if (primary === 'INCOME' && detailed === 'INCOME_INTEREST_EARNED') {
    return { group: 'Income', name: 'Interest', type: 'income' }
  }

  // Trust distributions — classified as income, not generic transfer
  if (primary === 'INCOME' && detailed === 'INCOME_OTHER_INCOME') {
    if (/\b(trust|distrib|estate|beneficiar)/i.test(merchantLower)) {
      return { group: 'Income', name: 'Trust Distribution', type: 'income' }
    }
  }

  // Investment transfers
  if (primary === 'TRANSFER_IN' && detailed === 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS') {
    return { group: 'Transfers', name: 'Investment Transfer', type: 'transfer' }
  }

  // Peer-to-peer transfers: Venmo, Zelle, Cash App
  // These are often person-to-person — classify as transfer, not income/expense
  const isPeerTransfer = /\b(venmo|zelle|cash\s*app|cashapp)\b/i.test(merchantLower)
  if (isPeerTransfer && (primary === 'TRANSFER_IN' || primary === 'TRANSFER_OUT')) {
    return { group: 'Transfers', name: 'Peer Transfer', type: 'transfer' }
  }

  // Mobile deposits >$200 — likely income (paycheck, check deposit)
  if (primary === 'TRANSFER_IN' && detailed === 'TRANSFER_IN_DEPOSIT') {
    if (amount && amount > 200) {
      return { group: 'Income', name: 'Paychecks', type: 'income' }
    }
    if (/\b(mobile\s*deposit|remote\s*deposit|check\s*deposit)\b/i.test(merchantLower)) {
      return { group: 'Income', name: 'Other Income', type: 'income' }
    }
  }

  // Income detection from transfers
  if (primary === 'TRANSFER_IN') {
    if (detailed === 'TRANSFER_IN_PAYROLL') {
      return { group: 'Income', name: 'Paychecks', type: 'income' }
    }
    // Large positive transfers that aren't account-to-account
    if (detailed !== 'TRANSFER_IN_ACCOUNT_TRANSFER' && amount && amount > 0 && amount >= 200) {
      return { group: 'Income', name: 'Other Income', type: 'income' }
    }
  }

  // Positive amounts with no PFC = likely income
  if (!primary && amount && amount > 0) {
    return { group: 'Income', name: 'Other Income', type: 'income' }
  }

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
    'GROCERIES': { group: 'Food', name: 'Groceries', type: 'expense' },
    'AUTO_TRANSPORT': { group: 'Transport', name: 'Auto & Transport', type: 'expense' },
    'EDUCATION': { group: 'Personal', name: 'Education', type: 'expense' },
    'CHILDCARE': { group: 'Personal', name: 'Childcare', type: 'expense' },
    'PETS': { group: 'Entertainment', name: 'Pets', type: 'expense' },
    'SUBSCRIPTION': { group: 'Entertainment', name: 'Subscriptions', type: 'expense' },
    'TOBACCO_AND_ALCOHOL': { group: 'Food', name: 'Alcohol & Bars', type: 'expense' },
    'GAS_STATIONS': { group: 'Transport', name: 'Gas & Fuel', type: 'expense' },
    'GYMS_AND_FITNESS_CENTERS': { group: 'Healthcare', name: 'Gym & Fitness', type: 'expense' },
    'AIRLINES_AND_AVIATION_SERVICES': { group: 'Entertainment', name: 'Travel', type: 'expense' },
    'LODGING': { group: 'Entertainment', name: 'Travel', type: 'expense' },
    'CAR_SERVICE': { group: 'Transport', name: 'Ride Share', type: 'expense' },
  }
  return mapping[primary] ?? { group: 'Other', name: 'Uncategorized', type: 'expense' }
}
