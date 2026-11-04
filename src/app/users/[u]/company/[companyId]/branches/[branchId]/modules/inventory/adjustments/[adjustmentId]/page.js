'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import { formatQty, useStockNames } from '@/components/modules/inventory/inventory-shared'
import { EmptyState, ErrorNote, Tone, fetchBatches } from '@/components/modules/inventory/receipt-shared'
import {
  KIND,
  REASONS,
  STATUS,
  formatDateTime,
  fromLocalInput,
  reasonLabel,
  signed,
  toLocalInput,
  useAdjustmentPaths,
} from '@/components/modules/inventory/adjustment-shared'

// Inventory > Adjustments > one document.
//
// counting   lines are editable. A count line holds the quantity counted and
//            when it was counted (left empty = the time it is saved). The
//            system compares it with what the books said was available AT
//            THAT TIME, so stock that moved afterwards is not blamed on the
//            counter. Only the difference is posted.
// pending    submitted. Approvers see what was counted, when it was counted
//            and when it was typed in. Approved documents are posted here.
// posted     history; the lines cannot change.

const blankKey = () => `new-${Math.random().toString(36).slice(2, 10)}`

function lineFromRow(row) {
  return {
    key: row.id,
    id: row.id,
    variant: row.variant,
    batch: row.batch || '',
    shelf: row.shelf || '',
    counted_quantity: row.counted_quantity === null || row.counted_quantity === undefined ? '' : String(row.counted_quantity),
    counted_at: toLocalInput(row.counted_at),
    counted_at_dirty: false,
    quantity_change: row.quantity_change === null || row.quantity_change === undefined ? '' : String(row.quantity_change),
    reason: row.reason || 'count_variance',
    note: row.note || '',
    unit_cost: row.unit_cost === null || row.unit_cost === undefined ? '' : String(row.unit_cost),
    expected: row.expected_quantity,
    variance: row.quantity_change,
    entered_at: row.entered_at,
    saved_counted_at: row.counted_at,
  }
}

export default function Page() {
  const { adjustmentId } = useParams()
  const { adjustments } = useAdjustmentPaths()

  const [doc, setDoc] = useState(null)
  const [lines, setLines] = useState([])
  const [approval, setApproval] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [shelves, setShelves] = useState({})
  const [batches, setBatches] = useState({})
  const [batchOptions, setBatchOptions] = useState({})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [voteNote, setVoteNote] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])

  // Every result is shown inline and as a toast.
  function showError(text) {
    setError(text)
    if (text) toast.error(text)
  }

  function showMessage(text) {
    setMessage(text)
    if (text) toast.success(text)
  }

  const load = useCallback(async () => {
    if (!adjustmentId) return
    setLoadError('')
    const [docResult, lineResult, stateResult] = await Promise.all([
      supabase.from('inventory_adjustments').select('*').eq('id', adjustmentId).maybeSingle(),
      supabase.from('inventory_adjustment_lines').select('*').eq('adjustment', adjustmentId).order('created_at'),
      supabase.rpc('inventory_adjustment_approval_state', { p_adjustment: adjustmentId }),
    ])
    const failure = docResult.error || lineResult.error
    if (failure || !docResult.data) {
      setLoadError(failure?.message || 'Adjustment not found.')
      toast.error(failure?.message || 'Adjustment not found.')
      setLoading(false)
      return
    }
    setDoc(docResult.data)
    setLines((lineResult.data || []).map(lineFromRow))
    setApproval(stateResult.error ? null : stateResult.data)
    setDirty(false)
    setLoading(false)
  }, [adjustmentId])

  useEffect(() => {
    load()
  }, [load])

  const variantIds = useMemo(() => lines.map((line) => line.variant), [lines])
  const { variants, warehouses } = useStockNames(variantIds, doc ? [doc.warehouse] : [])

  // Shelf codes and batch numbers for the lines on screen.
  useEffect(() => {
    let cancelled = false
    const shelfIds = [...new Set(lines.map((line) => line.shelf).filter(Boolean))]
    const batchIds = [...new Set(lines.map((line) => line.batch).filter(Boolean))]
    async function run() {
      if (shelfIds.length) {
        const { data } = await supabase.from('warehouse_shelves').select('id, code').in('id', shelfIds)
        if (!cancelled) setShelves((previous) => ({ ...previous, ...Object.fromEntries((data || []).map((row) => [row.id, row.code])) }))
      }
      if (batchIds.length) {
        const found = await fetchBatches(batchIds)
        if (!cancelled) setBatches((previous) => ({ ...previous, ...found }))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [lines])

  // Batch choices for batch-tracked products on the page.
  useEffect(() => {
    let cancelled = false
    const needed = [...new Set(lines.map((line) => line.variant))].filter(
      (id) => variants[id]?.trackingMode === 'batch' && !batchOptions[id]
    )
    async function run() {
      for (const id of needed) {
        const { data } = await supabase
          .from('inventory_batches')
          .select('id, batch_number, expiry_date')
          .eq('variant', id)
          .order('created_at', { ascending: false })
          .limit(200)
        if (!cancelled) setBatchOptions((previous) => ({ ...previous, [id]: data || [] }))
      }
    }
    if (needed.length) run()
    return () => {
      cancelled = true
    }
  }, [lines, variants, batchOptions])

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
        const { data } = await supabase
          .from('product_variants')
          .select('id, product, variant_label, sku, tracking_mode, is_tracked_inventory')
          .in('product', byTitle.data.map((row) => row.id))
          .eq('is_tracked_inventory', true)
          .limit(20)
        fromTitle = data || []
      }
      const titles = new Map((byTitle.data || []).map((row) => [row.id, row.title]))
      const missing = [...new Set([...(bySku.data || []), ...fromTitle].map((row) => row.product).filter((id) => id && !titles.has(id)))]
      if (missing.length) {
        const { data } = await supabase.from('products').select('id, title').in('id', missing)
        for (const row of data || []) titles.set(row.id, row.title)
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

  const isCount = doc?.kind === 'count'
  const editable = Boolean(doc && doc.status === 'counting' && approval?.can_edit)

  function patchLine(key, changes) {
    setLines((previous) => previous.map((line) => (line.key === key ? { ...line, ...changes } : line)))
    setDirty(true)
  }

  function addVariant(row) {
    setLines((previous) => [
      ...previous,
      {
        key: blankKey(),
        id: null,
        variant: row.id,
        batch: '',
        shelf: '',
        counted_quantity: '',
        counted_at: '',
        counted_at_dirty: false,
        quantity_change: '',
        reason: isCount ? 'count_variance' : 'correction',
        note: '',
        unit_cost: '',
        expected: null,
        variance: null,
        entered_at: null,
        saved_counted_at: null,
      },
    ])
    setSearch('')
    setResults([])
    setDirty(true)
  }

  function removeLine(key) {
    setLines((previous) => previous.filter((line) => line.key !== key))
    setDirty(true)
  }

  function buildPayload() {
    return lines.map((line) => {
      const out = {
        variant: line.variant,
        batch: line.batch || null,
        shelf: line.shelf || null,
        reason: line.reason,
        note: line.note || null,
        unit_cost: line.unit_cost === '' ? null : Number(line.unit_cost),
      }
      if (isCount) {
        out.counted_quantity = line.counted_quantity === '' ? null : Number(line.counted_quantity)
        if (line.counted_at_dirty) out.counted_at = fromLocalInput(line.counted_at)
      } else {
        out.quantity_change = line.quantity_change === '' ? null : Number(line.quantity_change)
      }
      return out
    })
  }

  async function saveLines() {
    const { data, error: rpcError } = await supabase.rpc('save_inventory_adjustment_lines', {
      p_adjustment: adjustmentId,
      p_lines: buildPayload(),
    })
    if (rpcError) return rpcError.message
    if (!data?.success) return data?.error || 'Could not save.'
    return ''
  }

  async function handleSave() {
    setBusy(true)
    setError('')
    setMessage('')
    const problem = await saveLines()
    if (problem) {
      showError(problem)
    } else {
      showMessage('Saved.')
      await load()
    }
    setBusy(false)
  }

  async function handleSubmit() {
    setBusy(true)
    setError('')
    setMessage('')
    if (dirty) {
      const problem = await saveLines()
      if (problem) {
        showError(problem)
        setBusy(false)
        return
      }
    }
    const { data, error: rpcError } = await supabase.rpc('submit_inventory_adjustment', { p_adjustment: adjustmentId })
    if (rpcError) showError(rpcError.message)
    else if (!data?.success) showError(data?.error || 'Could not submit.')
    else if (data.outcome === 'posted') {
      showMessage(data.moved > 0 ? `Posted. ${data.moved} line${data.moved === 1 ? '' : 's'} changed stock.` : 'Posted. Everything matched the books, so stock did not change.')
    } else showMessage('Sent for approval.')
    await load()
    setBusy(false)
  }

  async function runAction(promise, done) {
    setBusy(true)
    setError('')
    setMessage('')
    const { data, error: rpcError } = await promise
    if (rpcError) showError(rpcError.message)
    else if (data && data.success === false) showError(data.error || 'That did not work.')
    else if (done) showMessage(done)
    await load()
    setBusy(false)
  }

  const vote = (decision) =>
    runAction(
      supabase.rpc('cast_approval_vote', { p_request_id: approval.request_id, p_decision: decision, p_note: voteNote || null }),
      decision === 'approved' ? 'Your approval is recorded.' : 'Rejected.'
    ).then(() => setVoteNote(''))
  const post = () => runAction(supabase.rpc('post_inventory_adjustment', { p_adjustment: adjustmentId }), 'Posted. Stock has changed.')
  const reopen = () => runAction(supabase.rpc('reopen_inventory_adjustment', { p_adjustment: adjustmentId }), 'Reopened. Change what you need and submit again.')
  const cancel = async () => {
    await runAction(
      supabase.rpc('cancel_inventory_adjustment', { p_adjustment: adjustmentId, p_reason: cancelReason || null }),
      'Cancelled.'
    )
    setShowCancel(false)
  }

  if (loading) return <p className="p-6 text-xs text-gray-500">Loading...</p>
  if (loadError) return <div className="p-6"><ErrorNote>{loadError}</ErrorNote></div>

  const requestStatus = approval?.request_status
  const displayStatus =
    doc.status === 'pending' ? (requestStatus === 'approved' ? 'approved' : requestStatus === 'rejected' ? 'rejected' : 'pending') : doc.status
  const status = STATUS[displayStatus] || STATUS.counting
  const kind = KIND[doc.kind] || KIND.adjustment
  const countedLines = lines.filter((line) => (isCount ? line.counted_quantity !== '' : line.quantity_change !== ''))
  const netChange = lines.reduce((sum, line) => sum + Number(line.variance ?? (isCount ? 0 : line.quantity_change) ?? 0), 0)
  const rejection = (approval?.votes || []).find((entry) => entry.decision === 'rejected')

  return (
    <div className="max-w-6xl space-y-2 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={adjustments} className="text-[11px] text-gray-500 hover:underline">
            &larr; Adjustments
          </Link>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="font-mono">{doc.adjustment_number}</span>
            <Tone tone={kind.tone}>{kind.label}</Tone>
            <Tone tone={status.tone}>{status.label}</Tone>
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {warehouses[doc.warehouse] || 'Warehouse'} · started {formatDateTime(doc.started_at)}
            {approval?.created_by_name ? ` by ${approval.created_by_name}` : ''}
            {doc.posted_at ? ` · posted ${formatDateTime(doc.posted_at)}` : ''}
          </p>
          {doc.note && <p className="mt-1 text-xs text-gray-700">{doc.note}</p>}
          {doc.status === 'cancelled' && (
            <p className="mt-1 text-xs text-gray-600">
              Cancelled {formatDateTime(doc.cancelled_at)}
              {doc.cancel_reason ? `: ${doc.cancel_reason}` : ''}
            </p>
          )}
        </div>
        {approval?.can_cancel && !showCancel && (
          <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => setShowCancel(true)} disabled={busy}>
            Cancel this {isCount ? 'count' : 'adjustment'}
          </Button>
        )}
      </div>

      {showCancel && (
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          <Input
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Why? (optional)"
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => setShowCancel(false)} disabled={busy}>
              Keep it
            </Button>
            <Button type="button" className="h-7 bg-red-600 text-xs text-white hover:bg-red-700" onClick={cancel} disabled={busy}>
              Yes, cancel it
            </Button>
          </div>
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{message}</p>}

      {doc.status === 'pending' && approval && (
        <section className="space-y-3 rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-800">Approval</h3>
          <p className="text-xs text-gray-600">
            {requestStatus === 'approved'
              ? 'Approved. Nothing has changed stock yet; post it to apply the differences.'
              : requestStatus === 'rejected'
                ? 'Rejected. Reopen it to correct the lines, then submit it again.'
                : `Submitted${approval.submitted_by_name ? ` by ${approval.submitted_by_name}` : ''}. ${approval.approvals} of ${approval.approvals_required} approval${approval.approvals_required === 1 ? '' : 's'} so far. Stock does not change until it is approved and posted.`}
          </p>
          {(approval.votes || []).map((entry, index) => (
            <p key={index} className="text-[11px] text-gray-600">
              {entry.name} {entry.decision === 'approved' ? 'approved' : 'rejected'} on {formatDateTime(entry.at)}
              {entry.note ? `: ${entry.note}` : ''}
            </p>
          ))}
          {rejection && !rejection.note && <p className="text-[11px] text-gray-500">No reason was given.</p>}

          {approval.can_vote && (
            <div className="space-y-2">
              <Input
                value={voteNote}
                onChange={(event) => setVoteNote(event.target.value)}
                placeholder="Note (optional)"
                className="h-8 text-xs"
              />
              <div className="flex gap-2">
                <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/80" onClick={() => vote('approved')} disabled={busy}>
                  Approve
                </Button>
                <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => vote('rejected')} disabled={busy}>
                  Reject
                </Button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {approval.can_post && (
              <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/80" onClick={post} disabled={busy}>
                Post to stock
              </Button>
            )}
            {approval.can_reopen && (
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={reopen} disabled={busy}>
                {requestStatus === 'rejected' ? 'Reopen to fix' : 'Withdraw and edit'}
              </Button>
            )}
          </div>
        </section>
      )}

      {editable && (
        <section className="space-y-2 rounded-lg border border-gray-200 p-4">
          <label className="block text-xs font-medium text-gray-700">
            Add a product
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type a product name or SKU"
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
      )}

      {lines.length === 0 ? (
        <EmptyState>{editable ? 'Add the products you counted or want to change.' : 'This document has no lines.'}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-245 text-xs">
            <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Batch / shelf</th>
                {isCount ? (
                  <>
                    <th className="px-3 py-2 text-right">Counted</th>
                    <th className="px-3 py-2 text-left">Counted at</th>
                    <th className="px-3 py-2 text-right" title="What the books said was available at the time of the count">Books said</th>
                    <th className="px-3 py-2 text-right">Difference</th>
                  </>
                ) : (
                  <th className="px-3 py-2 text-right">Change (+ or -)</th>
                )}
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">Cost per unit</th>
                <th className="px-3 py-2 text-left">Note</th>
                {editable && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line) => {
                const item = variants[line.variant]
                const isBatch = item?.trackingMode === 'batch'
                const change = isCount ? line.variance : line.quantity_change === '' ? null : Number(line.quantity_change)
                const enteredLater =
                  isCount && line.saved_counted_at && line.entered_at &&
                  Math.abs(new Date(line.entered_at) - new Date(line.saved_counted_at)) > 5 * 60 * 1000
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
                        editable && !line.id ? (
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
                          </select>
                        ) : (
                          <span className="font-mono text-[11px]">{batches[line.batch]?.batch_number || '—'}</span>
                        )
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {line.shelf && <p className="text-[11px] text-gray-500">Shelf {shelves[line.shelf] || ''}</p>}
                    </td>

                    {isCount ? (
                      <>
                        <td className="px-3 py-2 text-right">
                          {editable ? (
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={line.counted_quantity}
                              onChange={(event) => patchLine(line.key, { counted_quantity: event.target.value })}
                              className="ml-auto h-7 w-24 text-right text-xs"
                            />
                          ) : line.counted_quantity === '' ? (
                            <span className="text-gray-400">Not counted</span>
                          ) : (
                            formatQty(line.counted_quantity)
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editable ? (
                            <input
                              type="datetime-local"
                              value={line.counted_at}
                              onChange={(event) => patchLine(line.key, { counted_at: event.target.value, counted_at_dirty: true })}
                              className="h-7 rounded-md border border-gray-300 px-1 text-[11px]"
                              title="Leave empty to use the time you save"
                            />
                          ) : (
                            <>
                              <p>{formatDateTime(line.saved_counted_at)}</p>
                              {enteredLater && <p className="text-[11px] text-amber-700">Entered {formatDateTime(line.entered_at)}</p>}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {line.expected === null || line.expected === undefined ? '—' : formatQty(line.expected)}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${Number(change) < 0 ? 'text-red-700' : Number(change) > 0 ? 'text-emerald-700' : ''}`}>
                          {change === null || change === undefined ? '—' : signed(change)}
                        </td>
                      </>
                    ) : (
                      <td className="px-3 py-2 text-right">
                        {editable ? (
                          <Input
                            type="number"
                            step="any"
                            value={line.quantity_change}
                            onChange={(event) => patchLine(line.key, { quantity_change: event.target.value })}
                            className="ml-auto h-7 w-24 text-right text-xs"
                          />
                        ) : (
                          <span className={Number(change) < 0 ? 'text-red-700' : 'text-emerald-700'}>{signed(change)}</span>
                        )}
                      </td>
                    )}

                    <td className="px-3 py-2">
                      {editable ? (
                        <select
                          value={line.reason}
                          onChange={(event) => patchLine(line.key, { reason: event.target.value })}
                          className="h-7 rounded-md border border-gray-300 bg-white px-1 text-xs"
                        >
                          {REASONS.filter((entry) => (isCount ? true : entry.value !== 'count_variance')).map((entry) => (
                            <option key={entry.value} value={entry.value}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        reasonLabel(line.reason)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {Number(change) > 0 ? (
                        editable ? (
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={line.unit_cost}
                            placeholder="Automatic"
                            onChange={(event) => patchLine(line.key, { unit_cost: event.target.value })}
                            className="h-7 w-24 text-xs"
                          />
                        ) : (
                          line.unit_cost || 'Automatic'
                        )
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editable ? (
                        <Input value={line.note} onChange={(event) => patchLine(line.key, { note: event.target.value })} className="h-7 w-40 text-xs" />
                      ) : (
                        line.note || '—'
                      )}
                    </td>
                    {editable && (
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => removeLine(line.key)} className="text-[11px] text-gray-500 hover:text-red-600">
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {lines.length > 0 && (
        <p className="text-xs text-gray-600">
          {countedLines.length} of {lines.length} line{lines.length === 1 ? '' : 's'} {isCount ? 'counted' : 'filled in'}
          {isCount ? '. Lines left uncounted are dropped when you submit, not treated as zero.' : '.'}
          {doc.status !== 'cancelled' && countedLines.length > 0 && ` Net change: ${signed(netChange)}.`}
        </p>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-7 text-xs" onClick={handleSave} disabled={busy || !dirty}>
            {busy ? 'Working...' : 'Save'}
          </Button>
          <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/80" onClick={handleSubmit} disabled={busy || lines.length === 0}>
            {approval?.approval_required_now ? 'Submit for approval' : 'Post to stock'}
          </Button>
          <span className="text-[11px] text-gray-500">
            {approval?.approval_required_now
              ? 'Stock does not change until someone else approves it.'
              : 'Approval is off for this branch, so this changes stock straight away.'}
          </span>
        </div>
      )}
    </div>
  )
}
