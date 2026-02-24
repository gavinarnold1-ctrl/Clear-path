import { db } from './db'

/**
 * Reconcile imported transactions whose category doesn't match any budget-linked
 * category. Uses the stored originalCategory field to find partial name matches
 * against budget categories, then re-links the transactions.
 *
 * Should be called after CSV import.
 */
export async function reconcileBudgetCategories(userId: string): Promise<number> {
  const budgets = await db.budget.findMany({
    where: { userId, categoryId: { not: null } },
    include: { category: true },
  })

  if (budgets.length === 0) return 0

  const budgetCatNameToId = new Map<string, string>()
  const budgetCatIds = new Set<string>()
  for (const b of budgets) {
    if (b.category) {
      budgetCatNameToId.set(b.category.name.toLowerCase(), b.categoryId!)
      budgetCatIds.add(b.categoryId!)
    }
  }

  // Find imported transactions not linked to any budget category
  const transactions = await db.transaction.findMany({
    where: {
      userId,
      importSource: 'csv',
      originalCategory: { not: null },
      categoryId: { notIn: [...budgetCatIds] },
    },
    select: { id: true, categoryId: true, originalCategory: true },
  })

  let relinkedCount = 0

  for (const tx of transactions) {
    if (!tx.originalCategory) continue
    const origKey = tx.originalCategory.toLowerCase().trim()

    // Try exact name match to budget category
    let matchedCatId = budgetCatNameToId.get(origKey) ?? null

    // Try partial match (contains or word overlap)
    if (!matchedCatId) {
      for (const [catName, catId] of budgetCatNameToId) {
        if (origKey.includes(catName) || catName.includes(origKey)) {
          matchedCatId = catId
          break
        }
        const origWords = origKey.split(/[\s&,]+/).filter((w) => w.length > 2)
        const catWords = catName.split(/[\s&,]+/).filter((w) => w.length > 2)
        const overlap = origWords.filter((w) => catWords.includes(w)).length
        if (overlap > 0 && overlap >= Math.min(origWords.length, catWords.length) * 0.5) {
          matchedCatId = catId
          break
        }
      }
    }

    if (matchedCatId && matchedCatId !== tx.categoryId) {
      await db.transaction.update({
        where: { id: tx.id },
        data: { categoryId: matchedCatId },
      })
      relinkedCount++
    }
  }

  return relinkedCount
}
