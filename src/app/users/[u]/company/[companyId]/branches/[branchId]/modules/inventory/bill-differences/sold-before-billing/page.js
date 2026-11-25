'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { useMoney } from '@/components/modules/sales/quotation-shared'
import { formatDateTime, useBranchTimezone } from '@/components/modules/sales/pos-shared'

const REFERENCE_LABEL = {
  pos_sale: 'POS sale',
  sales_order: 'Sales order',
  sales_invoice: 'Sales invoice',
  purchase_return: 'Return to supplier',
  stock_adjustment: 'Stock adjustment',
  transfer_out: 'Transfer out',
}

function nameOf(v) {
  const title = v?.products?.title || 'Product'
  return v?.variant_label ? `${title} — ${v.variant_label}` : title
}

export default function SoldBeforeBillingPage() {
  const { branchId } = useParams()
  const money = useMoney()
  const tz = useBranchTimezone(branchId)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('inventory_layer_consumptions')
        .select('id, quantity, unit_cost, created_at, stock_movements(reference_type), inventory_cost_layers!inner(branch, is_provisional, product_variants(sku, variant_label, products(title)))')
        .eq('inventory_cost_layers.branch', branchId)
        .eq('inventory_cost_layers.is_provisional', true)
        .order('created_at', { ascending: false })
        .limit(300)
      if (cancelled) return
      if (error) { console.error('Failed to load sales before billing:', error); toast.error(error.message || 'Could not load the list.') }
      setRows(data || [])
      setLoading(false)
    }
    if (branchId) load()
    return () => { cancelled = true }
  }, [branchId])

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        Units that left stock before their supplier bill was entered. They were costed at the provisional cost. When the bill arrives at a different price, it will appear under To review.
      </div>
      <div className="overflow-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">What happened</th><th className="px-3 py-2 text-right">Units</th><th className="px-3 py-2 text-right">Costed at</th><th className="px-3 py-2">When</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nothing has been sold ahead of its bill.</td></tr>
              : rows.map((r) => {
                const ref = r.stock_movements?.reference_type
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2"><div className="font-medium">{nameOf(r.inventory_cost_layers?.product_variants)}</div><div className="text-xs text-muted-foreground">{r.inventory_cost_layers?.product_variants?.sku}</div></td>
                    <td className="px-3 py-2">{REFERENCE_LABEL[ref] || (ref ? ref.replace(/_/g, ' ') : '—')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(r.quantity)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.unit_cost)}</td>
                    <td className="px-3 py-2 text-xs">{formatDateTime(r.created_at, tz)}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
