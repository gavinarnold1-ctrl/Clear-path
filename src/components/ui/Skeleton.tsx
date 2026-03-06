interface SkeletonProps {
  className?: string
  variant?: 'text' | 'card' | 'circle'
  width?: string
  height?: string
}

export function Skeleton({ className = '', variant = 'text', width, height }: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full rounded',
    card: 'h-32 w-full rounded-card',
    circle: 'h-10 w-10 rounded-full',
  }

  return (
    <div
      className={`animate-pulse bg-mist/50 ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
      role="status"
      aria-label="Loading"
    />
  )
}

export function SkeletonGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-3 ${className}`} aria-busy="true">{children}</div>
}
