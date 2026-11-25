'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { useMoney } from '@/components/modules/sales/quotation-shared'
import { formatDateTime, useBranchTimezone } from '@/components/modules/sales/pos-shared'

function nameOf(v) {
  const title = v?.products?.title || 'Product'
  return v?.variant_label ? `${title} — ${v.variant_label}` : title
}

export default function NotYetBilledPage() {
  const { branchId } = useParams()
  const money = useMoney()
  const tz = useBranchTimezone(branchId)
  const [layers, setLayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('inventory_cost_layers')
        .select('id, variant, remaining_quantity, unit_cost, received_at, product_variants(sku, variant_label, products(title))')
        .eq('branch', branchId)
        .eq('is_provisional', true)
        .gt('remaining_quantity', 0)
        .limit(2000)
      if (cancelled) return
      if (error) { console.error('Failed to load unbilled stock:', error); toast.error(error.message || 'Could not load stock.') }
      setLayers(data || [])
      setLoading(false)
    }
    if (branchId) load()
    return () => { cancelled = true }
  }, [branchId])

  const rows = useMemo(() => {
    const map = new Map()
    for (const l of layers) {
      const cur = map.get(l.variant) || { variant: l.variant, pv: l.product_variants, qty: 0, value: 0, oldest: l.received_at }
      cur.qty += Number(l.remaining_quantity)
      cur.value += Number(l.remaining_quantity) * Number(l.unit_cost)
      if (l.received_at < cur.oldest) cur.oldest = l.received_at
      map.set(l.variant, cur)
    }
    return [...map.values()].sort((a, b) => (a.oldest < b.oldest ? -1 : 1))
  }, [layers])

  const total = rows.reduce((s, r) => s + r.value, 0)

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        Stock on hand that has been received but not yet invoiced. It is valued at the provisional cost (the order price) until the supplier bill is entered.
        Total at provisional cost: <b className="text-foreground">{money(total)}</b>
      </div>
      <div className="overflow-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Units</th><th className="px-3 py-2 text-right">Value at provisional cost</th><th className="px-3 py-2">Waiting since</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Everything on hand has been invoiced.</td></tr>
              : rows.map((r) => (
                <tr key={r.variant} className="border-t border-border">
                  <td className="px-3 py-2"><div className="font-medium">{nameOf(r.pv)}</div><div className="text-xs text-muted-foreground">{r.pv?.sku}</div></td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.value)}</td>
                  <td className="px-3 py-2 text-xs">{formatDateTime(r.oldest, tz)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
