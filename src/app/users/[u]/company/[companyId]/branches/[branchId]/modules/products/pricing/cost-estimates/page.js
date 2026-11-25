'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'

function nameOf(v) {
  const title = v?.products?.title || 'Product'
  return v?.variant_label ? `${title} — ${v.variant_label}` : title
}

function fmt(amount, currency) {
  const n = Number(amount)
  if (amount === null || amount === undefined || !Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 4 }).format(n)
  } catch {
    return String(n)
  }
}

function fmtDate(v) {
  if (!v) return ''
  try {
    return new Date(v).toLocaleDateString()
  } catch {
    return ''
  }
}

const RULES = [
  { value: 'last_bill', label: 'Last bill' },
  { value: 'stock_average', label: 'Average' },
  { value: 'highest', label: 'Highest' },
  { value: 'lowest', label: 'Lowest' },
]

export default function CostEstimatesPage() {
  const { branchId } = useParams()
  const [rows, setRows] = useState([])
  const [names, setNames] = useState({})
  const [currency, setCurrency] = useState('')
  const [tolerance, setTolerance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState({})
  const [typed, setTyped] = useState({})
  const [billFilter, setBillFilter] = useState('')
  const [layerFor, setLayerFor] = useState(null)
  const [layers, setLayers] = useState([])
  const [layersLoading, setLayersLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_cost_review', { p_branch: branchId })
      if (error) throw error
      const list = data?.rows || []
      setRows(list)
      setCurrency(data?.currency || '')
      setTolerance(Number(data?.tolerance) || 0)
      setPicked({})
      setTyped({})

      const ids = list.map((r) => r.variant)
      if (ids.length > 0) {
        const { data: vars, error: vErr } = await supabase
          .from('product_variants')
          .select('id, sku, variant_label, products(title)')
          .in('id', ids)
        if (vErr) throw vErr
        setNames(Object.fromEntries((vars || []).map((v) => [v.id, v])))
      } else {
        setNames({})
      }
    } catch (err) {
      console.error('Failed to load cost estimates:', err)
      toast.error(err?.message || 'Could not load cost estimates.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    if (branchId) load()
  }, [branchId, load])

  const bills = useMemo(() => {
    const map = new Map()
    rows.forEach((r) => {
      if (r.bill && !map.has(r.bill)) map.set(r.bill, r.bill_number || 'Bill')
    })
    return Array.from(map, ([id, number]) => ({ id, number }))
  }, [rows])

  const visible = useMemo(
    () => (billFilter ? rows.filter((r) => r.bill === billFilter) : rows),
    [rows, billFilter],
  )

  const pickedIds = visible.filter((r) => picked[r.variant]).map((r) => r.variant)

  async function run(fn, okMessage) {
    setBusy(true)
    try {
      await fn()
      if (okMessage) toast.success(okMessage)
      await load()
    } catch (err) {
      console.error('Cost estimate action failed:', err)
      toast.error(err?.message || 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  async function applyRule(variants, rule) {
    if (variants.length === 0) {
      toast.error('Tick the products first.')
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('apply_cost_rule', {
        p_branch: branchId, p_variants: variants, p_rule: rule,
      })
      if (error) throw error
      const updated = data?.updated || 0
      const skipped = data?.skipped || 0
      if (updated > 0) {
        toast.success(`${updated} cost estimate${updated === 1 ? '' : 's'} updated. Selling-price suggestions are in Suggested prices.`)
      }
      if (skipped > 0) {
        const note = (data?.details || []).find((d) => d.note)?.note
        toast.error(`${skipped} not changed${note ? `: ${note}` : '.'}`)
      }
      await load()
    } catch (err) {
      console.error('Failed to apply cost rule:', err)
      toast.error(err?.message || 'Could not update the cost estimates.')
    } finally {
      setBusy(false)
    }
  }

  function setByHand(r) {
    const raw = typed[r.variant]
    const value = raw === undefined || raw === '' ? null : Number(raw)
    if (value === null || !Number.isFinite(value) || value < 0) {
      toast.error(`Enter a cost for ${nameOf(names[r.variant])}.`)
      return
    }
    run(async () => {
      const { error } = await supabase.rpc('set_cost_estimate', {
        p_branch: branchId, p_variant: r.variant, p_cost: value,
      })
      if (error) throw error
    }, 'Cost estimate updated. Selling-price suggestions are in Suggested prices.')
  }

  function keepAsIs(variants) {
    if (variants.length === 0) {
      toast.error('Tick the products first.')
      return
    }
    run(async () => {
      const { error } = await supabase.rpc('dismiss_cost_review', {
        p_branch: branchId, p_variants: variants,
      })
      if (error) throw error
    }, 'Kept as is. They will come back if a newer bill arrives.')
  }

  async function openLayers(r) {
    setLayerFor(r)
    setLayers([])
    setLayersLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_cost_layers', { p_branch: branchId, p_variant: r.variant })
      if (error) throw error
      setLayers(data || [])
    } catch (err) {
      console.error('Failed to load cost layers:', err)
      toast.error(err?.message || 'Could not load the cost layers.')
    } finally {
      setLayersLoading(false)
    }
  }

  async function useLayer(layer) {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('set_cost_estimate_from_layer', { p_branch: branchId, p_layer: layer.id })
      if (error) throw error
      toast.success('Cost estimate updated. Selling-price suggestions are in Suggested prices.')
      setLayerFor(null)
      await load()
    } catch (err) {
      console.error('Failed to use cost layer:', err)
      toast.error(err?.message || 'Could not use that cost layer.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        These products follow a manual cost estimate, and their latest supplier bill differs from it by more than {tolerance}%.
        Choose what each estimate should become. Selling-price suggestions then appear in Suggested prices.
        Products set to follow a rule update themselves and do not appear here.
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2 text-xs">
        <span className="px-1 text-muted-foreground">With the ticked ({pickedIds.length}):</span>
        {RULES.map((rule) => (
          <button
            key={rule.value}
            type="button"
            disabled={busy || pickedIds.length === 0}
            onClick={() => applyRule(pickedIds, rule.value)}
            className="h-8 rounded-md bg-core px-3 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Use {rule.label.toLowerCase()}
          </button>
        ))}
        <button
          type="button"
          disabled={busy || pickedIds.length === 0}
          onClick={() => keepAsIs(pickedIds)}
          className="h-8 rounded-md border border-border px-3 hover:bg-muted disabled:opacity-50"
        >
          Keep as is
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="bill-filter" className="text-muted-foreground">Bill</label>
          <select
            id="bill-filter"
            value={billFilter}
            onChange={(e) => setBillFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">All bills</option>
            {bills.map((b) => <option key={b.id} value={b.id}>{b.number}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Tick all"
                  checked={visible.length > 0 && pickedIds.length === visible.length}
                  onChange={(e) => setPicked(Object.fromEntries(visible.map((r) => [r.variant, e.target.checked])))}
                />
              </th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2 text-right">Estimate{currency ? ` (${currency})` : ''}</th>
              <th className="px-3 py-2 text-right">Last bill</th>
              <th className="px-3 py-2 text-right">Difference</th>
              <th className="px-3 py-2 text-right">On hand: lowest / average / highest</th>
              <th className="px-3 py-2 text-right">Set to</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No cost estimates need review.</td></tr>
            ) : visible.map((r) => (
              <tr key={r.variant} className="border-t border-border">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!picked[r.variant]}
                    onChange={(e) => setPicked((p) => ({ ...p, [r.variant]: e.target.checked }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{nameOf(names[r.variant])}</div>
                  <div className="text-xs text-muted-foreground">{names[r.variant]?.sku}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.estimate === null ? 'Not set' : fmt(r.estimate, currency)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmt(r.last_bill_cost, currency)}
                  <div className="text-xs text-muted-foreground">{r.bill_number || 'Bill'} · {fmtDate(r.issued_at)}</div>
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${Number(r.diff_percent) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {r.diff_percent === null || r.diff_percent === undefined ? '—' : `${Number(r.diff_percent) > 0 ? '+' : ''}${r.diff_percent}%`}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">
                  {r.on_hand_qty ? (
                    <>
                      {fmt(r.lowest, currency)} / {fmt(r.avg_cost, currency)} / {fmt(r.highest, currency)}
                      <div className="text-muted-foreground">{Number(r.on_hand_qty)} on hand</div>
                    </>
                  ) : <span className="text-muted-foreground">No sellable stock</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={typed[r.variant] ?? ''}
                    onChange={(e) => setTyped((t) => ({ ...t, [r.variant]: e.target.value }))}
                    placeholder="Enter cost"
                    className="h-8 w-28 rounded-md border border-border bg-background px-2 text-right text-sm tabular-nums"
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button type="button" disabled={busy} onClick={() => setByHand(r)} className="mr-2 h-8 rounded-md bg-core px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">Set</button>
                  <button type="button" disabled={busy || !r.on_hand_qty} onClick={() => openLayers(r)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-muted disabled:opacity-50">Pick a layer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {layerFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-md border border-border bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{nameOf(names[layerFor.variant])}</div>
                <div className="text-xs text-muted-foreground">
                  Cost layers that still have sellable stock. Choose one to use as the cost estimate.
                </div>
              </div>
              <button type="button" onClick={() => setLayerFor(null)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-muted">Close</button>
            </div>
            <div className="max-h-80 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Received</th>
                    <th className="px-3 py-2">Branch</th>
                    <th className="px-3 py-2 text-right">Left</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {layersLoading ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>
                  ) : layers.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No sellable cost layers.</td></tr>
                  ) : layers.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2">{fmtDate(l.received_at)}{l.provisional ? <div className="text-xs text-muted-foreground">Not billed yet</div> : null}</td>
                      <td className="px-3 py-2">{l.branch_name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(l.remaining)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(l.cost, currency)}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" disabled={busy} onClick={() => useLayer(l)} className="h-8 rounded-md bg-core px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">Use</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}