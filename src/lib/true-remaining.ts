/**
 * Single source of truth for True Remaining computation.
 * True Remaining = Income - Fixed Obligations - Flexible Spent - Unbudgeted Spent - Annual Set-Asides
 */

export interface TrueRemainingInputs {
  income: number
  fixedTotal: number
  flexibleSpent: number
  unbudgetedSpent: number
  annualSetAside: number
}

export function computeTrueRemaining(inputs: TrueRemainingInputs): number {
  return inputs.income - inputs.fixedTotal - inputs.flexibleSpent - inputs.unbudgetedSpent - inputs.annualSetAside
}
