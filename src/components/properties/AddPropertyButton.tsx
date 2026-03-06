'use client'

import { useState } from 'react'
import PropertySetupWizard from '@/components/properties/PropertySetupWizard'

interface AccountOption {
  id: string
  name: string
  type: string
  balance: number
}

export default function AddPropertyButton({ accounts }: { accounts: AccountOption[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary text-sm px-4 py-1.5">
        + Add Property
      </button>
      <PropertySetupWizard
        isOpen={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
      />
    </>
  )
}
