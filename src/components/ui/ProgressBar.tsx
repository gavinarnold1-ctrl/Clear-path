interface Props {
  /** Value from 0–100 */
  value: number
  className?: string
}

export default function ProgressBar({ value, className }: Props) {
  const capped = Math.min(Math.max(Math.round(value), 0), 100)

  const trackColor =
    capped >= 100 ? 'bg-red-100' : capped >= 80 ? 'bg-amber-100' : 'bg-gray-100'

  const fillColor =
    capped >= 100 ? 'bg-red-500' : capped >= 80 ? 'bg-amber-400' : 'bg-brand-500'

  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full ${trackColor} ${className ?? ''}`}
      role="progressbar"
      aria-valuenow={capped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${fillColor}`}
        style={{ width: `${capped}%` }}
      />
    </div>
  )
}
