'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
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
import { OrderStatusPill, ReturnPill, formatDate, useMoney } from '@/components/modules/sales/quotation-shared'
import { InvoiceStatusPill } from '@/components/modules/sales/invoice-shared'
import { DeliveryStatusPill } from '@/components/modules/sales/delivery-shared'

// A created sales order. It starts Open and its lines are locked. What can still happen here:
// reserve / release stock, cancel (while nothing is delivered or invoiced), print, and
// duplicate a cancelled order into a new draft (the way to change a price).
export default function SalesOrderDetailPage({ orderId }) {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const base = `${salesBase}/orders`

  const [order, setOrder] = useState(null)
  const [reserved, setReserved] = useState({})
  const [deliveries, setDeliveries] = useState([])
  const [invoices, setInvoices] = useState([])
  const [orderMoney, setOrderMoney] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [working, setWorking] = useState(false)
  const [action, setAction] = useState(null) // 'cancel' | 'release'
  const [cancelReason, setCancelReason] = useState('')
  const [keepDelivered, setKeepDelivered] = useState(false)
  const [check, setCheck] = useState(null) // result of order_cancellation_check
  const [checking, setChecking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('sales_orders')
      .select(
        `id, order_number, status, order_date, requested_delivery_date, promised_delivery_date, notes, currency,
         discount_type, discount_value, apply_vat, vat_rate, subtotal, discount_total, vat_total, total,
         reserve_stock, return_status, cancel_reason, cancelled_at, confirmed_at, quotation, duplicated_from,
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
  const runCheck = useCallback(async (keep) => {
    setChecking(true)
    const { data, error } = await supabase.rpc('order_cancellation_check', { p_order: orderId, p_keep_delivered: keep })
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
    setKeepDelivered(false)
    setCancelReason('')
    setCheck(null)
    setAction('cancel')
    runCheck(false)
  }

  const toggleKeep = (value) => {
    setKeepDelivered(value)
    runCheck(value)
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Give a reason for cancelling.')
      return
    }
    const data = await run(
      'cancel_sales_order',
      { p_order: orderId, p_reason: cancelReason, p_keep_delivered: keepDelivered },
      'Order cancelled.',
      'Could not cancel the order.'
    )
    if (!data) {
      runCheck(keepDelivered)
      return
    }
    setAction(null)
    setCancelReason('')
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
  const canCancel = isLive
  const leftToInvoice = lines.some(
    (line) => Number(line.quantity_ordered) - Number(line.quantity_cancelled) - Number(line.quantity_invoiced) > 0
  )
  const canInvoice = ['open', 'partially_fulfilled', 'fulfilled', 'cancelled_partial'].includes(order.status) && leftToInvoice
  const anyDelivered = lines.some((line) => Number(line.quantity_delivered) > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{order.order_number}</h2>
          <OrderStatusPill status={order.status} />
          <ReturnPill status={order.return_status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => window.print()}>Print / PDF</Button>
          {isLive && (
            <Button asChild className="h-8 bg-core text-xs text-white">
              <Link href={`${salesBase}/deliveries/new?order=${orderId}`}>Create delivery</Link>
            </Button>
          )}
          {canInvoice && (
            <Button asChild variant="outline" className="h-8 text-xs">
              <Link href={`${salesBase}/invoices/sales-invoices/new?order=${orderId}`}>Create invoice</Link>
            </Button>
          )}
          {isLive && (
            <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={handleReserve}>Reserve stock</Button>
          )}
          {isLive && anyReserved && (
            <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={() => setAction('release')}>Release reservation</Button>
          )}
          {canCancel && (
            <Button type="button" variant="outline" className="h-8 text-xs text-red-600" disabled={working} onClick={openCancel}>Cancel order</Button>
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
              </tr>
            ))}
          </tbody>
        </table>

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

      <AlertDialog open={action === 'cancel'} onOpenChange={(open) => { if (!open && !working) setAction(null) }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {order.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only the quantity not yet delivered is cancelled, and its reserved stock is released. Anything already delivered stays on record. A cancelled order cannot be reopened.
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

              {anyDelivered && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5" checked={keepDelivered} onChange={(event) => toggleKeep(event.target.checked)} />
                  <span>The customer keeps what was delivered. Cancel only the rest.</span>
                </label>
              )}

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
