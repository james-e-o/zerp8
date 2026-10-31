'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import { formatQty, useBranchCurrency, useStockNames } from '@/components/modules/inventory/inventory-shared'
import { EmptyState, fetchBatches } from '@/components/modules/inventory/receipt-shared'
import { describeRate, useTransferPaths } from '@/components/modules/inventory/transfer-shared'

// Inventory > Transfers > New transfer. Also opens a saved draft:
// .../transfers/new?draft=<id>.
//
// The whole form is kept as one draft (one row, everything in a jsonb
// payload, like the purchase bill drafts). A draft has no number and has not
// touched stock. Submitting turns it into a numbered transfer, which then goes
// to approval (where on) or straight to in transit.
//
// The exchange rate is not typed here. When the receiving branch uses another
// currency, the rate comes from the branches' currency set-up, the same place
// purchase orders read it, and it is shown for information.
// Every result on this page, good or bad, is also shown as a toast.

const blankKey = () => `new-${Math.random().toString(36).slice(2, 10)}`

export default function NewTransferPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftParam = searchParams.get('draft')
  const { branchId, transfers } = useTransferPaths()
  const branchCurrency = useBranchCurrency()

  const [draftId, setDraftId] = useState(draftParam || '')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sources, setSources] = useState([])
  const [destinations, setDestinations] = useState([])
  const [fromWarehouse, setFromWarehouse] = useState('')
  const [toWarehouse, setToWarehouse] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState([])
  const [shelves, setShelves] = useState([])
  const [approvalOn, setApprovalOn] = useState(false)
  const [canEdit, setCanEdit] = useState(true)
  const [canDelete, setCanDelete] = useState(false)
  const [batches, setBatches] = useState({})
  const [batchOptions, setBatchOptions] = useState({})
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])

  // Warehouses of this branch, and every warehouse a transfer can go to.
  useEffect(() => {
    if (!branchId) return
    let cancelled = false
    async function run() {
      const [whResult, destResult] = await Promise.all([
        supabase.from('warehouses').select('id, name, code, is_default').eq('home_branch', branchId).is('archived_at', null).order('name'),
        supabase.rpc('list_transfer_destinations', { p_branch: branchId }),
      ])
      if (cancelled) return
      if (whResult.error) toast.error(whResult.error.message)
      if (destResult.error) toast.error(destResult.error.message)
      const list = whResult.data || []
      setSources(list)
      setDestinations(destResult.data || [])
      if (!draftParam) {
        const preferred = list.find((row) => row.is_default) || list[0]
        if (preferred) setFromWarehouse(preferred.id)
        setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [branchId, draftParam])

  // Open a saved draft.
  useEffect(() => {
    if (!draftParam) return
    let cancelled = false
    async function run() {
      const { data, error } = await supabase.rpc('get_inventory_transfer_draft', { p_draft: draftParam })
      if (cancelled) return
      if (error || !data) {
        toast.error(error?.message || 'That draft could not be found.')
        setLoading(false)
        return
      }
      const payload = data.draft.payload || {}
      setFromWarehouse(payload.from_warehouse || '')
      setToWarehouse(payload.to_warehouse || '')
      setNote(payload.note || '')
      setLines(
        (data.lines || []).map((row) => ({
          key: blankKey(),
          variant: row.variant,
          batch: row.batch || '',
          shelf: row.shelf || '',
          quantity: row.quantity === null || row.quantity === undefined ? '' : String(row.quantity),
          free_here: row.free_here,
        }))
      )
      setShelves(data.shelves_from || [])
      setApprovalOn(Boolean(data.approval_required_now))
      setCanEdit(Boolean(data.can_edit))
      setCanDelete(Boolean(data.can_delete))
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [draftParam])

  // Shelves of the chosen sending warehouse.
  useEffect(() => {
    if (!fromWarehouse) {
      setShelves([])
      return undefined
    }
    let cancelled = false
    supabase
      .from('warehouse_shelves')
      .select('id, code')
      .eq('warehouse', fromWarehouse)
      .is('archived_at', null)
      .order('code')
      .then(({ data }) => {
        if (!cancelled) setShelves(data || [])
      })
    return () => {
      cancelled = true
    }
  }, [fromWarehouse])

  const destination = useMemo(() => destinations.find((row) => row.warehouse === toWarehouse), [destinations, toWarehouse])
  const crossCurrency = Boolean(destination && destination.currency && branchCurrency && destination.currency !== branchCurrency)
  const rateText = crossCurrency ? describeRate(branchCurrency, destination.currency, destination.rate) : ''

  const variantIds = useMemo(() => lines.map((line) => line.variant), [lines])
  const { variants } = useStockNames(variantIds, [])

  useEffect(() => {
    let cancelled = false
    const ids = [...new Set(lines.map((line) => line.batch).filter(Boolean))]
    if (ids.length) {
      fetchBatches(ids).then((found) => {
        if (!cancelled) setBatches((previous) => ({ ...previous, ...found }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [lines])

  useEffect(() => {
    let cancelled = false
    const needed = [...new Set(lines.map((line) => line.variant))].filter(
      (id) => variants[id]?.trackingMode === 'batch' && !batchOptions[id]
    )
    async function run() {
      for (const id of needed) {
        const { data: rows } = await supabase
          .from('inventory_batches')
          .select('id, batch_number, expiry_date')
          .eq('variant', id)
          .order('created_at', { ascending: false })
          .limit(200)
        if (!cancelled) setBatchOptions((previous) => ({ ...previous, [id]: rows || [] }))
      }
    }
    if (needed.length) run()
    return () => {
      cancelled = true
    }
  }, [lines, variants, batchOptions])

  // Free stock for each line, in the chosen sending warehouse.
  useEffect(() => {
    if (!fromWarehouse || lines.length === 0) return undefined
    let cancelled = false
    const ids = [...new Set(lines.map((line) => line.variant))]
    supabase
      .from('inventory_levels')
      .select('variant, quantity_on_hand, quantity_reserved')
      .eq('warehouse', fromWarehouse)
      .in('variant', ids)
      .then(({ data }) => {
        if (cancelled) return
        const free = Object.fromEntries((data || []).map((row) => [row.variant, Number(row.quantity_on_hand || 0) - Number(row.quantity_reserved || 0)]))
        setLines((previous) => previous.map((line) => ({ ...line, free_here: free[line.variant] ?? 0 })))
      })
    return () => {
      cancelled = true
    }
  }, [fromWarehouse, lines.map((line) => line.variant).join(',')])

  // Product search for adding lines.
  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults([])
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const [bySku, byTitle] = await Promise.all([
        supabase
          .from('product_variants')
          .select('id, product, variant_label, sku, tracking_mode, is_tracked_inventory')
          .ilike('sku', `%${term}%`)
          .eq('is_tracked_inventory', true)
          .limit(10),
        supabase.from('products').select('id, title').ilike('title', `%${term}%`).limit(10),
      ])
      let fromTitle = []
      if ((byTitle.data || []).length) {
        const { data: rows } = await supabase
          .from('product_variants')
          .select('id, product, variant_label, sku, tracking_mode, is_tracked_inventory')
          .in('product', byTitle.data.map((row) => row.id))
          .eq('is_tracked_inventory', true)
          .limit(20)
        fromTitle = rows || []
      }
      const titles = new Map((byTitle.data || []).map((row) => [row.id, row.title]))
      const missing = [...new Set([...(bySku.data || []), ...fromTitle].map((row) => row.product).filter((id) => id && !titles.has(id)))]
      if (missing.length) {
        const { data: rows } = await supabase.from('products').select('id, title').in('id', missing)
        for (const row of rows || []) titles.set(row.id, row.title)
      }
      if (cancelled) return
      const seen = new Set()
      const merged = []
      for (const row of [...(bySku.data || []), ...fromTitle]) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        merged.push({ ...row, title: titles.get(row.product) || 'Product' })
      }
      setResults(merged.slice(0, 12))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search])

  function patchLine(key, changes) {
    setLines((previous) => previous.map((line) => (line.key === key ? { ...line, ...changes } : line)))
  }

  function addVariant(row) {
    setLines((previous) => [...previous, { key: blankKey(), variant: row.id, batch: '', shelf: '', quantity: '', free_here: null }])
    setSearch('')
    setResults([])
  }

  function payload() {
    return {
      from_warehouse: fromWarehouse || null,
      to_warehouse: toWarehouse || null,
      note: note || null,
      lines: lines.map((line) => ({
        variant: line.variant,
        batch: line.batch || null,
        shelf: line.shelf || null,
        quantity: line.quantity === '' ? null : Number(line.quantity),
      })),
    }
  }

  // Saves the draft; returns its id, or '' after showing the problem.
  async function persist() {
    if (!fromWarehouse) {
      toast.error('Pick the warehouse stock leaves from.')
      return ''
    }
    const { data, error } = await supabase.rpc('save_inventory_transfer_draft', {
      p_branch: branchId,
      p_draft: draftId || null,
      p_payload: payload(),
    })
    if (error) {
      toast.error(error.message)
      return ''
    }
    if (!data?.success) {
      toast.error(data?.error || 'Could not save the draft.')
      return ''
    }
    setDraftId(data.draft_id)
    return data.draft_id
  }

  async function handleSaveDraft() {
    setBusy(true)
    const id = await persist()
    if (id) {
      toast.success('Draft saved. Nothing has moved.')
      router.push(`${transfers}/drafts`)
    }
    setBusy(false)
  }

  async function handleSubmit() {
    if (!toWarehouse) {
      toast.error('Pick the warehouse to send to.')
      return
    }
    if (lines.length === 0) {
      toast.error('Add at least one product first.')
      return
    }
    if (crossCurrency && !destination?.rate) {
      toast.error(rateText)
      return
    }
    setBusy(true)
    const id = await persist()
    if (!id) {
      setBusy(false)
      return
    }
    const { data, error } = await supabase.rpc('submit_inventory_transfer', { p_draft: id })
    if (error) toast.error(error.message)
    else if (!data?.success) toast.error(data?.error || 'Could not submit.')
    else {
      toast.success(
        data.outcome === 'sent'
          ? `Sent as ${data.transfer_number}. The stock is in transit until the receiving warehouse accepts it.`
          : `${data.transfer_number} sent for approval.`
      )
      router.push(`${transfers}/${data.transfer_id}`)
      return
    }
    setBusy(false)
  }

  async function handleDelete() {
    if (!draftId) {
      router.push(transfers)
      return
    }
    setBusy(true)
    const { data, error } = await supabase.rpc('delete_inventory_transfer_draft', { p_draft: draftId })
    if (error) toast.error(error.message)
    else if (!data?.success) toast.error(data?.error || 'Could not delete the draft.')
    else {
      toast.success('Draft deleted.')
      router.push(`${transfers}/drafts`)
      return
    }
    setBusy(false)
  }

  if (loading) return <p className="p-6 text-xs text-gray-500">Loading...</p>

  return (
    <div className="max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={transfers} className="text-[11px] text-gray-500 hover:underline">
            &larr; Transfers
          </Link>
          <h2 className="mt-1 text-sm font-semibold text-gray-900">{draftId ? 'Draft transfer' : 'New transfer'}</h2>
          <p className="mt-1 text-xs text-gray-500">
            Nothing moves until you submit. After that it is in transit until the receiving warehouse accepts it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => router.push(transfers)} disabled={busy}>
            Close
          </Button>
          {(!draftId || canDelete) && (
            <Button type="button" variant="outline" className="h-7 text-xs" onClick={handleDelete} disabled={busy}>
              {draftId ? 'Delete draft' : 'Discard'}
            </Button>
          )}
          <Button type="button" variant="outline" className="h-7 text-xs" onClick={handleSaveDraft} disabled={busy || !canEdit}>
            Save as draft
          </Button>
          <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/80" onClick={handleSubmit} disabled={busy || !canEdit}>
            {approvalOn ? 'Submit for approval' : 'Submit'}
          </Button>
        </div>
      </div>

      <section className="grid gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-gray-700">
          Send from (this branch)
          <select
            value={fromWarehouse}
            onChange={(event) => setFromWarehouse(event.target.value)}
            disabled={lines.length > 0}
            className="mt-1 h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs disabled:bg-gray-50"
          >
            <option value="">Choose a warehouse</option>
            {sources.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {row.code ? ` (${row.code})` : ''}
              </option>
            ))}
          </select>
          {lines.length > 0 && <span className="mt-1 block text-[11px] font-normal text-gray-500">Remove the products to change the sending warehouse.</span>}
        </label>

        <label className="block text-xs font-medium text-gray-700">
          Send to
          <select
            value={toWarehouse}
            onChange={(event) => setToWarehouse(event.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
          >
            <option value="">Choose a warehouse</option>
            {destinations
              .filter((row) => row.warehouse !== fromWarehouse)
              .map((row) => (
                <option key={row.warehouse} value={row.warehouse}>
                  {row.warehouse_name} · {row.same_branch ? 'this branch' : row.branch_name}
                </option>
              ))}
          </select>
          {destination && (
            <span className="mt-1 block text-[11px] font-normal text-gray-500">
              {destination.same_branch
                ? 'Within this branch. It is still in transit until that warehouse accepts it.'
                : `Goes to ${destination.branch_name}. It shows as incoming there.`}
            </span>
          )}
        </label>

        {crossCurrency && (
          <p className={`text-xs sm:col-span-2 ${destination.rate ? 'text-gray-600' : 'text-red-600'}`}>
            {rateText}
            {destination.rate ? ' (from the branch currencies; the stock is valued in the receiving branch\'s currency at this rate)' : ' Add it to the branch currencies before submitting.'}
          </p>
        )}

        <label className="block text-xs font-medium text-gray-700 sm:col-span-2">
          Note (optional)
          <Input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 h-8 text-xs" />
        </label>
      </section>

      <section className="space-y-2 rounded-lg border border-gray-200 p-4">
        <label className="block text-xs font-medium text-gray-700">
          Add a product
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={!fromWarehouse}
            placeholder={fromWarehouse ? 'Type a product name or SKU' : 'Choose the sending warehouse first'}
            className="mt-1 h-8 text-xs"
          />
        </label>
        {results.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {results.map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => addVariant(row)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-gray-50">
                  <span>
                    {row.title}
                    {row.variant_label ? <span className="text-gray-500"> · {row.variant_label}</span> : null}
                  </span>
                  <span className="font-mono text-[11px] text-gray-500">{row.sku || 'No SKU'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {lines.length === 0 ? (
        <EmptyState>Add the products you want to move.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Batch</th>
                <th className="px-3 py-2 text-left">Take from shelf</th>
                <th className="px-3 py-2 text-right">Free here</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line) => {
                const item = variants[line.variant]
                const isBatch = item?.trackingMode === 'batch'
                const over = line.free_here !== null && line.free_here !== undefined && Number(line.quantity) > Number(line.free_here)
                return (
                  <tr key={line.key} className="align-top">
                    <td className="px-3 py-2">
                      <p className="text-gray-900">{item?.title || '—'}</p>
                      <p className="font-mono text-[11px] text-gray-500">
                        {item?.sku || 'No SKU'}
                        {item?.label ? ` · ${item.label}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      {isBatch ? (
                        <select
                          value={line.batch}
                          onChange={(event) => patchLine(line.key, { batch: event.target.value })}
                          className="h-7 rounded-md border border-gray-300 bg-white px-1 text-xs"
                        >
                          <option value="">Choose batch</option>
                          {(batchOptions[line.variant] || []).map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.batch_number}
                              {entry.expiry_date ? ` (exp ${entry.expiry_date})` : ''}
                            </option>
                          ))}
                          {line.batch && !(batchOptions[line.variant] || []).some((entry) => entry.id === line.batch) && (
                            <option value={line.batch}>{batches[line.batch]?.batch_number || 'Saved batch'}</option>
                          )}
                        </select>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={line.shelf}
                        onChange={(event) => patchLine(line.key, { shelf: event.target.value })}
                        className="h-7 rounded-md border border-gray-300 bg-white px-1 text-xs"
                      >
                        <option value="">Any</option>
                        {shelves.map((shelf) => (
                          <option key={shelf.id} value={shelf.id}>
                            {shelf.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {line.free_here === null || line.free_here === undefined ? '—' : formatQty(line.free_here)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={line.quantity}
                        onChange={(event) => patchLine(line.key, { quantity: event.target.value })}
                        className={`ml-auto h-7 w-24 text-right text-xs ${over ? 'border-red-500 text-red-600' : ''}`}
                      />
                      {over && <p className="mt-0.5 text-[10px] text-red-600">Only {formatQty(line.free_here)} free</p>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setLines((previous) => previous.filter((entry) => entry.key !== line.key))}
                        className="text-[11px] text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
