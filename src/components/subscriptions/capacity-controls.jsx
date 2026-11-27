'use client'

import { formatCurrency } from '@/components/modules/procurement/dummy-data'

const BUTTON_LIMIT_KEYS = new Set(['branches.max_count', 'staff.max_count', 'warehouses.max_count'])

export default function CapacityControls({ limits, values, tiers, onChange, currency = 'USD' }) {
  return (
    <div className="space-y-3">
      {Object.entries(limits).map(([key, limit]) => {
        const ladder = tiers[key] || []
        const value = values[key] ?? limit.value
        const currentTier = ladder.find((t) => t.value === value)
        const tierPrice = currentTier?.priceDelta || 0
        if (!ladder.length) return null

        const isButtons = BUTTON_LIMIT_KEYS.has(key)

        return (
          <div key={key}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">{limit.name}</label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-core font-mono">
                  {Number(value).toLocaleString()} <span className="text-xs font-normal text-muted-foreground font-sans">{limit.unit}</span>
                </span>
                {tierPrice > 0 && (
                  <span className="text-xs font-medium text-core bg-core_light px-1.5 py-0.5 rounded">
                    +{formatCurrency(tierPrice, currency)}/mo
                  </span>
                )}
              </div>
            </div>

            {isButtons ? (
              <div className="flex flex-wrap gap-1.5">
                {ladder.map((tier) => (
                  <button
                    key={tier.tierIndex}
                    type="button"
                    onClick={() => onChange(key, tier.value)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors flex flex-col items-center gap-0.5 ${
                      value === tier.value
                        ? 'border-core bg-core text-white'
                        : 'border-border bg-card text-foreground hover:border-core/50'
                    }`}
                  >
                    <span>{tier.value.toLocaleString()}</span>
                    <span className={`text-[10px] font-normal ${value === tier.value ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {tier.priceDelta > 0 ? `+${formatCurrency(tier.priceDelta, currency)}` : 'included'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <input
                  type="range"
                  min="0"
                  max={ladder.length - 1}
                  step="1"
                  value={Math.max(0, ladder.findIndex((t) => t.value === value))}
                  onChange={(event) => onChange(key, ladder[Number(event.target.value)].value)}
                  className="h-2 w-full accent-core"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  {ladder.map((t) => <span key={t.tierIndex}>{t.value.toLocaleString()}</span>)}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}