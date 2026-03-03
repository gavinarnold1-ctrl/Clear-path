'use client'

import { useState } from 'react'
import PropertySetupWizard from '@/components/properties/PropertySetupWizard'

interface AccountOption {
  id: string
  name: string
  type: string
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
        <button
          onClick={() => setWizardOpen(true)}
          className="btn-primary px-6 py-2 text-sm"
        >
          + Add Property
        </button>
      </div>

      <PropertySetupWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        accounts={accounts}
      />
    </>
  )
}
