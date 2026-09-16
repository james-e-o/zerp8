'use client'

import { getTiers, isButtonLimit } from './tiers'

export default function CapacityControls({ limits, values, onChange }) {
  return (
    <div className="space-y-5">
      {Object.entries(limits).map(([key, limit]) => {
        const tiers = getTiers(key)
        const value = values[key] ?? limit.value
        if (!tiers.length) return null
        return (
          <div key={key}>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-800">{limit.name}</label>
              <span className="text-sm font-bold text-core">{Number(value).toLocaleString()} <span className="text-xs font-normal text-gray-500">{limit.unit}</span></span>
            </div>
            {isButtonLimit(key) ? (
              <div className="flex flex-wrap gap-2">
                {tiers.map((tier) => <button key={tier} type="button" onClick={() => onChange(key, tier)} className={`rounded border px-3 py-2 text-xs font-semibold ${value === tier ? 'border-core bg-core text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-core/50'}`}>{tier.toLocaleString()}</button>)}
              </div>
            ) : (
              <>
                <input type="range" min="0" max={tiers.length - 1} step="1" value={Math.max(0, tiers.indexOf(value))} onChange={(event) => onChange(key, tiers[Number(event.target.value)])} className="h-2 w-full accent-core" />
                <div className="mt-1 flex justify-between text-[10px] text-gray-400">{tiers.map((tier) => <span key={tier}>{tier.toLocaleString()}</span>)}</div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
