'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { useMoney } from '@/components/modules/sales/quotation-shared'

const TREATMENTS = [
  { value: 'cost_of_sales', label: 'Add to cost of sales', help: 'The extra (or saved) cost on units already sold goes into the product’s cost of sales.' },
  { value: 'price_variance', label: 'Record as price variance', help: 'The difference on sold units is kept as a purchase price variance, apart from the product’s margin.' },
  { value: 'keep', label: 'Keep the received cost', help: 'Nothing changes. Use this when you are disputing the bill. The estimate and prices are left alone.' },
]

function productName(v) {
  const title = v?.products?.title || 'Product'
  return v?.variant_label ? `${title} — ${v.variant_label}` : title
}

export default function BillDifferencesPendingPage() {
  const { branchId } = useParams()
  const money = useMoney()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [choice, setChoice] = useState({})
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cost_variances')
      .select('id, kind, old_unit_cost, bill_unit_cost, qty_remaining, qty_sold, created_at, product_variants(sku, variant_label, products(title))')
      .eq('branch', branchId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Failed to load bill differences:', error)
      toast.error(error.message || 'Could not load bill differences.')
    }
    setRows(data || [])
    setLoading(false)
  }, [branchId])

  useEffect(() => { if (branchId) load() }, [branchId, load])

  async function resolve(row) {
    const treatment = choice[row.id] || 'cost_of_sales'
    setBusy(row.id)
    try {
      const { error } = await supabase.rpc('resolve_cost_variance', { p_variance: row.id, p_treatment: treatment })
      if (error) throw error
      toast.success('Bill difference reviewed.')
      await load()
    } catch (err) {
      console.error('Failed to review bill difference:', err)
      toast.error(err?.message || 'Could not review the bill difference.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        These bills (or bill changes) show a different cost from the one stock was received at, and some of that stock is already sold.
        The unsold units always take the bill cost. Choose how to treat the units already sold.
        {' '}
        {TREATMENTS.map((t) => <span key={t.value} className="mr-3 inline-block"><b className="text-foreground">{t.label}:</b> {t.help}</span>)}
      </div>

      <div className="overflow-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2 text-right">Received at</th>
              <th className="px-3 py-2 text-right">Bill says</th>
              <th className="px-3 py-2 text-right">Unsold</th>
              <th className="px-3 py-2 text-right">Sold</th>
              <th className="px-3 py-2 text-right">Effect on sold units</th>
              <th className="px-3 py-2">Treat sold units</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Nothing to review.</td></tr>
              : rows.map((r) => {
                const diff = Number(r.bill_unit_cost) - Number(r.old_unit_cost)
                const effect = diff * Number(r.qty_sold)
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{productName(r.product_variants)}</div>
                      <div className="text-xs text-muted-foreground">{r.product_variants?.sku}</div>
                      {r.kind === 'bill_removed' && <div className="text-xs text-amber-600 dark:text-amber-400">Bill changed or cancelled: back to the order price</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.old_unit_cost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(r.bill_unit_cost)}
                      <div className={`text-xs ${diff > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{diff > 0 ? '+' : ''}{money(diff)} each</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(r.qty_remaining)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(r.qty_sold)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${effect > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{effect > 0 ? '+' : ''}{money(effect)}</td>
                    <td className="px-3 py-2">
                      <select
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                        value={choice[r.id] || 'cost_of_sales'}
                        onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}
                      >
                        {TREATMENTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => resolve(r)}
                        className="h-8 rounded-md bg-core px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {busy === r.id ? 'Applying...' : 'Apply'}
                      </button>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
