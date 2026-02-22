'use client'

import { useState } from 'react'
import AddAnnualExpenseForm from './AddAnnualExpenseForm'

interface Category {
  id: string
  name: string
  icon: string | null
}

export default function AddExpenseButton({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Add Expense
      </button>
      <AddAnnualExpenseForm
        categories={categories}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
