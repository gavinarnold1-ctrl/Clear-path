'use client'

import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'compact' | 'standard' | 'spacious'
  variant?: 'frost' | 'snow' | 'outline'
  as?: 'div' | 'section' | 'article'
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
  action?: ReactNode
}

interface CardBodyProps {
  children: ReactNode
  className?: string
}

const paddingMap = {
  compact: 'p-4',
  standard: 'p-6',
  spacious: 'p-8',
}

const variantMap = {
  frost: 'bg-frost border border-mist',
  snow: 'bg-snow border border-mist',
  outline: 'bg-transparent border border-mist',
}

export function Card({
  children,
  className = '',
  padding = 'standard',
  variant = 'frost',
  as: Component = 'div',
}: CardProps) {
  return (
    <Component
      className={[
        'rounded-card',
        paddingMap[padding],
        variantMap[variant],
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ children, className = '', action }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={className}>{children}</div>
}
