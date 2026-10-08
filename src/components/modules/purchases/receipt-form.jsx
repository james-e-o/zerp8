'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
import { useReceivablePurchaseOrders } from './purchase-catalog'

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

export default function ReceiptForm() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
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

  const { orders, loading: ordersLoading } = useReceivablePurchaseOrders(
    branchId
  )

  const selectedOrder = orders.find((order) => order.id === selectedOrderId)

  useEffect(() => {
    setReceiptNumber(generateReceiptNumber())
  }, [])

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
      if (!branchId) return
      const { data, error } = await supabase.rpc('resolve_branch_warehouse', {
        p_branch: branchId,
      })
      if (cancelled) return
      if (!error && data) {
        const list = Array.isArray(data) ? data : [data]
        setWarehouses(list)
        if (list.length === 1) setWarehouseId(list[0])
      }
    }

    loadWarehouses()
    return () => {
      cancelled = true
    }
  }, [branchId])

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

      if (!cancelled && !error) setShelves(data || [])
    }

    loadShelves()
    return () => {
      cancelled = true
    }
  }, [warehouseId])

  // When a PO is picked, seed one receiving row per PO line, defaulted to
  // the full outstanding quantity, editable down (partial receipt allowed).
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

    setLines(seeded)
  }, [selectedOrder])

  const updateLine = (index, patch) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    )
  }

  const hasInvalidQty = lines.some(
    (line) =>
      Number(line.quantityReceivingNow) < 0 ||
      Number(line.quantityReceivingNow) > Number(line.outstanding)
  )

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
      setSubmitError('Quantity received cannot exceed what is still outstanding.')
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
            disabled={saving || !selectedOrderId}
            className="h-7 text-xs bg-core_light text-black"
            onClick={(event) => handleSubmit(event, 'draft')}
          >
            Save as Draft
          </Button>

          <Button
            type="button"
            className="bg-core hover:bg-core/80 h-7 text-white text-xs"
            disabled={saving || !selectedOrderId}
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
              disabled={warehouses.length <= 1}
            >
              <SelectTrigger className="mt-1 h-auto w-full text-sm">
                <SelectValue placeholder="Resolving warehouse..." />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        {selectedOrder && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-800">
              Items to receive
            </h2>

            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Variant</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Already received</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2 text-right">Receiving now</th>
                    <th className="px-3 py-2 text-left">Shelf (optional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line, index) => (
                    <tr key={line.orderLineId}>
                      <td className="px-3 py-2 text-gray-700">
                        {line.variantId}
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
                        <Input
                          type="number"
                          min="0"
                          max={line.outstanding}
                          value={line.quantityReceivingNow}
                          onChange={(event) =>
                            updateLine(index, {
                              quantityReceivingNow: event.target.value,
                            })
                          }
                          className="h-auto w-24 text-right text-sm"
                        />
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
                  ))}
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