interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'info'
  size?: 'sm' | 'md'
  className?: string
}

const variantClasses = {
  default: 'bg-frost text-stone',
  success: 'bg-pine/10 text-pine',
  warning: 'bg-ember/10 text-ember',
  info: 'bg-fjord/10 text-fjord',
}

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
}

export function Badge({ children, variant = 'default', size = 'sm', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-badge font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {children}
    </span>
  )
}
