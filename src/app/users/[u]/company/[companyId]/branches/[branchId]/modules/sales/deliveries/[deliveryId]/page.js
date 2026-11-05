'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDate } from '@/components/modules/sales/quotation-shared'
import { DeliveryStatusPill, deliveryBasePath } from '@/components/modules/sales/delivery-shared'

// One delivery document, opened from Sales > Deliveries (context "sales") or
// Inventory > Outgoing (context "inventory").
//   Sales:      see it, print it, cancel it before hand-over.
//   Inventory:  Start picking -> choose, per line, the warehouse it comes from, how much, and
//               (batch-tracked items) which batches -> Mark ready -> Confirm hand-over
//               (the only step that moves stock), or cancel.
// Sales never decides where stock comes from. On Start picking the database only SUGGESTS a
// warehouse (where the order's stock is reserved) and soonest-expiry batches; Inventory overrides.
export default function DeliveryDetailPage({ deliveryId, context = 'sales' }) {
  const params = useParams()
  const { u, companyId, branchId } = params
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const outgoingBase = deliveryBasePath(params, 'inventory')

  const [delivery, setDelivery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [working, setWorking] = useState(false)
  const [edits, setEdits] = useState({}) // line id -> { warehouse, qty, alloc: { batchId: qty } }
  const [warehouses, setWarehouses] = useState([])
  const [variantInfo, setVariantInfo] = useState({}) // variant id -> { batchTracked }
  const [batchLevels, setBatchLevels] = useState({}) // `${variant}|${warehouse}` -> [{ batch, number, expiry, onHand }]
  const [dialog, setDialog] = useState(null) // 'handover' | 'cancel'
  const [cancelReason, setCancelReason] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [handoverNote, setHandoverNote] = useState('')
  const [confirmQty, setConfirmQty] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('deliveries')
      .select(
        `id, delivery_number, status, planned_date, ship_to, notes, created_at, picking_started_at, ready_at, delivered_at,
         received_by_name, handover_note, cancelled_at, cancel_reason, sales_order,
         order:sales_orders!deliveries_sales_order_fkey ( id, order_number ),
         customer:customers!deliveries_customer_fkey ( id, name, phone ),
         delivery_lines ( id, variant, warehouse, description_snapshot, variant_label_snapshot, sku_snapshot, quantity, quantity_picked,
                          quantity_delivered, position,
                          delivery_line_batches ( id, quantity, batch_id:batch, batch:inventory_batches ( batch_number, expiry_date ) ),
                          warehouse_row:warehouses ( name ) )`
      )
      .eq('id', deliveryId)
      .eq('branch', branchId)
      .maybeSingle()
    if (error || !data) {
      const message = error?.message || 'Delivery not found.'
      console.error('Failed to load delivery:', error)
      setErrorMessage(message)
      toast.error(message)
      setLoading(false)
      return
    }
    setDelivery(data)
    const nextEdits = {}
    const nextConfirm = {}
    ;(data.delivery_lines || []).forEach((line) => {
      const alloc = {}
      ;(line.delivery_line_batches || []).forEach((entry) => {
        if (entry.batch_id) alloc[entry.batch_id] = String(entry.quantity)
      })
      nextEdits[line.id] = { warehouse: line.warehouse || '', qty: String(line.quantity_picked), alloc }
      nextConfirm[line.id] = String(line.quantity_picked)
    })
    setEdits(nextEdits)
    setConfirmQty(nextConfirm)

    // What Inventory needs to choose from: this branch's warehouses and each item's batches.
    if (['pending', 'picking'].includes(data.status)) {
      const variantIds = [...new Set((data.delivery_lines || []).map((line) => line.variant).filter(Boolean))]
      const [{ data: whData, error: whError }, { data: variantData, error: variantError }] = await Promise.all([
        supabase.from('warehouses').select('id, name, is_default').eq('home_branch', branchId).is('archived_at', null).order('name'),
        variantIds.length
          ? supabase.from('product_variants').select('id, tracking_mode').in('id', variantIds)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (whError || variantError) {
        console.error('Failed to load warehouses or variants:', whError || variantError)
        toast.error((whError || variantError).message)
      }
      setWarehouses(whData || [])
      const info = {}
      ;(variantData || []).forEach((variant) => { info[variant.id] = { batchTracked: variant.tracking_mode === 'batch' } })
      setVariantInfo(info)

      const trackedIds = Object.keys(info).filter((id) => info[id].batchTracked)
      const levels = {}
      if (trackedIds.length) {
        const { data: levelData, error: levelError } = await supabase
          .from('inventory_batch_levels')
          .select('variant, warehouse, quantity_on_hand, batch:inventory_batches ( id, batch_number, expiry_date, is_blocked )')
          .in('variant', trackedIds)
          .gt('quantity_on_hand', 0)
        if (levelError) {
          console.error('Failed to load batches:', levelError)
          toast.error(levelError.message)
        }
        ;(levelData || []).forEach((row) => {
          if (!row.batch || row.batch.is_blocked) return
          const key = `${row.variant}|${row.warehouse}`
          ;(levels[key] ||= []).push({ id: row.batch.id, number: row.batch.batch_number, expiry: row.batch.expiry_date, onHand: Number(row.quantity_on_hand) })
        })
        Object.values(levels).forEach((list) => list.sort((a, b) => String(a.expiry || '9999').localeCompare(String(b.expiry || '9999'))))
      }
      setBatchLevels(levels)
    }
    setLoading(false)
  }, [deliveryId, branchId])

  useEffect(() => {
    if (branchId && deliveryId) load()
  }, [branchId, deliveryId, load])

  const run = async (rpcName, args, successMessage, failMessage) => {
    setWorking(true)
    const { data, error } = await supabase.rpc(rpcName, args)
    setWorking(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || failMessage
      console.error(`${rpcName} failed:`, error || data)
      toast.error(message)
      return null
    }
    if (successMessage) toast.success(successMessage)
    return data
  }

  const startPicking = async () => {
    if (await run('start_delivery_picking', { p_delivery: deliveryId }, 'Picking started. Check the warehouse and batches suggested for each line.', 'Could not start picking.')) load()
  }

  const patchEdit = (lineId, patch) => setEdits((current) => ({ ...current, [lineId]: { ...current[lineId], ...patch } }))

  const changeWarehouse = (line, warehouseId) => patchEdit(line.id, { warehouse: warehouseId, alloc: {} })

  const savePick = async (line) => {
    const edit = edits[line.id] || {}
    const quantity = Number(edit.qty)
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > Number(line.quantity)) {
      toast.error(`Picked quantity must be between 0 and ${Number(line.quantity)}.`)
      return
    }
    if (quantity > 0 && !edit.warehouse) {
      toast.error('Choose the warehouse this item is picked from.')
      return
    }
    const batchTracked = variantInfo[line.variant]?.batchTracked
    const allocations = batchTracked
      ? Object.entries(edit.alloc || {})
          .map(([batch, value]) => ({ batch, quantity: Number(value) }))
          .filter((entry) => entry.quantity > 0)
      : []
    if (batchTracked && allocations.length > 0) {
      const total = allocations.reduce((sum, entry) => sum + entry.quantity, 0)
      if (total !== quantity) {
        toast.error(`The batches add up to ${total}, but ${quantity} is being picked.`)
        return
      }
    }
    const data = await run(
      'set_delivery_line_pick',
      { p_line: line.id, p_quantity: quantity, p_warehouse: edit.warehouse || null, p_allocations: allocations.length ? allocations : null },
      null,
      'Could not save this pick.'
    )
    if (data) toast.success(`Pick saved for ${line.description_snapshot}.`)
    load()
  }

  const markReady = async () => {
    if (await run('mark_delivery_ready', { p_delivery: deliveryId }, 'Marked ready for hand-over.', 'Could not mark this delivery ready.')) load()
  }

  const confirmHandover = async () => {
    const lines = (delivery.delivery_lines || []).map((line) => ({ line: line.id, quantity: Number(confirmQty[line.id] || 0) }))
    const data = await run(
      'confirm_delivery_handover',
      { p_delivery: deliveryId, p_lines: lines, p_received_by: receivedBy, p_note: handoverNote },
      null,
      'Could not confirm the hand-over.'
    )
    if (!data) return
    toast.success(`Handed over. ${data.delivered_quantity} unit${Number(data.delivered_quantity) === 1 ? '' : 's'} left stock.`)
    setDialog(null)
    load()
  }

  const cancelDelivery = async () => {
    if (!cancelReason.trim()) {
      toast.error('Give a reason for cancelling.')
      return
    }
    const data = await run('cancel_delivery', { p_delivery: deliveryId, p_reason: cancelReason }, 'Delivery cancelled.', 'Could not cancel the delivery.')
    if (!data) return
    setDialog(null)
    setCancelReason('')
    load()
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading delivery...</p>
  if (errorMessage || !delivery) {
    return <p role="alert" className="m-4 border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage || 'Delivery not found.'}</p>
  }

  const lines = [...(delivery.delivery_lines || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const isInventory = context === 'inventory'
  const status = delivery.status
  const canCancel = ['pending', 'picking', 'ready'].includes(status)
  const showPicked = status !== 'pending' && status !== 'cancelled'
  const nothingPicked = lines.every((line) => Number(line.quantity_picked) === 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{delivery.delivery_number}</h2>
          <DeliveryStatusPill status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => window.print()}>Print delivery note</Button>
          {isInventory && status === 'pending' && (
            <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={startPicking}>{working ? 'Starting...' : 'Start picking'}</Button>
          )}
          {isInventory && status === 'picking' && (
            <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working || nothingPicked} onClick={markReady}>Mark ready</Button>
          )}
          {isInventory && status === 'ready' && (
            <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={() => setDialog('handover')}>Confirm hand-over</Button>
          )}
          {canCancel && (
            <Button type="button" variant="outline" className="h-8 text-xs text-red-600" disabled={working} onClick={() => setDialog('cancel')}>Cancel delivery</Button>
          )}
        </div>
      </div>

      {!isInventory && ['pending', 'picking', 'ready'].includes(status) && (
        <p className="rounded-sm border border-border bg-muted/40 p-2 print:hidden">
          Inventory picks and hands over this delivery in{' '}
          <Link href={`${outgoingBase}/${delivery.id}`} className="font-medium text-core">Outgoing</Link>. Stock leaves only when the hand-over is confirmed.
        </p>
      )}
      {status === 'cancelled' && (
        <p className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700 print:hidden">
          Cancelled on {formatDate(delivery.cancelled_at)}{delivery.cancel_reason ? `: ${delivery.cancel_reason}` : '.'}
        </p>
      )}

      <div className="rounded-sm border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base font-bold text-slate-900">Delivery note</p>
            <p className="text-muted-foreground">{delivery.delivery_number}</p>
            {delivery.order && (
              <p className="text-muted-foreground">
                Order{' '}
                <Link href={`${salesBase}/orders/${delivery.order.id}`} className="font-medium text-core print:text-foreground">{delivery.order.order_number}</Link>
              </p>
            )}
          </div>
          <div className="text-right text-muted-foreground">
            <p>Planned: {formatDate(delivery.planned_date)}</p>
            {delivery.delivered_at && <p>Delivered: {formatDate(delivery.delivered_at)}</p>}
            {delivery.received_by_name && <p>Received by: {delivery.received_by_name}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Customer</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{delivery.customer?.name || '—'}</p>
            {delivery.customer?.phone && <p className="text-muted-foreground">{delivery.customer.phone}</p>}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Deliver to</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{delivery.ship_to || '—'}</p>
          </div>
        </div>

        <table className="mt-5 w-full border-collapse text-xs">
          <thead className="bg-muted text-[10px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Quantity</th>
              {showPicked && <th className="px-3 py-2 text-left font-medium">Warehouse</th>}
              {showPicked && <th className="px-3 py-2 text-right font-medium print:hidden">Picked</th>}
              {status === 'delivered' && <th className="px-3 py-2 text-right font-medium">Delivered</th>}
              {showPicked && <th className="px-3 py-2 text-left font-medium">Batches</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground">{line.description_snapshot}</p>
                  {(line.variant_label_snapshot || line.sku_snapshot) && (
                    <p className="text-[10px] text-muted-foreground">{[line.variant_label_snapshot, line.sku_snapshot].filter(Boolean).join(' · ')}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{Number(line.quantity)}</td>
                {showPicked && (
                  <td className="px-3 py-2 align-top">
                    {isInventory && status === 'picking' ? (
                      <select
                        value={edits[line.id]?.warehouse || ''}
                        onChange={(event) => changeWarehouse(line, event.target.value)}
                        className="h-7 w-full min-w-32 rounded-sm border border-border bg-background px-1 text-xs"
                      >
                        <option value="">Choose warehouse</option>
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                        ))}
                      </select>
                    ) : (
                      line.warehouse_row?.name || '—'
                    )}
                  </td>
                )}
                {showPicked && (
                  <td className="px-3 py-2 text-right align-top print:hidden">
                    {isInventory && status === 'picking' ? (
                      <div className="flex flex-col items-end gap-1">
                        <Input
                          type="number"
                          min="0"
                          max={line.quantity}
                          value={edits[line.id]?.qty ?? ''}
                          onChange={(event) => patchEdit(line.id, { qty: event.target.value })}
                          className="h-7 w-20 text-right text-xs"
                        />
                        <Button type="button" variant="outline" className="h-6 px-2 text-[10px]" disabled={working} onClick={() => savePick(line)}>Save pick</Button>
                      </div>
                    ) : (
                      Number(line.quantity_picked)
                    )}
                  </td>
                )}
                {status === 'delivered' && <td className="px-3 py-2 text-right font-medium">{Number(line.quantity_delivered)}</td>}
                {showPicked && (
                  <td className="px-3 py-2 align-top text-[10px] text-muted-foreground">
                    {isInventory && status === 'picking' && variantInfo[line.variant]?.batchTracked ? (
                      <BatchPicker
                        options={batchLevels[`${line.variant}|${edits[line.id]?.warehouse}`] || []}
                        alloc={edits[line.id]?.alloc || {}}
                        hasWarehouse={Boolean(edits[line.id]?.warehouse)}
                        onChange={(alloc) => patchEdit(line.id, { alloc })}
                      />
                    ) : (line.delivery_line_batches || []).length === 0
                      ? '—'
                      : line.delivery_line_batches.map((entry) => (
                          <p key={entry.id}>
                            {entry.batch?.batch_number} × {Number(entry.quantity)}
                            {entry.batch?.expiry_date ? ` (exp ${formatDate(entry.batch.expiry_date)})` : ''}
                          </p>
                        ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {(delivery.notes || delivery.handover_note) && (
          <div className="mt-5 space-y-2">
            {delivery.notes && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{delivery.notes}</p>
              </div>
            )}
            {delivery.handover_note && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Hand-over note</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{delivery.handover_note}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={dialog === 'handover'} onOpenChange={(open) => { if (!open && !working) setDialog(null) }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm hand-over</AlertDialogTitle>
            <AlertDialogDescription>
              Stock leaves the warehouse now. If less than was picked is going out, lower the quantity; the rest stays on the order and stays reserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">{line.description_snapshot} <span className="text-muted-foreground">(picked {Number(line.quantity_picked)})</span></span>
                <Input
                  type="number"
                  min="0"
                  max={line.quantity_picked}
                  value={confirmQty[line.id] ?? ''}
                  onChange={(event) => setConfirmQty((current) => ({ ...current, [line.id]: event.target.value }))}
                  className="h-7 w-20 text-right text-xs"
                />
              </div>
            ))}
            <Input value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)} placeholder="Received by (name)" className="h-8 text-xs" />
            <Textarea value={handoverNote} onChange={(event) => setHandoverNote(event.target.value)} placeholder="Note (optional)" className="min-h-14 text-xs" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Back</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); confirmHandover() }}>
              {working ? 'Confirming...' : 'Confirm hand-over'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === 'cancel'} onOpenChange={(open) => { if (!open && !working) setDialog(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {delivery.delivery_number}?</AlertDialogTitle>
            <AlertDialogDescription>Nothing has left stock, so nothing is reversed. The quantities go back to the order to be delivered another time.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Reason for cancelling" className="min-h-20 text-xs" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Keep delivery</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); cancelDelivery() }}>
              {working ? 'Cancelling...' : 'Cancel delivery'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Batch choice for one batch-tracked line: the batches with stock in the chosen warehouse,
// soonest expiry first. Leave every box empty to let the system take soonest expiry.
function BatchPicker({ options, alloc, hasWarehouse, onChange }) {
  if (!hasWarehouse) return <p>Choose a warehouse to see its batches.</p>
  if (options.length === 0) return <p>No batch stock in this warehouse.</p>
  return (
    <div className="space-y-1">
      {options.map((option) => (
        <div key={option.id} className="flex items-center justify-between gap-2">
          <span className="min-w-0">
            {option.number}
            {option.expiry ? ` (exp ${formatDate(option.expiry)})` : ''} · {option.onHand} in stock
          </span>
          <Input
            type="number"
            min="0"
            max={option.onHand}
            placeholder="0"
            value={alloc[option.id] ?? ''}
            onChange={(event) => onChange({ ...alloc, [option.id]: event.target.value })}
            className="h-6 w-16 text-right text-xs"
          />
        </div>
      ))}
      <p>Leave empty for soonest expiry first.</p>
    </div>
  )
}
