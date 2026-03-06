'use client'

interface Props {
  monthsShifted: number
  newProjectedDate: string
  isVisible: boolean
}

export default function GoalImpactTooltip({ monthsShifted, newProjectedDate, isVisible }: Props) {
  if (!isVisible || monthsShifted === 0) return null

  const projectedMonth = new Date(newProjectedDate).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className={`mt-1 rounded px-2 py-1 text-xs font-medium ${
      monthsShifted > 0
        ? 'bg-ember/10 text-ember'
        : 'bg-pine/10 text-pine'
    }`}>
      {monthsShifted > 0
        ? `Pushes goal to ${projectedMonth} (+${monthsShifted} month${monthsShifted > 1 ? 's' : ''})`
        : `Moves goal closer to ${projectedMonth} (${monthsShifted} month${Math.abs(monthsShifted) > 1 ? 's' : ''})`
      }
    </div>
  )
}
