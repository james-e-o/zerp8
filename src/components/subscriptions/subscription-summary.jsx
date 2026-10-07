'use client'

import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

export default function SubscriptionSummary({ bundles, values, total, pricing, billingInterval, onConfirm, loading }) {
  return (
    <aside className="sticky top-4 rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase text-muted-foreground">Your subscription</h2>

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
        <div className="my-5 border-y border-border py-4 space-y-1.5">
          {Object.entries(values).map(([key, value]) => (
            <div key={key} className="flex justify-between items-baseline py-1 text-xs text-muted-foreground">
              <span className="capitalize">{key.replaceAll('_', ' ')}</span>
              <strong className="text-foreground font-mono">
                {typeof value === 'number' ? value.toLocaleString() : String(value)}
              </strong>
            </div>
          ))}
        </div>
      )}

      <div className="mb-5 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-foreground">Total</span>
        <strong className="text-2xl font-mono text-foreground">
          {pricing ? (
            <span className="text-base text-muted-foreground">calculating…</span>
          ) : (
            <>
              ₦{total.toLocaleString()}
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