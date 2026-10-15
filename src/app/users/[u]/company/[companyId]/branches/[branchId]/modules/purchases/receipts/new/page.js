'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import supabase from '@/config/supabaseClient'
import {
  useReceivablePurchaseOrders,
  useVariantNames,
} from '@/components/modules/purchases/purchase-catalog'

const generateReceiptNumber = () => {
  const date = new Date()
  const stamp = `${String(date.getFullYear()).slice(2)}${String(
    date.getMonth() + 1
  ).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `RCT-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

// Receipts can only be created against an existing Purchase Order — there is
// no path to a blank receipt. Step 1 picks the PO; step 2 receives against
// whatever quantity is still outstanding on each of its lines.
//
// Backend wiring notes:
//   - purchase_receipts is ALWAYS inserted as status='draft' first, same
//     whichever button was clicked - post_purchase_receipt() itself
//     requires a draft row to post (it raises if status isn't 'draft'),
//     so "Post Receipt" means insert-as-draft then immediately call the
//     RPC, not insert-as-posted directly.
//   - purchase_order_line_items.unit_cost_snapshot is the real column
//     name (the original scaffold read line.unit_cost, which doesn't
//     exist - fixed here).
//   - shelf is persisted on purchase_receipt_line_items.shelf (added in
//     purchases-schema-patch-1.sql). It is NOT yet propagated into
//     stock_movements - post_purchase_receipt() doesn't write a shelf
//     column there until that table's actual shape is confirmed.
//   - Quantity received is NO LONGER capped at "outstanding". Entering
//     more than what's left on the line is allowed - a BEFORE INSERT
//     trigger on purchase_receipt_line_items (compute_purchase_receipt_
//     line_discrepancy) automatically splits it into quantity_accepted
//     (posts) and excess_quantity (held, excess_status='pending_
//     approval') the moment the row is inserted. This page doesn't
//     compute that split itself - it just stops blocking the quantity
//     and shows the person what's about to happen.
//   - Save as Draft no longer creates a purchase_receipts row. The form is
//     saved into purchase_receipt_drafts (payload jsonb) - nothing is
//     computed or posted, so a draft left overnight can't go stale (the
//     excess/accepted split is only worked out when the real receipt rows
//     are inserted at post time). Continue a draft with ?draft=<id>.
//     Post Receipt creates the real receipt as before, then removes the
//     draft it came from.
//   - loadWarehouses() used to silently discard any error from
//     resolve_branch_warehouse() - `if (!error && data) {...}` with no
//     else branch at all. That's why the dropdown could get stuck on
//     "Resolving warehouse..." forever with zero signal of why: an RLS
//     block, a thrown exception from the SECURITY DEFINER permission
//     check, a genuinely-missing default warehouse, and a slow network
//     call were all indistinguishable from this component's point of
//     view. Now every failure path sets warehouseError and logs to the
//     console, and the JSX surfaces it under the Select.

export default function NewReceiptPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const searchParams = useSearchParams()
  const draftParam = searchParams.get('draft')
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/receipts`

  // Generated client-side only, after mount - same pattern as
  // generateRequestNumber()/generateOrderNumber() in the other two
  // forms. Calling generateReceiptNumber() directly inside useState's
  // initializer ran it once during SSR and again during client
  // hydration, producing two different Math.random() suffixes and a
  // hydration mismatch (the exact case React's error message names).
  const [receiptNumber, setReceiptNumber] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [shelves, setShelves] = useState([])
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([])
  const [saving, setSaving] = useState(false)
  const [warehouses, setWarehouses] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [warehouseError, setWarehouseError] = useState('')
  const [warehouseLoading, setWarehouseLoading] = useState(true)
  const [draftId, setDraftId] = useState(draftParam || '')
  const [draftLoading, setDraftLoading] = useState(Boolean(draftParam))
  const restoreRef = useRef(null) // saved draft values waiting for the PO's lines to load

  const { orders, loading: ordersLoading } = useReceivablePurchaseOrders(
    branchId
  )

  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const { names: variantNames } = useVariantNames(lines.map((line) => line.variantId))

  useEffect(() => {
    // A draft keeps its receipt number so it doesn't change between saves.
    if (!draftParam) setReceiptNumber(generateReceiptNumber())
  }, [draftParam])

  // Load the draft being continued (if any).
  useEffect(() => {
    if (!draftParam) return undefined
    let cancelled = false

    async function loadDraft() {
      const { data, error } = await supabase
        .from('purchase_receipt_drafts')
        .select('id, payload')
        .eq('id', draftParam)
        .eq('branch', branchId)
        .single()

      if (cancelled) return
      if (error || !data) {
        setSubmitError(error?.message || 'That draft could not be found.')
        setReceiptNumber(generateReceiptNumber())
        setDraftLoading(false)
        return
      }

      const payload = data.payload || {}
      restoreRef.current = payload
      setReceiptNumber(payload.receiptNumber || generateReceiptNumber())
      setNotes(payload.notes || '')
      setSelectedOrderId(payload.selectedOrderId || '')
      setDraftLoading(false)
    }

    loadDraft()
    return () => {
      cancelled = true
    }
  }, [draftParam, branchId])

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser()
      if (cancelled || error || !data?.user) return
      setCurrentUser(data.user)
    }

    loadUser()
    return () => {
      cancelled = true
    }
  }, [])

  // Resolve this branch's warehouse. resolve_branch_warehouse() returns a
  // single uuid (every branch has exactly one default warehouse), so this
  // always collapses to one option - the Select stays for the rare case
  // a branch somehow resolves to none, but there is no real multi-choice
  // happening here.
  useEffect(() => {
    let cancelled = false

    async function loadWarehouses() {
      if (!branchId) {
        setWarehouseLoading(false)
        setWarehouseError('No branch in the page address - cannot resolve a warehouse.')
        return
      }
      setWarehouseLoading(true)
      setWarehouseError('')

      try {
        const { data, error } = await supabase.rpc('resolve_branch_warehouse', {
          p_branch: branchId,
        })
        if (cancelled) return

        // Temporary diagnostics - shows exactly what the database returned.
        console.log('[receipt] resolve_branch_warehouse ->', { branchId, data, error })

        if (error) {
          console.error('Failed to resolve branch warehouse:', error)
          setWarehouseError(error.message || "Could not resolve this branch's warehouse.")
          return
        }

        // Normalise every shape the RPC could return: a bare uuid, an array of
        // uuids, or rows/objects like { id } - and drop empties.
        const raw = Array.isArray(data) ? data : [data]
        const ids = raw
          .map((item) =>
            item && typeof item === 'object'
              ? item.id ?? item.warehouse ?? Object.values(item)[0]
              : item
          )
          .filter(Boolean)

        if (ids.length === 0) {
          setWarehouseError('This branch has no default warehouse yet.')
          return
        }

        // Look up readable names. If the warehouses table blocks this read
        // (RLS), fall back to the raw id and say so instead of failing silently.
        const { data: rows, error: rowsError } = await supabase
          .from('warehouses')
          .select('*')
          .in('id', ids)
        if (cancelled) return

        if (rowsError) {
          console.error('Could not read warehouse details:', rowsError)
          setWarehouseError(
            `Warehouse found, but its details can't be read (${rowsError.message}).`
          )
        }

        const byId = new Map((rows || []).map((row) => [row.id, row]))
        const options = ids.map((id) => {
          const row = byId.get(id)
          return { id, label: row?.name || row?.label || row?.code || id }
        })

        setWarehouses(options)
        if (options.length === 1) setWarehouseId(options[0].id)
      } catch (err) {
        if (cancelled) return
        console.error('Unexpected error resolving warehouse:', err)
        setWarehouseError(err?.message || 'Unexpected error resolving the warehouse.')
      } finally {
        if (!cancelled) setWarehouseLoading(false)
      }
    }

    loadWarehouses()
    return () => {
      cancelled = true
    }
  }, [branchId])

  // Safety net: if exactly one warehouse is available and nothing is selected
  // yet, select it. Keeps the form usable even if the load effect above
  // finished without setting a value.
  useEffect(() => {
    if (!warehouseId && warehouses.length === 1) {
      setWarehouseId(warehouses[0].id)
    }
  }, [warehouses, warehouseId])

  useEffect(() => {
    let cancelled = false

    async function loadShelves() {
      if (!warehouseId) {
        setShelves([])
        return
      }
      const { data, error } = await supabase
        .from('warehouse_shelves')
        .select('id, code, label')
        .eq('warehouse', warehouseId)
        .order('code', { ascending: true })

      if (cancelled) return
      if (error) {
        console.error('Failed to load shelves:', error)
        setShelves([])
        return
      }
      setShelves(data || [])
    }

    loadShelves()
    return () => {
      cancelled = true
    }
  }, [warehouseId])

  // When a PO is picked, seed one receiving row per PO line, defaulted to
  // the full outstanding quantity, editable both down (partial receipt)
  // and up (over-receipt - see the note at the top of this file).
  useEffect(() => {
    if (!selectedOrder) {
      setLines([])
      return
    }

    const seeded = (selectedOrder.purchase_order_line_items || []).map(
      (line) => {
        const outstanding =
          Number(line.quantity_ordered) - Number(line.quantity_received || 0)
        return {
          orderLineId: line.id,
          variantId: line.variant,
          quantityOrdered: line.quantity_ordered,
          quantityAlreadyReceived: line.quantity_received || 0,
          outstanding,
          quantityReceivingNow: outstanding,
          unitCost: line.unit_cost_snapshot,
          shelfId: '',
        }
      }
    )

    // Continuing a draft: put back what was typed for each line. Outstanding
    // is still the live figure, so the over-receipt flag stays accurate.
    const restore = restoreRef.current
    if (restore && restore.selectedOrderId === selectedOrder.id) {
      restoreRef.current = null
      const saved = new Map((restore.lines || []).map((line) => [line.orderLineId, line]))
      setLines(
        seeded.map((line) => {
          const match = saved.get(line.orderLineId)
          return match
            ? {
                ...line,
                quantityReceivingNow: match.quantityReceivingNow,
                shelfId: match.shelfId || '',
              }
            : line
        })
      )
      return
    }

    setLines(seeded)
  }, [selectedOrder])

  const updateLine = (index, patch) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    )
  }

  // Only a negative quantity is actually invalid now - anything over
  // outstanding is allowed and held for approval instead of blocked.
  const hasInvalidQty = lines.some(
    (line) => Number(line.quantityReceivingNow) < 0
  )

  // Save as Draft: the form as typed, into purchase_receipt_drafts. Only a
  // Purchase Order is needed - the rest can be finished later.
  const handleSaveDraft = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (!selectedOrderId) {
      setSubmitError('Select a Purchase Order first.')
      return
    }

    setSaving(true)

    const payload = {
      receiptNumber,
      selectedOrderId,
      warehouseId,
      notes,
      lines: lines.map((line) => ({
        orderLineId: line.orderLineId,
        quantityReceivingNow: line.quantityReceivingNow,
        shelfId: line.shelfId,
      })),
    }
    const title = [receiptNumber, selectedOrder?.order_number].filter(Boolean).join(' · ')

    try {
      if (draftId) {
        const { error } = await supabase
          .from('purchase_receipt_drafts')
          .update({ title, payload })
          .eq('id', draftId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('purchase_receipt_drafts')
          .insert({ company: companyId, branch: branchId, title, payload })
          .select('id')
          .single()
        if (error) throw error
        setDraftId(data.id)
      }
      router.push(base)
    } catch (err) {
      console.error('Error saving receipt draft:', err)
      setSubmitError(err.message || 'Could not save this draft.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (event, submitStatus) => {
    event.preventDefault()
    setSubmitError('')

    if (!selectedOrderId) {
      setSubmitError('A Purchase Order is required to create a Receipt.')
      return
    }
    if (!warehouseId) {
      setSubmitError('A warehouse is required — this is where stock will land.')
      return
    }
    if (hasInvalidQty) {
      setSubmitError('Quantity received cannot be negative.')
      return
    }
    if (!currentUser?.id) {
      setSubmitError('Could not identify the current user - try reloading the page.')
      return
    }

    const receivingLines = lines.filter(
      (line) => Number(line.quantityReceivingNow) > 0
    )
    if (receivingLines.length === 0) {
      setSubmitError('Enter a quantity greater than zero for at least one line.')
      return
    }

    setSaving(true)

    try {
      // Always inserted as 'draft' - post_purchase_receipt() requires that
      // status to post, even when the user clicked "Post Receipt".
      const { data: receipt, error: receiptError } = await supabase
        .from('purchase_receipts')
        .insert({
          branch: branchId,
          purchase_order: selectedOrderId,
          receipt_number: receiptNumber,
          status: 'draft',
          notes: notes || null,
          received_by: currentUser.id,
        })
        .select('id')
        .single()

      if (receiptError) throw receiptError

      // quantity_accepted/excess_quantity/excess_status/discrepancy_type
      // are NOT set here - a database trigger computes all four the
      // moment each row is inserted, by comparing against the order
      // line it claims to fulfil. Sending a raw "quantity" is enough.
      const lineItems = receivingLines.map((line) => ({
        purchase_receipt: receipt.id,
        purchase_order_line_item: line.orderLineId,
        variant: line.variantId,
        quantity: line.quantityReceivingNow,
        unit_cost_snapshot: line.unitCost,
        shelf: line.shelfId || null,
      }))

      const { error: lineItemsError } = await supabase
        .from('purchase_receipt_line_items')
        .insert(lineItems)

      if (lineItemsError) throw lineItemsError

      if (submitStatus === 'posted') {
        const { data: postResult, error: postError } = await supabase.rpc(
          'post_purchase_receipt',
          { p_receipt: receipt.id }
        )

        if (postError) throw postError
        if (!postResult?.success) {
          throw new Error(
            postResult?.error || 'Posting the receipt failed. It was saved as a draft instead.'
          )
        }
      }

      // The receipt exists now - the draft it came from is no longer needed.
      if (draftId) {
        const { error: draftDeleteError } = await supabase
          .from('purchase_receipt_drafts')
          .delete()
          .eq('id', draftId)
        if (draftDeleteError) console.error('Could not remove the receipt draft:', draftDeleteError)
      }

      router.push(base)
    } catch (err) {
      console.error('Error creating purchase receipt:', err)
      setSubmitError(err.message || 'Something went wrong saving this receipt.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900">
            New Receipt
          </h1>
          <p className="text-xs text-gray-500">{receiptNumber}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" className="h-7 text-xs hover:bg-red-300" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={saving || !selectedOrderId || draftLoading}
            className="h-7 text-xs bg-core_light text-black"
            onClick={handleSaveDraft}
          >
            Save as Draft
          </Button>

          <Button
            type="button"
            className="bg-core hover:bg-core/80 h-7 text-white text-xs"
            disabled={saving || !selectedOrderId || draftLoading}
            onClick={(event) => handleSubmit(event, 'posted')}
          >
            {saving ? 'Posting...' : 'Post Receipt'}
          </Button>
        </div>
      </div>

      {submitError && (
        <p className="text-xs text-red-600">{submitError}</p>
      )}

      <form className="flex min-h-0 grow flex-col gap-4 overflow-auto">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-800">
            Purchase Order <span className="text-red-500">*</span>
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
              <SelectTrigger className="mt-1 h-auto w-full text-sm">
                <SelectValue
                  placeholder={
                    ordersLoading
                      ? 'Loading orders...'
                      : orders.length
                      ? 'Select an order to receive against'
                      : 'No orders with outstanding quantity'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.order_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="text-xs font-medium text-gray-800">
            Warehouse <span className="text-red-500">*</span>
            <Select
              value={warehouseId}
              onValueChange={setWarehouseId}
              disabled={
                warehouses.length === 0 ||
                (warehouses.length === 1 && !!warehouseId)
              }
            >
              <SelectTrigger className="mt-1 h-auto w-full text-sm">
                <SelectValue
                  placeholder={
                    warehouseLoading
                      ? 'Resolving warehouse...'
                      : warehouses.length
                      ? 'Select a warehouse'
                      : 'No warehouse available'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {warehouseError && (
              <span className="mt-1 block font-normal text-red-600">{warehouseError}</span>
            )}
          </label>
        </div>

        {selectedOrder && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-800">
              Items to receive
            </h2>
            <p className="mb-2 text-[10px] text-gray-500">
              Entering more than what's outstanding is allowed - the extra is held for approval rather than posted straight to stock.
            </p>

            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Already received</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2 text-right">Receiving now</th>
                    <th className="px-3 py-2 text-left">Shelf (optional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line, index) => {
                    const receiving = Number(line.quantityReceivingNow || 0)
                    const over = receiving - Number(line.outstanding || 0)
                    return (
                      <tr key={line.orderLineId}>
                        <td className="max-w-[220px] px-3 py-2">
                          <p
                            className="text-[10px] leading-[1.15] text-gray-700"
                            title={variantNames[line.variantId]?.display}
                          >
                            {variantNames[line.variantId]?.display || '—'}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {line.quantityOrdered}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {line.quantityAlreadyReceived}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {line.outstanding}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-end gap-1">
                            <Input
                              type="number"
                              min="0"
                              value={line.quantityReceivingNow}
                              onChange={(event) =>
                                updateLine(index, {
                                  quantityReceivingNow: event.target.value,
                                })
                              }
                              className="h-auto w-24 text-right text-sm"
                            />
                            {over > 0 && (
                              <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                +{over} over - needs approval
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={line.shelfId}
                            onValueChange={(value) =>
                              updateLine(index, { shelfId: value })
                            }
                          >
                            <SelectTrigger className="h-auto w-full text-sm">
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              {shelves.map((shelf) => (
                                <SelectItem key={shelf.id} value={shelf.id}>
                                  {shelf.label || shelf.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <label className="text-xs font-medium text-gray-700">
          Notes
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Condition of goods, discrepancies, etc..."
            className="mt-1 min-h-20 bg-white text-xs"
          />
        </label>
      </form>
    </div>
  )
}