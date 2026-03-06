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

interface Props {
  accounts: AccountOption[]
}

export default function AddPropertyInline({ accounts }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <>
      <div className="card py-8 text-center">
        <h3 className="text-lg font-medium text-fjord mb-2">Track Your Properties</h3>
        <p className="text-sm text-stone mb-4 max-w-md mx-auto">
          Add your rental properties, primary home, or business to track income, expenses,
          tax deductions, and mortgage breakdown automatically.
        </p>
        <Button onClick={() => setWizardOpen(true)}>
          + Add Property
        </Button>
      </div>

      <PropertySetupWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        accounts={accounts}
      />
    </>
  )
}
