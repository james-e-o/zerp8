'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { useMoney } from '@/components/modules/sales/quotation-shared'
import { formatDateTime, useBranchTimezone } from '@/components/modules/sales/pos-shared'

const TREATMENT_LABEL = {
  cost_of_sales: 'Cost of sales',
  price_variance: 'Price variance',
  keep: 'Kept received cost',
}

function nameOf(v) {
  const title = v?.products?.title || 'Product'
  return v?.variant_label ? `${title} — ${v.variant_label}` : title
}

export default function BillDifferencesReviewedPage() {
  const { branchId } = useParams()
  const money = useMoney()
  const tz = useBranchTimezone(branchId)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('cost_variances')
        .select('id, old_unit_cost, bill_unit_cost, qty_remaining, qty_sold, treatment, auto_resolved, amount_remaining, amount_sold, amount_unapplied, estimate_old, estimate_new, note, decided_at, product_variants(sku, variant_label, products(title))')
        .eq('branch', branchId)
        .eq('status', 'resolved')
        .order('decided_at', { ascending: false })
        .limit(200)
      if (cancelled) return
      if (error) { console.error('Failed to load reviewed bill differences:', error); toast.error(error.message || 'Could not load reviewed items.') }
      setRows(data || [])
      setLoading(false)
    }
    if (branchId) load()
    return () => { cancelled = true }
  }, [branchId])

  return (
    <div className="overflow-auto rounded-md border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2 text-right">Received at</th>
            <th className="px-3 py-2 text-right">Bill</th>
            <th className="px-3 py-2">Treatment</th>
            <th className="px-3 py-2 text-right">Unsold stock value</th>
            <th className="px-3 py-2 text-right">Sold units</th>
            <th className="px-3 py-2">Cost estimate</th>
            <th className="px-3 py-2">Decided</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>
            : rows.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Nothing reviewed yet.</td></tr>
            : rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-3 py-2"><div className="font-medium">{nameOf(r.product_variants)}</div><div className="text-xs text-muted-foreground">{r.product_variants?.sku}</div></td>
                <td className="px-3 py-2 text-right tabular-nums">{money(r.old_unit_cost)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(r.bill_unit_cost)}</td>
                <td className="px-3 py-2">{TREATMENT_LABEL[r.treatment] || '—'}<div className="text-xs text-muted-foreground">{r.auto_resolved ? 'Automatic' : 'Decided by a person'}</div></td>
                <td className="px-3 py-2 text-right tabular-nums">{r.treatment === 'keep' ? '—' : money(r.amount_remaining || 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.treatment === 'keep' ? <span className="text-muted-foreground">{money(r.amount_unapplied || 0)} not applied</span> : money(r.amount_sold || 0)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.estimate_new !== null && r.estimate_new !== undefined
                    ? <>{r.estimate_old !== null && r.estimate_old !== undefined ? `${Number(r.estimate_old)} → ` : 'set to '}{Number(r.estimate_new)}</>
                    : <span className="text-muted-foreground">{r.note || 'Not changed'}</span>}
                </td>
                <td className="px-3 py-2 text-xs">{formatDateTime(r.decided_at, tz)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
