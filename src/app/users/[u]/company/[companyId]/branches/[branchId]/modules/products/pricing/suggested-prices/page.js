'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { useMoney } from '@/components/modules/sales/quotation-shared'

function nameOf(v) {
  const title = v?.products?.title || 'Product'
  return v?.variant_label ? `${title} — ${v.variant_label}` : title
}

function companyMoney(amount, currency) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 4 }).format(n)
  } catch {
    return String(n)
  }
}

export default function SuggestedPricesPage() {
  const { branchId } = useParams()
  const money = useMoney()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [prices, setPrices] = useState({})
  const [picked, setPicked] = useState({})
  const [busy, setBusy] = useState(false)
  const [companyCurrency, setCompanyCurrency] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('price_proposals')
      .select('id, old_price, proposed_price, new_cost, rate, note, created_at, product_variants(sku, variant_label, products(title))')
      .eq('branch', branchId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Failed to load suggested prices:', error)
      toast.error(error.message || 'Could not load suggested prices.')
    }
    setRows(data || [])
    setPrices({})
    setPicked({})
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    if (!branchId) return
    load()
    ;(async () => {
      const { data, error } = await supabase
        .from('branches').select('companies(default_currency)').eq('id', branchId).maybeSingle()
      if (error) { console.error('Failed to load company currency:', error); return }
      setCompanyCurrency(data?.companies?.default_currency || '')
    })()
  }, [branchId, load])

  const priceFor = (r) => (prices[r.id] !== undefined ? prices[r.id] : (r.proposed_price ?? ''))

  async function approveOne(r, quiet) {
    const raw = priceFor(r)
    const price = raw === '' ? null : Number(raw)
    if (price === null || !Number.isFinite(price) || price < 0) {
      throw new Error(`Enter a price for ${nameOf(r.product_variants)}.`)
    }
    const { error } = await supabase.rpc('approve_price_proposal', { p_proposal: r.id, p_price: price })
    if (error) throw error
    if (!quiet) toast.success('Price updated.')
  }

  async function approve(r) {
    setBusy(true)
    try {
      await approveOne(r, false)
      await load()
    } catch (err) {
      console.error('Failed to approve suggested price:', err)
      toast.error(err?.message || 'Could not update the price.')
    } finally {
      setBusy(false)
    }
  }

  async function reject(r) {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('reject_price_proposal', { p_proposal: r.id })
      if (error) throw error
      toast.success('Suggestion rejected. The price is unchanged.')
      await load()
    } catch (err) {
      console.error('Failed to reject suggested price:', err)
      toast.error(err?.message || 'Could not reject the suggested price.')
    } finally {
      setBusy(false)
    }
  }

  async function approveSelected() {
    const chosen = rows.filter((r) => picked[r.id])
    if (chosen.length === 0) { toast.error('Select suggested prices to approve first.'); return }
    setBusy(true)
    let done = 0
    try {
      for (const r of chosen) {
        await approveOne(r, true)
        done += 1
      }
      toast.success(`${done} price${done === 1 ? '' : 's'} updated.`)
    } catch (err) {
      console.error('Failed to approve selected suggested prices:', err)
      toast.error(`${done} updated, then stopped: ${err?.message || 'unknown error'}`)
    } finally {
      await load()
      setBusy(false)
    }
  }

  const pickedCount = Object.values(picked).filter(Boolean).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        <span>
          A supplier bill changed a product’s cost estimate. These prices were worked out from the margin set on each product.
          You can change a price before approving it. Rejecting leaves the price as it is.
        </span>
        <button
          type="button"
          disabled={busy || pickedCount === 0}
          onClick={approveSelected}
          className="h-8 shrink-0 rounded-md bg-core px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Approve selected{pickedCount ? ` (${pickedCount})` : ''}
        </button>
      </div>

      <div className="overflow-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2 text-right">Current price</th>
              <th className="px-3 py-2 text-right">New cost{companyCurrency ? ` (${companyCurrency})` : ''}</th>
              <th className="px-3 py-2 text-right">New price</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No suggested prices are waiting.</td></tr>
              : rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={!!picked[r.id]} onChange={(e) => setPicked((p) => ({ ...p, [r.id]: e.target.checked }))} />
                  </td>
                  <td className="px-3 py-2"><div className="font-medium">{nameOf(r.product_variants)}</div><div className="text-xs text-muted-foreground">{r.product_variants?.sku}</div></td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.old_price === null ? '—' : money(r.old_price)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {companyMoney(r.new_cost, companyCurrency)}
                    {r.rate && Number(r.rate) !== 1 ? <div className="text-xs text-muted-foreground">rate {Number(r.rate)}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={priceFor(r)}
                      onChange={(e) => setPrices((p) => ({ ...p, [r.id]: e.target.value }))}
                      placeholder="Enter price"
                      className="h-8 w-28 rounded-md border border-border bg-background px-2 text-right text-sm tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.note || ''}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button type="button" disabled={busy} onClick={() => approve(r)} className="mr-2 h-8 rounded-md bg-core px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">Approve</button>
                    <button type="button" disabled={busy} onClick={() => reject(r)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-muted disabled:opacity-50">Reject</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
