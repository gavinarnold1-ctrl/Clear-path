'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
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
      <Button size="sm" onClick={() => setOpen(true)}>
        + Add Property
      </Button>
      <PropertySetupWizard
        isOpen={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
      />
    </>
  )
}
