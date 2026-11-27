'use client'

import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { formatCurrency } from '@/components/modules/procurement/dummy-data'

function labelFor(key, limitLabels) {
  if (limitLabels?.[key]) return limitLabels[key]
  const group = String(key).split('.')[0].replaceAll('_', ' ')
  return group.charAt(0).toUpperCase() + group.slice(1)
}

export default function SubscriptionSummary({
  bundles,
  values,
  total,
  pricing,
  billingInterval,
  onConfirm,
  loading,
  currency = 'USD',
  limitLabels,
}) {
  return (
    <aside className="sticky top-3 rounded-lg border border-border bg-card p-3 font-sans">
      <h2 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Your subscription</h2>

      {bundles.length > 0 ? (
        <div className="space-y-1.5">
          {bundles.map((bundle) => (
            <p key={bundle.id} className="flex items-center gap-1.5 text-sm text-foreground">
              <Check className="size-3.5 text-core shrink-0" />
              {bundle.name}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No modules selected yet</p>
      )}

      {Object.keys(values).length > 0 && (
        <div className="my-3 border-y border-border py-3 space-y-1">
          {Object.entries(values).map(([key, value]) => (
            <div key={key} className="flex justify-between items-baseline py-1 text-xs text-muted-foreground">
              <span>{labelFor(key, limitLabels)}</span>
              <strong className="text-foreground font-mono">
                {typeof value === 'number' ? value.toLocaleString() : String(value)}
              </strong>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-foreground">Total</span>
        <strong className="text-xl font-mono text-foreground">
          {pricing ? (
            <span className="text-base text-muted-foreground">calculating…</span>
          ) : (
            <>
              {formatCurrency(total, currency)}
              <span className="text-xs font-normal text-muted-foreground">
                /{billingInterval === 'annual' ? 'yr' : 'mo'}
              </span>
            </>
          )}
        </strong>
      </div>

      <Button
        className="w-full bg-core hover:bg-core/90 text-white"
        disabled={!bundles.length || loading || pricing}
        onClick={onConfirm}
      >
        {loading ? 'Processing...' : 'Continue'}
      </Button>
    </aside>
  )
}