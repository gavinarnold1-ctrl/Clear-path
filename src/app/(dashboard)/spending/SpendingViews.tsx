'use client'

import { useState } from 'react'
import Link from 'next/link'
import SpendingBreakdown from '@/components/dashboard/SpendingBreakdown'
import { formatCurrency } from '@/lib/utils'

interface SpendingGroup {
  group: string
  amount: number
  categories: { name: string; amount: number; id: string }[]
}

interface PersonSpending {
  name: string
  id: string
  amount: number
}

interface PropertySpending {
  name: string
  id: string
  type: string | null
  amount: number
}

interface Props {
  spendingGroups: SpendingGroup[]
  totalSpent: number
  byPerson: PersonSpending[]
  byProperty: PropertySpending[]
  hasMembers: boolean
  hasProperties: boolean
  currentMonth: string
}

type ViewTab = 'category' | 'person' | 'property'

export default function SpendingViews({
  spendingGroups,
  totalSpent,
  byPerson,
  byProperty,
  hasMembers,
  hasProperties,
  currentMonth,
}: Props) {
  const [activeTab, setActiveTab] = useState<ViewTab>('category')

  const tabs: { key: ViewTab; label: string; visible: boolean }[] = [
    { key: 'category', label: 'By Category', visible: true },
    { key: 'person', label: 'By Person', visible: hasMembers },
    { key: 'property', label: 'By Property', visible: hasProperties },
  ]

  const visibleTabs = tabs.filter((t) => t.visible)

  return (
    <div>
      {/* Tab bar — only show if there are multiple views */}
      {visibleTabs.length > 1 && (
        <div className="mb-6 flex gap-1 rounded-lg border border-mist bg-frost p-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-snow text-fjord shadow-sm'
                  : 'text-stone hover:text-fjord'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Views */}
      {activeTab === 'category' && (
        <SpendingBreakdown data={spendingGroups} totalSpent={totalSpent} currentMonth={currentMonth} />
      )}

      {activeTab === 'person' && (
        <BarBreakdown
          items={byPerson.map((p) => ({
            label: p.name,
            amount: p.amount,
            href: p.id ? `/transactions?personId=${p.id}&month=${currentMonth}` : undefined,
          }))}
          totalSpent={totalSpent}
          emptyMessage="No person-tagged expenses this month."
        />
      )}

      {activeTab === 'property' && (
        <BarBreakdown
          items={byProperty.map((p) => ({
            label: p.name,
            badge: p.type === 'RENTAL' ? 'Rental' : p.type === 'PERSONAL' ? 'Personal' : null,
            amount: p.amount,
            href: p.id ? `/transactions?propertyId=${p.id}&month=${currentMonth}` : undefined,
          }))}
          totalSpent={totalSpent}
          emptyMessage="No property-tagged expenses this month."
        />
      )}
    </div>
  )
}

const BAR_COLORS = [
  '#2D5F3E', '#1B3A4B', '#C4704B', '#D4C5A9', '#A3B8A0',
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e',
]

function BarBreakdown({
  items,
  totalSpent,
  emptyMessage,
}: {
  items: { label: string; badge?: string | null; amount: number; href?: string }[]
  totalSpent: number
  emptyMessage: string
}) {
  if (items.length === 0) {
    return (
      <div className="card py-12 text-center">
        <p className="text-sm text-stone">{emptyMessage}</p>
      </div>
    )
  }

  const maxAmount = Math.max(...items.map((i) => i.amount), 1)

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const content = (
          <>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                />
                <span className="text-sm font-semibold text-fjord">{item.label}</span>
                {item.badge && (
                  <span className="rounded-badge bg-frost px-1.5 py-0.5 text-[10px] font-medium text-stone">
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-fjord">
                  {formatCurrency(item.amount)}
                </span>
                <span className="text-xs text-stone">
                  {totalSpent > 0 ? `${((item.amount / totalSpent) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-mist">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round((item.amount / maxAmount) * 100)}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            </div>
          </>
        )

        return item.href ? (
          <Link key={item.label} href={item.href} className="card block hover:border-fjord/30">
            {content}
          </Link>
        ) : (
          <div key={item.label} className="card">
            {content}
          </div>
        )
      })}
    </div>
  )
}
