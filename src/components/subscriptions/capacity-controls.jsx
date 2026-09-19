'use client'

import { getTiers, isButtonLimit, getTierPrice } from './tiers'

export default function CapacityControls({ limits, values, onChange }) {
  return (
    <div className="space-y-5">
      {Object.entries(limits).map(([key, limit]) => {
        const tiers = getTiers(key)
        const value = values[key] ?? limit.value
        const tierPrice = getTierPrice(key, value)
        if (!tiers.length) return null
        return (
          <div key={key}>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">{limit.name}</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-core font-mono">
                  {Number(value).toLocaleString()} <span className="text-xs font-normal text-muted-foreground font-sans">{limit.unit}</span>
                </span>
                {/* Only shown once the user has moved past the included
                    first tier — makes it clear the base price alone
                    already covers the starting level. */}
                {tierPrice > 0 && (
                  <span className="text-xs font-medium text-core bg-core_light px-1.5 py-0.5 rounded">
                    +₦{tierPrice.toLocaleString()}/mo
                  </span>
                )}
              </div>
            </div>
            {isButtonLimit(key) ? (
              <div className="flex flex-wrap gap-2">
                {tiers.map((tier) => {
                  const price = getTierPrice(key, tier)
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => onChange(key, tier)}
                      className={`rounded border px-3 py-2 text-xs font-semibold transition-colors flex flex-col items-center gap-0.5 ${
                        value === tier
                          ? 'border-core bg-core text-white'
                          : 'border-border bg-card text-foreground hover:border-core/50'
                      }`}
                    >
                      <span>{tier.toLocaleString()}</span>
                      <span className={`text-[10px] font-normal ${value === tier ? 'text-white/80' : 'text-muted-foreground'}`}>
                        {price > 0 ? `+₦${price.toLocaleString()}` : 'included'}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <>
                <input
                  type="range"
                  min="0"
                  max={tiers.length - 1}
                  step="1"
                  value={Math.max(0, tiers.indexOf(value))}
                  onChange={(event) => onChange(key, tiers[Number(event.target.value)])}
                  className="h-2 w-full accent-core"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  {tiers.map((tier) => <span key={tier}>{tier.toLocaleString()}</span>)}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}