interface Props {
  /** Value from 0–100 */
  value: number
  className?: string
}

export default function ProgressBar({ value, className }: Props) {
  const capped = Math.min(Math.max(Math.round(value), 0), 100)

  const fillColor =
    capped >= 100 ? 'bg-ember' : capped >= 80 ? 'bg-birch' : 'bg-pine'

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-bar bg-mist ${className ?? ''}`}
      role="progressbar"
      aria-valuenow={capped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-bar transition-all duration-300 ${fillColor}`}
        style={{ width: `${capped}%` }}
      />
    </div>
  )
}
