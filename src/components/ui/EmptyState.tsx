'use client'

import { type ReactNode } from 'react'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-frost text-stone">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-fjord">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-stone">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Button variant="secondary" size="sm" href={action.href}>
              {action.label}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
