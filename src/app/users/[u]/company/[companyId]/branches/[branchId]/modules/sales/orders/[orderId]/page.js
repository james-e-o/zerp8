'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { ReturnPill, formatDate, useMoney } from '@/components/modules/sales/quotation-shared'
import { OrderStatusBadge, OrderTags } from '@/components/modules/sales/order-status-tags'
import { InvoiceStatusPill } from '@/components/modules/sales/invoice-shared'
import { DeliveryStatusPill } from '@/components/modules/sales/delivery-shared'
import { useQuotationCatalog, resolveQuotationPrice } from '@/components/modules/sales/quotation-catalog'

// A created sales order. It starts Open and stays editable (with a reason, kept in the change history):
//  - a line's price is locked while a live pro forma or invoice includes it (cancel that document first);
//  - quantities can change but never below what was delivered / invoiced; lines that were not delivered
//    or invoiced and are on no document can be removed; new lines can be added;
//  - the order cannot be cancelled once a delivery exists;
//  - "Complete order" seals it for good (leftover items that were never supplied are written off).
// Also: reserve / release stock, print, and duplicate a cancelled order into a new draft.
export default function SalesOrderDetailPage({ orderId }) {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const base = `${salesBase}/orders`

  const [order, setOrder] = useState(null)
  const [tags, setTags] = useState(null) // Delivery / Invoicing / Payment tags
  const [reserved, setReserved] = useState({})
  const [deliveries, setDeliveries] = useState([])
  const [invoices, setInvoices] = useState([])
  const [orderMoney, setOrderMoney] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [working, setWorking] = useState(false)
  const [action, setAction] = useState(null) // 'cancel' | 'release'
  const [cancelReason, setCancelReason] = useState('')
  const [check, setCheck] = useState(null) // result of order_cancellation_check
  const [checking, setChecking] = useState(false)
  const [changes, setChanges] = useState([])
  const [locks, setLocks] = useState({}) // order line id -> number of the pro forma / invoice that locks its price
  const [completion, setCompletion] = useState(null) // result of sales_order_completion_check
  const [completeNote, setCompleteNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [editLines, setEditLines] = useState([])
  const [editReason, setEditReason] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('sales_orders')
      .select(
        `id, order_number, status, order_date, requested_delivery_date, promised_delivery_date, notes, currency,
         discount_type, discount_value, apply_vat, vat_rate, subtotal, discount_total, vat_total, total,
         reserve_stock, return_status, cancel_reason, cancelled_at, confirmed_at, completed_at, completion_note, quotation, duplicated_from,
         customer:customers!sales_orders_customer_fkey ( id, name, customer_number, email, phone, address ),
         warehouse:warehouses!sales_orders_warehouse_fkey ( * ),
         sales_order_line_items ( id, description_snapshot, variant_label_snapshot, sku_snapshot, quantity_ordered,
                                  quantity_delivered, quantity_invoiced, quantity_returned, quantity_cancelled, unit_price_snapshot, discount_type, discount_value,
                                  line_total, position )`
      )
      .eq('id', orderId)
      .eq('branch', branchId)
      .maybeSingle()

    if (error || !data) {
      const message = error?.message || 'Order not found.'
      console.error('Failed to load sales order:', error)
      setErrorMessage(message)
      toast.error(message)
      setLoading(false)
      return
    }

    let quotation = null
    if (data.quotation) {
      const { data: q } = await supabase.from('quotations').select('id, quote_number').eq('id', data.quotation).maybeSingle()
      quotation = q
    }
    let source = null
    if (data.duplicated_from) {
      const { data: s } = await supabase.from('sales_orders').select('id, order_number').eq('id', data.duplicated_from).maybeSingle()
      source = s
    }
    setOrder({ ...data, quotationRow: quotation, sourceRow: source })

    const { data: reservations, error: reservationError } = await supabase
      .from('inventory_reservations')
      .select('reference_line, quantity')
      .eq('reason', 'sales_order')
      .eq('reference_id', orderId)
    if (reservationError) {
      console.error('Could not read reservations:', reservationError)
      setReserved({})
    } else {
      const map = {}
      ;(reservations || []).forEach((row) => {
        map[row.reference_line] = (map[row.reference_line] || 0) + Number(row.quantity || 0)
      })
      setReserved(map)
    }

    const { data: deliveryRows, error: deliveryError } = await supabase
      .from('deliveries')
      .select('id, delivery_number, status, planned_date, delivered_at')
      .eq('sales_order', orderId)
      .order('created_at', { ascending: false })
    if (deliveryError) {
      console.error('Could not read deliveries:', deliveryError)
      setDeliveries([])
    } else {
      setDeliveries(deliveryRows || [])
    }

    const { data: invoiceRows, error: invoiceError } = await supabase
      .from('sales_invoices')
      .select('id, invoice_number, status, issued_at, due_date, total, paid')
      .eq('sales_order', orderId)
      .order('created_at', { ascending: false })
    if (invoiceError) {
      console.error('Could not read invoices:', invoiceError)
      setInvoices([])
    } else {
      setInvoices(invoiceRows || [])
    }
    const { data: moneyRow, error: moneyError } = await supabase.rpc('sales_order_money', { p_order: orderId })
    if (moneyError || moneyRow?.success === false) {
      console.error('Could not read order money:', moneyError || moneyRow)
      setOrderMoney(null)
    } else {
      setOrderMoney(moneyRow)
    }
    const { data: lockData, error: lockError } = await supabase.rpc('sales_order_line_locks', { p_order: orderId })
    if (lockError || lockData?.success === false) {
      console.error('Could not read price locks:', lockError || lockData)
      toast.error(lockError?.message || lockData?.error || 'Could not read price locks.')
      setLocks({})
    } else {
      setLocks(lockData?.locks || {})
    }
    const { data: tagRows, error: tagError } = await supabase.rpc('sales_order_status_tags', { p_branch: branchId, p_order: orderId })
    if (tagError) {
      console.error('Could not read the order tags:', tagError)
      toast.error(tagError.message || 'Could not read the order tags.')
      setTags(null)
    } else {
      setTags((tagRows || [])[0] || null)
    }
    const { data: changeRows, error: changeError } = await supabase
      .from('sales_order_changes')
      .select('id, changed_at, reason, before_lines, after_lines')
      .eq('sales_order', orderId)
      .order('changed_at', { ascending: false })
    if (changeError) {
      console.error('Could not read the change history:', changeError)
      toast.error(changeError.message)
      setChanges([])
    } else {
      setChanges(changeRows || [])
    }
    setLoading(false)
  }, [orderId, branchId])

  useEffect(() => {
    if (branchId && orderId) load()
  }, [branchId, orderId, load])

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

  const handleReserve = async () => {
    const data = await run('reserve_sales_order', { p_order: orderId }, null, 'Could not reserve stock.')
    if (!data) return
    if (Number(data.short_lines) > 0) {
      toast.warning(`Reserved what was free. ${data.short_lines} line${Number(data.short_lines) === 1 ? ' is' : 's are'} still short.`)
    } else {
      toast.success('Stock reserved.')
    }
    load()
  }

  // Credit notes for goods the customer was billed for but no longer keeps (returns, or a cancelled order).
  const handleCredit = async () => {
    const data = await run('issue_credit_notes', { p_order: orderId, p_return: null, p_note: null }, 'Credit note issued.', 'Could not issue the credit note.')
    if (data) load()
  }

  const handleRelease = async () => {
    const data = await run('release_sales_order_reservation', { p_order: orderId }, 'Reservation released.', 'Could not release the reservation.')
    setAction(null)
    if (data) load()
  }

  // The dependency check behind the Cancel dialog: what is open, what went out, what is
  // invoiced or paid, and exactly what has to be cleared before the order can be cancelled.
  const runCheck = useCallback(async () => {
    setChecking(true)
    const { data, error } = await supabase.rpc('order_cancellation_check', { p_order: orderId, p_keep_delivered: false })
    setChecking(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not check this order.'
      console.error('order_cancellation_check failed:', error || data)
      toast.error(message)
      setCheck(null)
      return
    }
    setCheck(data)
  }, [orderId])

  const openCancel = () => {
    setCancelReason('')
    setCheck(null)
    setAction('cancel')
    runCheck()
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Give a reason for cancelling.')
      return
    }
    const data = await run(
      'cancel_sales_order',
      { p_order: orderId, p_reason: cancelReason, p_keep_delivered: false },
      'Order cancelled.',
      'Could not cancel the order.'
    )
    if (!data) {
      runCheck()
      return
    }
    setAction(null)
    setCancelReason('')
    load()
  }

  const openComplete = async () => {
    setCompleteNote('')
    setCompletion(null)
    setAction('complete')
    const { data, error } = await supabase.rpc('sales_order_completion_check', { p_order: orderId })
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not check this order.'
      console.error('sales_order_completion_check failed:', error || data)
      toast.error(message)
      setAction(null)
      return
    }
    setCompletion(data)
  }

  const handleComplete = async () => {
    const data = await run('complete_sales_order', { p_order: orderId, p_note: completeNote.trim() || null }, 'Order completed and sealed.', 'Could not complete the order.')
    if (!data) return
    setAction(null)
    load()
  }

  const startEdit = () => {
    setEditReason('')
    setEditLines(
      (order.sales_order_line_items || [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((line) => ({
          id: line.id,
          description: line.description_snapshot,
          detail: [line.variant_label_snapshot, line.sku_snapshot].filter(Boolean).join(' · '),
          quantity: String(Number(line.quantity_ordered)),
          unitPrice: String(Number(line.unit_price_snapshot)),
          priceLock: locks[line.id] || '',
          floor: Math.max(Number(line.quantity_delivered), Number(line.quantity_invoiced)),
          locked: Number(line.quantity_delivered) > 0 || Number(line.quantity_invoiced) > 0 || Number(line.quantity_returned) > 0 || Boolean(locks[line.id]),
        }))
    )
    setEditing(true)
  }

  const updateEditLine = (index, patch) => setEditLines((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))

  const handleSaveEdit = async () => {
    if (editReason.trim().length < 10) {
      toast.error('Give a reason for the change (at least 10 characters).')
      return
    }
    if (editLines.length === 0) {
      toast.error('The order must keep at least one item.')
      return
    }
    for (const row of editLines) {
      const quantity = Number(row.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error(`Enter a quantity above zero for ${row.description}, or remove the line.`)
        return
      }
      if (row.id && quantity < row.floor) {
        toast.error(`${row.description} cannot go below ${row.floor} (already delivered or invoiced).`)
        return
      }
      if (!Number.isFinite(Number(row.unitPrice)) || Number(row.unitPrice) < 0) {
        toast.error(`Enter a price for ${row.description}.`)
        return
      }
    }
    const payload = editLines.map((row) =>
      row.id
        ? { id: row.id, quantity: Number(row.quantity), unit_price: Number(row.unitPrice) }
        : {
            variant: row.variant,
            quantity: Number(row.quantity),
            unit_price: Number(row.unitPrice),
            description_snapshot: row.description,
            variant_label_snapshot: row.variantLabel || '',
            sku_snapshot: row.sku || '',
            pricing_context: row.pricingContext || null,
          }
    )
    const data = await run('edit_confirmed_sales_order', { p_order: orderId, p_reason: editReason.trim(), p_header: {}, p_lines: payload }, 'Order updated.', 'Could not update the order.')
    if (!data) return
    setEditing(false)
    load()
  }

  const handleDuplicate = async () => {
    const data = await run('duplicate_sales_order', { p_order: orderId }, 'Order draft created. Review it and create the order.', 'Could not duplicate the order.')
    if (data) router.push(`${base}/new?draft=${data.draft_id}`)
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading order...</p>
  if (errorMessage || !order) {
    return <p role="alert" className="m-4 border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage || 'Order not found.'}</p>
  }

  const lines = [...(order.sales_order_line_items || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const isLive = ['open', 'partially_fulfilled'].includes(order.status)
  const anyReserved = Object.values(reserved).some((qty) => qty > 0)
  const isCancelledState = ['cancelled', 'cancelled_partial'].includes(order.status)
  const anyDelivery = deliveries.some((entry) => entry.status !== 'cancelled') || lines.some((line) => Number(line.quantity_delivered) > 0)
  const canCancel = isLive && !anyDelivery
  const canEdit = ['open', 'partially_fulfilled', 'fulfilled'].includes(order.status)
  const leftToInvoice = lines.some(
    (line) => Math.max(Number(line.quantity_ordered) - Number(line.quantity_cancelled), Number(line.quantity_delivered)) - Number(line.quantity_invoiced) > 0
  )
  const canInvoice = ['open', 'partially_fulfilled', 'fulfilled', 'cancelled_partial'].includes(order.status) && leftToInvoice

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{order.order_number}</h2>
          <OrderStatusBadge status={order.status} />
          <ReturnPill status={order.return_status} />
          <OrderTags tags={tags} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => window.print()}>Print / PDF</Button>
          {isLive && !editing && (
            <Button asChild className="h-8 bg-core text-xs text-white">
              <Link href={`${salesBase}/deliveries/new?order=${orderId}`}>Create delivery</Link>
            </Button>
          )}
          {canEdit && !editing && (
            <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={startEdit}>Edit order</Button>
          )}
          {canEdit && !editing && (
            <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={openComplete}>Complete order</Button>
          )}
          {canInvoice && !editing && (
            <Button asChild variant="outline" className="h-8 text-xs">
              <Link href={`${salesBase}/invoices/sales-invoices/new?order=${orderId}`}>Create invoice</Link>
            </Button>
          )}
          {canInvoice && ['open', 'partially_fulfilled'].includes(order.status) && !editing && (
            <Button asChild variant="outline" className="h-8 text-xs">
              <Link href={`${salesBase}/invoices/proforma-invoices/new?order=${orderId}`}>Create pro forma</Link>
            </Button>
          )}
          {isLive && !editing && (
            <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={handleReserve}>Reserve stock</Button>
          )}
          {isLive && anyReserved && !editing && (
            <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={() => setAction('release')}>Release reservation</Button>
          )}
          {canCancel && !editing && (
            <Button type="button" variant="outline" className="h-8 text-xs text-red-600" disabled={working} onClick={openCancel}>Cancel order</Button>
          )}
          {isLive && anyDelivery && !editing && (
            <Button type="button" variant="outline" className="h-8 text-xs" disabled title="An order with a delivery cannot be cancelled. Remove undelivered items or process a return.">Cancel order</Button>
          )}
          {order.status === 'fulfilled' && (
            <Button type="button" variant="outline" className="h-8 text-xs" disabled title="Completed orders can't be cancelled. Use a return or credit note.">Cancel order</Button>
          )}
          {order.status === 'cancelled' && (
            <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={handleDuplicate}>
              {working ? 'Working...' : 'Duplicate to new draft'}
            </Button>
          )}
        </div>
      </div>

      {isCancelledState && (
        <p className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700 print:hidden">
          Cancelled on {formatDate(order.cancelled_at)}{order.cancel_reason ? `: ${order.cancel_reason}` : '.'}{' '}
          {order.status === 'cancelled'
            ? 'Duplicate it to make a corrected order.'
            : 'What was delivered stays on record; only the open quantity was cancelled.'}
        </p>
      )}
      {order.status === 'completed' && (
        <p className="rounded-sm border border-emerald-200 bg-emerald-50 p-2 text-emerald-800 print:hidden">
          Completed and sealed{order.completed_at ? ` on ${formatDate(order.completed_at)}` : ''}.{order.completion_note ? ` Note: ${order.completion_note}` : ''}
        </p>
      )}
      {editing && (
        <div className="space-y-2 rounded-sm border border-amber-200 bg-amber-50 p-3 text-amber-900 print:hidden">
          <p className="font-medium">Editing this order</p>
          <p>
            Change quantities, remove items that were not delivered or invoiced, or add items. A price that sits on a pro forma or invoice is locked (cancel that document first).
            Every change is recorded with your reason.
          </p>
          <Textarea value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Reason for the change (at least 10 characters)" className="min-h-16 bg-white text-xs" />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="h-8 bg-white text-xs" disabled={working} onClick={() => setAddOpen(true)}>Add item</Button>
            <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={handleSaveEdit}>{working ? 'Saving...' : 'Save changes'}</Button>
            <Button type="button" variant="outline" className="h-8 bg-white text-xs" disabled={working} onClick={() => setEditing(false)}>Discard</Button>
          </div>
        </div>
      )}
      {order.quotationRow && (
        <p className="rounded-sm border border-border bg-muted/40 p-2 print:hidden">
          Made from quotation <Link href={`${salesBase}/quotations/${order.quotationRow.id}`} className="font-medium text-core">{order.quotationRow.quote_number}</Link>.
        </p>
      )}
      {order.sourceRow && (
        <p className="rounded-sm border border-border bg-muted/40 p-2 print:hidden">
          Duplicated from cancelled order <Link href={`${base}/${order.sourceRow.id}`} className="font-medium text-core">{order.sourceRow.order_number}</Link>.
        </p>
      )}

      <div className="rounded-sm border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base font-bold text-slate-900">Sales order</p>
            <p className="text-muted-foreground">{order.order_number}</p>
          </div>
          <div className="text-right text-muted-foreground">
            <p>Order date: {formatDate(order.order_date)}</p>
            <p>Requested delivery: {formatDate(order.requested_delivery_date)}</p>
            {order.warehouse && <p>Warehouse: {order.warehouse.name || order.warehouse.label || order.warehouse.code}</p>}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Customer</p>
          {order.customer && (
            <div className="mt-1 text-sm">
              <p className="font-semibold text-foreground">{order.customer.name}</p>
              <p className="text-muted-foreground">{order.customer.customer_number}</p>
              {order.customer.address && <p className="text-muted-foreground">{order.customer.address}</p>}
              {(order.customer.phone || order.customer.email) && (
                <p className="text-muted-foreground">{[order.customer.phone, order.customer.email].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          )}
        </div>

        <table className="mt-5 w-full border-collapse text-xs">
          <thead className="bg-muted text-[10px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Ordered</th>
              <th className="px-3 py-2 text-right font-medium print:hidden">Reserved</th>
              <th className="px-3 py-2 text-right font-medium print:hidden">Delivered</th>
              <th className="px-3 py-2 text-right font-medium print:hidden">Returned</th>
              <th className="px-3 py-2 text-right font-medium print:hidden">Cancelled</th>
              <th className="px-3 py-2 text-right font-medium print:hidden">Invoiced</th>
              <th className="px-3 py-2 text-right font-medium">Unit price</th>
              <th className="px-3 py-2 text-right font-medium">Discount</th>
              <th className="px-3 py-2 text-right font-medium">Line total</th>
              <th className="px-3 py-2 text-left font-medium print:hidden">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {editing
              ? editLines.map((row, index) => (
                  <tr key={row.id || `new-${index}`}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{row.description}</p>
                      {row.detail && <p className="text-[10px] text-muted-foreground">{row.detail}</p>}
                      {!row.id && <p className="text-[10px] text-amber-700">New item</p>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" min={row.floor || 0} step="any" value={row.quantity} onChange={(event) => updateEditLine(index, { quantity: event.target.value })} className="ml-auto h-8 w-24 text-right text-xs" />
                      {row.floor > 0 && <p className="mt-0.5 text-[10px] text-muted-foreground">min {row.floor}</p>}
                    </td>
                    <td colSpan={5} className="px-3 py-2 text-right text-[10px] text-muted-foreground print:hidden">
                      {row.locked ? (row.priceLock ? `On ${row.priceLock}: cannot be removed` : 'Delivered or invoiced: cannot be removed') : ''}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" min="0" step="any" value={row.unitPrice} disabled={Boolean(row.priceLock)} onChange={(event) => updateEditLine(index, { unitPrice: event.target.value })} className="ml-auto h-8 w-28 text-right text-xs" />
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                    <td className="px-3 py-2 text-right font-medium">{money(Number(row.quantity || 0) * Number(row.unitPrice || 0))}</td>
                    <td className="px-3 py-2 print:hidden">
                      {row.priceLock ? <span className="text-amber-700">Price locked by {row.priceLock}</span> : <span className="text-muted-foreground">Price editable</span>}
                      {!row.locked && (
                        <Button type="button" variant="outline" className="ml-2 h-7 text-[10px] text-red-600" onClick={() => setEditLines((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>
                      )}
                    </td>
                  </tr>
                ))
              : lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{line.description_snapshot}</p>
                      {(line.variant_label_snapshot || line.sku_snapshot) && (
                        <p className="text-[10px] text-muted-foreground">{[line.variant_label_snapshot, line.sku_snapshot].filter(Boolean).join(' · ')}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{Number(line.quantity_ordered)}</td>
                    <td className="px-3 py-2 text-right print:hidden">{Number(reserved[line.id] || 0) || '—'}</td>
                    <td className="px-3 py-2 text-right print:hidden">{Number(line.quantity_delivered)}</td>
                    <td className="px-3 py-2 text-right print:hidden">{Number(line.quantity_returned) || '—'}</td>
                    <td className="px-3 py-2 text-right print:hidden">{Number(line.quantity_cancelled) || '—'}</td>
                    <td className="px-3 py-2 text-right print:hidden">{Number(line.quantity_invoiced)}</td>
                    <td className="px-3 py-2 text-right">{money(line.unit_price_snapshot)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {Number(line.discount_value) > 0 ? (line.discount_type === 'percentage' ? `${Number(line.discount_value)}%` : money(line.discount_value)) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{money(line.line_total)}</td>
                    <td className="px-3 py-2 print:hidden">
                      {locks[line.id] ? (
                        <Link href={`${salesBase}/invoices`} className="text-amber-700" title="Cancel this document to change the price">Locked by {locks[line.id]}</Link>
                      ) : (
                        <span className="text-muted-foreground">Editable</span>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {editing && <p className="mt-3 text-right text-[10px] text-muted-foreground print:hidden">Order totals are recalculated when you save.</p>}
        <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5">
          <Row label="Subtotal" value={money(order.subtotal)} />
          {Number(order.discount_total) > 0 && <Row label="Discounts" value={`-${money(order.discount_total)}`} />}
          {order.apply_vat && <Row label={`VAT (${Number(order.vat_rate)}%)`} value={`+${money(order.vat_total)}`} />}
          <div className="my-2 border-t border-dashed border-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-xl font-bold text-slate-900">{money(order.total)}</span>
          </div>
        </div>

        {order.notes && (
          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{order.notes}</p>
          </div>
        )}
      </div>

      {deliveries.length > 0 && (
        <div className="rounded-sm border border-border bg-card print:hidden">
          <h3 className="border-b border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground">Deliveries</h3>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {deliveries.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link href={`${salesBase}/deliveries/${entry.id}`} className="font-medium text-foreground hover:text-core">{entry.delivery_number}</Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.delivered_at ? `Delivered ${formatDate(entry.delivered_at)}` : `Planned ${formatDate(entry.planned_date)}`}</td>
                  <td className="px-4 py-2 text-right"><DeliveryStatusPill status={entry.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {orderMoney && (Number(orderMoney.invoiced) > 0 || Number(orderMoney.paid) > 0) && (
        <div className="rounded-sm border border-border bg-card p-3 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
              <div><p className="text-[10px] text-muted-foreground">Invoiced</p><p className="font-medium">{money(orderMoney.invoiced)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Credited</p><p className="font-medium">{money(orderMoney.credited)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Paid</p><p className="font-medium">{money(orderMoney.paid)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Still to pay</p><p className="font-medium">{money(orderMoney.balance_due)}</p></div>
            </div>
            {Number(orderMoney.credit_units_due) > 0 && (
              <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={handleCredit}>Issue credit notes</Button>
            )}
          </div>
          {Number(orderMoney.credit_units_due) > 0 && (
            <p className="mt-2 text-amber-800">The customer was invoiced for {orderMoney.credit_units_due} unit(s) they will not keep. Issue a credit note to correct it.</p>
          )}
          {Number(orderMoney.refund_due) > 0 && (
            <p className="mt-2 text-red-700">The customer has paid {money(orderMoney.refund_due)} more than they owe. Record the refund from the invoice.</p>
          )}
        </div>
      )}

      {invoices.length > 0 && (
        <div className="rounded-sm border border-border bg-card print:hidden">
          <h3 className="border-b border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground">Invoices</h3>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {invoices.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link href={`${salesBase}/invoices/sales-invoices/${entry.id}`} className="font-medium text-foreground hover:text-core">{entry.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.status === 'draft' ? 'Draft' : `Issued ${formatDate(entry.issued_at)}`}</td>
                  <td className="px-4 py-2 text-right">{money(entry.total)}</td>
                  <td className="px-4 py-2 text-right"><InvoiceStatusPill invoice={entry} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {changes.length > 0 && (
        <div className="rounded-sm border border-border bg-card print:hidden">
          <h3 className="border-b border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground">Change history</h3>
          <div className="divide-y divide-border">
            {changes.map((entry) => (
              <div key={entry.id} className="px-4 py-2">
                <p className="text-muted-foreground">{formatDate(entry.changed_at)}</p>
                <p className="font-medium text-foreground">{entry.reason}</p>
                <ul className="ml-4 list-disc text-muted-foreground">
                  {describeChange(entry.before_lines, entry.after_lines, money).map((text, index) => <li key={index}>{text}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={action === 'complete'} onOpenChange={(open) => { if (!open && !working) setAction(null) }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Complete {order.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Completing seals the order for good: nothing can be edited or added, and no more deliveries or invoices can be made. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!completion && <p className="text-muted-foreground">Checking the order...</p>}
          {completion && completion.blockers.length > 0 && (
            <div className="space-y-1 rounded-sm border border-amber-200 bg-amber-50 p-2 text-amber-800">
              <p className="font-medium">Clear these first:</p>
              {completion.blockers.map((blocker) => <p key={blocker.kind}>{blocker.message}</p>)}
            </div>
          )}
          {completion && completion.blockers.length === 0 && (
            <div className="space-y-2">
              {completion.leftovers.length > 0 ? (
                <div className="space-y-1 rounded-sm border border-amber-200 bg-amber-50 p-2 text-amber-800">
                  <p className="font-medium">These items were never delivered, invoiced or paid. They will be written off (cancelled):</p>
                  <ul className="ml-4 list-disc">
                    {completion.leftovers.map((entry) => <li key={entry.line}>{entry.description}: {Number(entry.quantity)}</li>)}
                  </ul>
                  <Textarea value={completeNote} onChange={(event) => setCompleteNote(event.target.value)} placeholder="Reason for closing without them (required)" className="min-h-16 bg-white text-xs" />
                </div>
              ) : (
                <div className="rounded-sm border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">Everything quoted was supplied and paid for. Nothing is left over.</div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Not yet</AlertDialogCancel>
            <AlertDialogAction disabled={working || !completion || completion.blockers.length > 0} onClick={(event) => { event.preventDefault(); handleComplete() }}>
              {working ? 'Completing...' : 'Complete order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {addOpen && (
        <AddItemDialog
          branchId={branchId}
          onClose={() => setAddOpen(false)}
          onAdd={(item) => {
            setEditLines((current) => [...current, item])
            setAddOpen(false)
          }}
        />
      )}

      <AlertDialog open={action === 'cancel'} onOpenChange={(open) => { if (!open && !working) setAction(null) }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {order.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The whole order is cancelled and its reserved stock is released. This is possible only while nothing has been delivered. A cancelled order cannot be reopened.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {checking && !check && <p className="text-muted-foreground">Checking the order...</p>}
          {check && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 rounded-sm border border-border bg-muted/40 p-2">
                <div><p className="text-[10px] text-muted-foreground">Delivered</p><p className="font-medium">{Number(check.delivered)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Returned</p><p className="font-medium">{Number(check.returned)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">To be cancelled</p><p className="font-medium">{Number(check.open_quantity)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Goods kept (owed)</p><p className="font-medium">{money(check.owed)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Invoiced</p><p className="font-medium">{money(check.invoiced)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Paid</p><p className="font-medium">{money(check.paid)}</p></div>
              </div>

              {check.blockers.length > 0 ? (
                <div className="space-y-1 rounded-sm border border-amber-200 bg-amber-50 p-2 text-amber-800">
                  <p className="font-medium">Clear these first:</p>
                  {check.blockers.map((blocker) => (
                    <div key={blocker.kind}>
                      <p>{blocker.message}</p>
                      {blocker.kind === 'open_deliveries' && (
                        <ul className="ml-4 list-disc">
                          {blocker.deliveries.map((entry) => (
                            <li key={entry.id}>
                              <Link href={`${salesBase}/deliveries/${entry.id}`} className="font-medium underline">{entry.number}</Link> ({entry.status})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-sm border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">
                  Nothing is blocking this cancellation.
                  {Number(check.balance_due) > 0 && ` The customer still owes ${money(check.balance_due)} for the goods kept.`}
                </div>
              )}
            </div>
          )}

          <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Reason for cancelling" className="min-h-20 text-xs" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Keep order</AlertDialogCancel>
            <AlertDialogAction disabled={working || checking || !check || check.blockers.length > 0} onClick={(event) => { event.preventDefault(); handleCancel() }}>
              {working ? 'Cancelling...' : 'Cancel order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={action === 'release'} onOpenChange={(open) => { if (!open && !working) setAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release the reserved stock?</AlertDialogTitle>
            <AlertDialogDescription>The goods become free for other orders. You can reserve them again later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); handleRelease() }}>
              {working ? 'Releasing...' : 'Release'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

// Plain-language list of what a saved edit changed.
function describeChange(before, after, money) {
  const out = []
  const was = new Map((before || []).map((row) => [row.id, row]))
  const now = new Map((after || []).map((row) => [row.id, row]))
  ;(after || []).forEach((row) => {
    const old = was.get(row.id)
    if (!old) out.push(`Added ${row.description} (${Number(row.quantity)} at ${money(row.unit_price)})`)
    else {
      if (Number(old.quantity) !== Number(row.quantity)) out.push(`${row.description}: quantity ${Number(old.quantity)} to ${Number(row.quantity)}`)
      if (Number(old.unit_price) !== Number(row.unit_price)) out.push(`${row.description}: price ${money(old.unit_price)} to ${money(row.unit_price)}`)
    }
  })
  ;(before || []).forEach((row) => {
    if (!now.has(row.id)) out.push(`Removed ${row.description}`)
  })
  return out.length ? out : ['No item changes']
}

// Picks a product to add to the order. Loads the catalog only while it is open.
function AddItemDialog({ branchId, onClose, onAdd }) {
  const { defaultContext, catalog, pricingRules, loading, error } = useQuotationCatalog(branchId)
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const variant = catalog.find((entry) => entry.id === variantId)
  const label = variant ? [variant.productTitle, variant.variantLabel].filter(Boolean).join(' - ') : 'Choose a product'

  const choose = (id) => {
    const picked = catalog.find((entry) => entry.id === id)
    setVariantId(id)
    setPickerOpen(false)
    setPrice(String(resolveQuotationPrice(picked, defaultContext?.id, pricingRules, Number(quantity) || 1) ?? 0))
  }

  const submit = () => {
    if (!variant) return toast.error('Choose a product.')
    if (!(Number(quantity) > 0)) return toast.error('Enter a quantity above zero.')
    if (!(Number(price) >= 0) || price === '') return toast.error('Enter a price.')
    onAdd({
      variant: variant.id,
      description: variant.productTitle || 'Item',
      variantLabel: variant.variantLabel || '',
      sku: variant.sku || '',
      detail: [variant.variantLabel, variant.sku].filter(Boolean).join(' · '),
      pricingContext: defaultContext?.id || null,
      quantity: String(Number(quantity)),
      unitPrice: String(Number(price)),
      confirmed: false,
      floor: 0,
      locked: false,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add an item</DialogTitle>
          <DialogDescription>It is saved when you save the order changes.</DialogDescription>
        </DialogHeader>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading products...</p>
        ) : (
          <div className="space-y-3 text-xs">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="h-8 w-full justify-start text-xs font-normal">{label}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search products..." />
                  <CommandList>
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup>
                      {catalog.map((entry) => (
                        <CommandItem key={entry.id} value={`${entry.productTitle} ${entry.variantLabel} ${entry.sku}`} onSelect={() => choose(entry.id)}>
                          {[entry.productTitle, entry.variantLabel].filter(Boolean).join(' - ')}
                          {entry.sku ? <span className="ml-2 text-muted-foreground">{entry.sku}</span> : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[10px] text-muted-foreground">
                Quantity
                <Input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-0.5 h-8 text-xs" />
              </label>
              <label className="block text-[10px] text-muted-foreground">
                Unit price
                <Input type="number" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-0.5 h-8 text-xs" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
              <Button type="button" className="h-8 bg-core text-xs text-white" onClick={submit}>Add to order</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
