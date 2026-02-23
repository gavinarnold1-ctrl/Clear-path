interface EfficiencyScoreGaugeProps {
  overall: number
  spending: number
  savings: number
  debt: number
  summary?: string
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-income'
  if (score >= 40) return 'text-transfer'
  return 'text-expense'
}

function strokeColor(score: number): string {
  if (score >= 70) return 'stroke-green-500'
  if (score >= 40) return 'stroke-amber-400'
  return 'stroke-red-500'
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${scoreColor(value)}`}>{Math.round(value)}</p>
      <p className="text-xs text-stone">{label}</p>
    </div>
  )
}

export default function EfficiencyScoreGauge({
  overall,
  spending,
  savings,
  debt,
  summary,
}: EfficiencyScoreGaugeProps) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = (Math.min(Math.max(overall, 0), 100) / 100) * circumference
  const offset = circumference - progress

  return (
    <div className="card flex flex-col items-center gap-4">
      <h2 className="text-base font-semibold text-fjord">Financial Efficiency</h2>

      {/* Circular gauge */}
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-100"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`transition-all duration-700 ${strokeColor(overall)}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${scoreColor(overall)}`}>{Math.round(overall)}</span>
          <span className="text-xs text-stone">/ 100</span>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="flex w-full justify-around border-t border-mist pt-4">
        <SubScore label="Spending" value={spending} />
        <SubScore label="Savings" value={savings} />
        <SubScore label="Debt" value={debt} />
      </div>

      {summary && <p className="text-center text-sm text-stone">{summary}</p>}
    </div>
  )
}
