'use client'

import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react'

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  children: ReactNode
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  function FormSelect({ label, error, helperText, id, className = '', children, ...props }, ref) {
    const selectId = id || props.name
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-fjord">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={[
            'input',
            error ? 'border-ember focus-visible:ring-ember/40' : '',
            className,
          ].filter(Boolean).join(' ')}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="text-xs text-ember" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${selectId}-helper`} className="text-xs text-stone">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
