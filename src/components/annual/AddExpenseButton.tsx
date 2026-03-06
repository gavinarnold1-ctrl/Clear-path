'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
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
      <Button onClick={() => setOpen(true)}>
        + Add Expense
      </Button>
      <AddAnnualExpenseForm
        categories={categories}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
