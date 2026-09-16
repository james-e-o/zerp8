'use client'

import { Button } from '@/components/ui/button'

export default function SubscriptionSummary({ bundles, values, total, onConfirm, loading }) {
  return (
    <aside className="sticky top-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xs font-semibold uppercase text-gray-500">Your subscription</h2>
      <div className="space-y-1">{bundles.map((bundle) => <p key={bundle.id} className="text-sm text-gray-800">✓ {bundle.name}</p>)}</div>
      <div className="my-5 border-y border-gray-100 py-4">{Object.entries(values).map(([key, value]) => <div key={key} className="flex justify-between py-1 text-xs text-gray-600"><span>{key.replaceAll('_', ' ')}</span><strong>{typeof value === 'number' ? value.toLocaleString() : String(value)}</strong></div>)}</div>
      <div className="mb-5 flex items-baseline justify-between"><span className="text-sm font-semibold">Total</span><strong className="text-2xl text-slate-900">₦{total.toLocaleString()}<span className="text-xs font-normal text-gray-500">/mo</span></strong></div>
      <Button className="w-full bg-core text-white" disabled={!bundles.length || loading} onClick={onConfirm}>{loading ? 'Processing...' : 'Continue'}</Button>
    </aside>
  )
}
