interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <span className="group relative inline-flex cursor-help">
      {children}
      <span
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-button bg-midnight px-2.5 py-1 text-xs text-snow opacity-0 transition-opacity group-hover:opacity-100 ${positionClasses[position]}`}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  )
}
