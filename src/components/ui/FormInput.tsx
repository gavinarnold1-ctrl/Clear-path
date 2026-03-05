'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  startAdornment?: ReactNode
  endAdornment?: ReactNode
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput({ label, error, helperText, startAdornment, endAdornment, id, className = '', ...props }, ref) {
    const inputId = id || props.name
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-fjord">
            {label}
          </label>
        )}
        <div className="relative">
          {startAdornment && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">
              {startAdornment}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'input',
              startAdornment ? 'pl-7' : '',
              endAdornment ? 'pr-10' : '',
              error ? 'border-ember focus-visible:ring-ember/40' : '',
              className,
            ].filter(Boolean).join(' ')}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {endAdornment && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-stone">
              {endAdornment}
            </span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-ember" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-xs text-stone">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
