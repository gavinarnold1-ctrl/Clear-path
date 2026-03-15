interface Props {
  /** Value from 0–100 */
  value: number
  className?: string
  /** Optional pace marker position (0–100) — renders a vertical line on the bar */
  paceMarker?: number
}

export default function ProgressBar({ value, className, paceMarker }: Props) {
  const capped = Math.min(Math.max(Math.round(value), 0), 100)
  const markerPos = paceMarker !== undefined ? Math.min(Math.max(Math.round(paceMarker), 0), 100) : undefined

  const fillColor =
    capped >= 100 ? 'bg-ember' : capped >= 80 ? 'bg-birch' : 'bg-pine'

  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-bar bg-mist ${className ?? ''}`}
      role="progressbar"
      aria-valuenow={capped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-bar transition-all duration-300 ${fillColor}`}
        style={{ width: `${capped}%` }}
      />
      {markerPos !== undefined && markerPos > 0 && markerPos < 100 && (
        <div
          className="absolute top-0 h-full w-1 bg-fjord/70"
          style={{ left: `${markerPos}%` }}
          title={`Expected pace: ${markerPos}%`}
        />
      )}
    </div>
  )
}
