import Anthropic from '@anthropic-ai/sdk'
import { OVERSIKT_VOICE } from './ai-voice'

interface UncategorizedTx {
  id: string
  merchant: string
  amount: number
  date: string
  originalStatement: string | null
  accountName: string
}

interface CategorySuggestion {
  transactionId: string
  categoryName: string
  confidence: number
}

export async function aiCategorizeBatch(
  transactions: UncategorizedTx[],
  existingCategories: { id: string; name: string; group: string; type: string }[],
): Promise<CategorySuggestion[]> {
  if (transactions.length === 0) return []

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return []

  const client = new Anthropic()

  const categoryList = existingCategories
    .map(c => `${c.name} (${c.group}, ${c.type})`)
    .join('\n')

  const txList = transactions
    .map(
      t =>
        `ID: ${t.id} | ${t.date} | ${t.merchant} | $${Math.abs(t.amount).toFixed(2)} ${t.amount > 0 ? 'IN' : 'OUT'} | ${t.accountName} | Raw: ${t.originalStatement || 'N/A'}`,
    )
    .join('\n')

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2000,
      system: `${OVERSIKT_VOICE}\n\nYou are categorizing bank transactions. The user's existing categories are:\n${categoryList}\n\nRules:\n- Positive amounts (IN) = money received. Most are income. Paychecks, direct deposits, mobile deposits = "Paychecks" or "Other Income".\n- Negative amounts (OUT) = money spent.\n- Credit card payments (to Amex, Capital One, Chase, etc.) = "Credit Card Payment" (transfer, NOT expense).\n- Match to existing categories whenever possible.\n- If none fit, suggest the closest existing category.\n- Return JSON array only.`,
      messages: [
        {
          role: 'user',
          content: `Categorize these transactions. Return JSON array of objects with: transactionId, categoryName (must be from the list above), confidence (0.0-1.0).\n\n${txList}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    return JSON.parse(jsonMatch[0]) as CategorySuggestion[]
  } catch (err) {
    console.error('AI categorization failed:', err)
    return []
  }
}
