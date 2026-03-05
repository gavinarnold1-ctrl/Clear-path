'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import Link from 'next/link'

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonBaseProps {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingText?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

interface ButtonAsButton extends ButtonBaseProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  href?: never
  children: ReactNode
}

interface ButtonAsLink extends ButtonBaseProps {
  href: string
  children: ReactNode
  className?: string
  target?: string
  rel?: string
}

type ButtonProps = ButtonAsButton | ButtonAsLink

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-fjord text-snow hover:bg-midnight focus-visible:ring-fjord/40',
  secondary: 'border border-mist bg-transparent text-fjord hover:bg-frost focus-visible:ring-fjord/40',
  success: 'bg-pine text-snow hover:opacity-90 focus-visible:ring-pine/40',
  danger: 'bg-ember text-snow hover:opacity-90 focus-visible:ring-ember/40',
  outline: 'border border-fjord bg-transparent text-fjord hover:bg-fjord hover:text-snow focus-visible:ring-fjord/40',
  ghost: 'bg-transparent text-stone hover:text-fjord hover:bg-frost focus-visible:ring-fjord/40',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      className = '',
      ...rest
    } = props

    const baseClasses = [
      'inline-flex items-center justify-center gap-2 rounded-button font-medium',
      'transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variantClasses[variant],
      sizeClasses[size],
      fullWidth ? 'w-full' : '',
      className,
    ].filter(Boolean).join(' ')

    // Link variant
    if ('href' in props && props.href) {
      const { href, target, rel } = rest as ButtonAsLink
      return (
        <Link
          href={href}
          className={baseClasses}
          target={target}
          rel={rel}
        >
          {leftIcon}
          {children}
          {rightIcon}
        </Link>
      )
    }

    // Button variant
    const buttonProps = rest as Omit<ButtonAsButton, 'children' | 'variant' | 'size' | 'loading' | 'loadingText' | 'leftIcon' | 'rightIcon' | 'fullWidth'>
    return (
      <button
        ref={ref}
        className={baseClasses}
        disabled={loading || buttonProps.disabled}
        {...buttonProps}
      >
        {loading ? (
          <>
            <Spinner />
            {loadingText || children}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    )
  }
)
