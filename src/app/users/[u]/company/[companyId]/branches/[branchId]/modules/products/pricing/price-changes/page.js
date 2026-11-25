'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { useMoney } from '@/components/modules/sales/quotation-shared'
import { formatDateTime, useBranchTimezone } from '@/components/modules/sales/pos-shared'

const REASON_LABEL = {
  created: 'Price set',
  manual: 'Changed by hand',
  auto_bill: 'Automatic, after a bill',
  proposal_approved: 'Suggestion approved',
}

function nameOf(v) {
  const title = v?.products?.title || 'Product'
  return v?.variant_label ? `${title} — ${v.variant_label}` : title
}

export default function PriceChangesPage() {
  const { branchId } = useParams()
  const money = useMoney()
  const tz = useBranchTimezone(branchId)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase
          .from('price_history')
          .select('id, variant, old_price, new_price, reason, created_at')
          .eq('branch', branchId)
          .order('created_at', { ascending: false })
          .limit(300)
        if (error) throw error

        const ids = [...new Set((data || []).map((r) => r.variant))]
        let names = {}
        if (ids.length > 0) {
          const { data: variants, error: vErr } = await supabase
            .from('product_variants')
            .select('id, sku, variant_label, products(title)')
            .in('id', ids)
          if (vErr) throw vErr
          names = Object.fromEntries((variants || []).map((v) => [v.id, v]))
        }
        if (cancelled) return
        setRows((data || []).map((r) => ({ ...r, pv: names[r.variant] })))
      } catch (err) {
        console.error('Failed to load price changes:', err)
        toast.error(err?.message || 'Could not load price changes.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (branchId) load()
    return () => { cancelled = true }
  }, [branchId])

  return (
    <div className="overflow-auto rounded-md border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Old price</th><th className="px-3 py-2 text-right">New price</th><th className="px-3 py-2">Why</th><th className="px-3 py-2">When</th></tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>
            : rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No price changes recorded yet.</td></tr>
            : rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2"><div className="font-medium">{nameOf(r.pv)}</div><div className="text-xs text-muted-foreground">{r.pv?.sku}</div></td>
                <td className="px-3 py-2 text-right tabular-nums">{r.old_price === null ? '—' : money(r.old_price)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.new_price === null ? '—' : money(r.new_price)}</td>
                <td className="px-3 py-2">{REASON_LABEL[r.reason] || r.reason}</td>
                <td className="px-3 py-2 text-xs">{formatDateTime(r.created_at, tz)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
