'use client'

import { useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Printer, FileDown, Send } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import supabase from '@/config/supabaseClient'
import { formatCurrency } from '@/components/modules/purchases/dummy-data'
import { OrderStatusBadge } from '@/components/modules/purchases/purchase-orders-list-page'

// Cancelling/editing is offered from 'open' - the order has been
// created internally but nothing downstream (receiving) has started
// yet. 'sent' (the order actually transmitted/exported to the
// supplier, set from this page's own Send/Export flow) is kept
// editable too for now, since nothing about receiving has started
// either - revisit if sent orders should lock tighter than open ones
// once that flow exists. Partially/fully received orders stay locked
// - those need a real receiving workflow to define what "cancel" or
// "edit" even means, which doesn't exist yet. Gated on the same
// 'create' permission as raising the order in the first place (no
// separate 'cancel' permission key - reusing create was the explicit
// decision made for this app).
const CANCEL_ELIGIBLE_STATUSES = ['open', 'sent']
const EDITABLE_STATUSES = ['open', 'sent']

export default function PurchaseOrderDetailPage() {
  const { u, companyId, branchId, orderId } = useParams()
  const router = useRouter()
  const { currentBranch } = useContext(BranchContext) || {}
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders`

  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [sourceRequest, setSourceRequest] = useState(null)
  const [mergedSources, setMergedSources] = useState([])
  const [quarantineTotal, setQuarantineTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [canCancel, setCanCancel] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelReason, setCancelReason] = useState('')

  // Print/Export sheet - just two actions, no state to persist beyond
  // which one is picked.
  const [printSheetOpen, setPrintSheetOpen] = useState(false)

  // Send sheet - UI only for now (confirmed with the user): there's no
  // email-sending backend yet, so "sending" means opening the user's
  // own email client via a mailto: link with the supplier's address
  // pre-filled. Actual attachment of the exported PDF has to be done
  // by hand in their mail client - mailto: can't attach files. Marking
  // the order's status as 'sent' only happens on the first send, from
  // 'open' - resending later (status already 'sent' or beyond) just
  // reopens the mail client without touching status again.
  const [sendSheetOpen, setSendSheetOpen] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sendAltEmail, setSendAltEmail] = useState('')
  const [isMarkingSent, setIsMarkingSent] = useState(false)
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadOrder() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const { data: orderRow, error: orderError } = await supabase
          .from('purchase_orders')
          .select(
            'id, title, order_number, status, notes, expected_delivery_date, created_at, branch, supplier:suppliers(name, email), purchase_request'
          )
          .eq('id', orderId)
          .eq('branch', branchId)
          .maybeSingle()

        if (orderError) throw orderError
        if (!orderRow) throw new Error('Purchase order not found.')

        const { data: lineRows, error: lineError } = await supabase
          .from('purchase_order_line_items')
          .select('id, variant, quantity_ordered, quantity_received, quantity_returned, unit_cost_snapshot, line_total')
          .eq('purchase_order', orderId)

        if (lineError) throw lineError

        // Goods that arrived for these lines but are still in quarantine
        // (awaiting review or marked damaged). They do not count as
        // received until someone accepts them.
        const quarantineByLine = new Map()
        const lineIds = (lineRows || []).map((row) => row.id)
        if (lineIds.length > 0) {
          const { data: holdRows } = await supabase
            .from('purchase_receipt_holds')
            .select('purchase_order_line_item, quantity')
            .in('purchase_order_line_item', lineIds)
            .in('status', ['awaiting_review', 'damaged'])
          ;(holdRows || []).forEach((hold) => {
            quarantineByLine.set(
              hold.purchase_order_line_item,
              (quarantineByLine.get(hold.purchase_order_line_item) || 0) + Number(hold.quantity || 0)
            )
          })
        }

        const variantIds = [...new Set((lineRows || []).map((row) => row.variant).filter(Boolean))]
        let variants = []
        let products = []

        if (variantIds.length > 0) {
          const { data: variantRows, error: variantError } = await supabase
            .from('product_variants')
            .select('id, product, variant_label, sku')
            .in('id', variantIds)

          if (variantError) throw variantError
          variants = variantRows || []

          const productIds = [...new Set(variants.map((variant) => variant.product).filter(Boolean))]
          if (productIds.length > 0) {
            const { data: productRows, error: productError } = await supabase
              .from('products')
              .select('id, title')
              .in('id', productIds)

            if (productError) throw productError
            products = productRows || []
          }
        }

        // A single-request conversion links purchase_request directly
        // (the real column name on purchase_orders - confirmed against
        // the live schema); a merged order instead has rows in
        // purchase_order_source_requests. The two are mutually
        // exclusive (see the New Purchase Order page), so only one of
        // these ever comes back non-empty.
        let sourceRequestRow = null
        let mergedRows = []

        if (orderRow.purchase_request) {
          const { data } = await supabase
            .from('purchase_requests')
            .select('id, request_number')
            .eq('id', orderRow.purchase_request)
            .maybeSingle()
          sourceRequestRow = data || null
        } else {
          const { data } = await supabase
            .from('purchase_order_source_requests')
            .select('purchase_request:purchase_requests(id, request_number)')
            .eq('purchase_order', orderId)
          mergedRows = (data || []).map((row) => row.purchase_request).filter(Boolean)
        }

        if (cancelled) return

        const variantsById = new Map(variants.map((variant) => [variant.id, variant]))
        const productsById = new Map(products.map((product) => [product.id, product]))

        setOrder(orderRow)
        setItems((lineRows || []).map((row) => {
          const variant = variantsById.get(row.variant)
          const product = variant ? productsById.get(variant.product) : null
          return {
            ...row,
            productTitle: product?.title || 'Product unavailable',
            variantLabel: variant?.variant_label || 'Default variant',
            sku: variant?.sku || '',
            inQuarantine: quarantineByLine.get(row.id) || 0,
          }
        }))
        setQuarantineTotal([...quarantineByLine.values()].reduce((sum, qty) => sum + qty, 0))
        setSourceRequest(sourceRequestRow)
        setMergedSources(mergedRows)
      } catch (loadError) {
        console.error('Failed to load purchase order:', loadError)
        if (!cancelled) setErrorMessage(loadError.message || 'Could not load this purchase order.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (orderId && branchId) loadOrder()

    return () => {
      cancelled = true
    }
  }, [orderId, branchId])

  // Cancelling reuses the same permission as raising an order in the
  // first place - a UI-level check only; cancel_purchase_order() itself
  // is the real enforcement, so a stale/bypassed client check still
  // can't cancel an order this person isn't authorized to touch.
  useEffect(() => {
    let cancelled = false

    async function checkPermissions() {
      if (!branchId) return
      const { data, error } = await supabase.rpc('can_access_purchase_order_resource', {
        p_branch: branchId,
        p_verb: 'create',
      })
      if (!cancelled) setCanCancel(!error && data === true)
    }

    checkPermissions()
    return () => {
      cancelled = true
    }
  }, [branchId])

  // Pre-fill the Send sheet's email from the supplier's record, but
  // only once and only if the person hasn't already typed something
  // of their own in there.
  useEffect(() => {
    if (order?.supplier?.email) {
      setSendEmail((current) => current || order.supplier.email)
    }
  }, [order])

  const canTransitionToSent = order?.status === 'open'

  const buildMailtoHref = () => {
    const recipients = [sendEmail, sendAltEmail].filter(Boolean).join(',')
    const subject = encodeURIComponent(`Purchase order ${order.order_number}`)
    const body = encodeURIComponent(
      `Hi,\n\nPlease find attached Purchase Order ${order.order_number}` +
        `${order.title && order.title !== order.order_number ? ` (${order.title})` : ''}.\n\n` +
        `Note: export the PDF from the Print sheet first and attach it here - it isn't attached automatically.\n\nThanks.`
    )
    return `mailto:${recipients}?subject=${subject}&body=${body}`
  }

  const handleConfirmSent = async () => {
    if (!order || !canTransitionToSent) return
    setSendError('')
    setIsMarkingSent(true)

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'sent' })
        .eq('id', order.id)
        .eq('branch', branchId)

      if (error) throw error
      setOrder((current) => (current ? { ...current, status: 'sent' } : current))
    } catch (err) {
      console.error('Failed to mark purchase order as sent:', err)
      setSendError(err.message || 'Could not mark this order as sent.')
    } finally {
      setIsMarkingSent(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Builds a standalone PDF from the order's own data (not a snapshot
  // of the page's HTML), so it looks the same regardless of screen
  // size or theme.
  const handleExportPdf = () => {
    if (!order) return
    const currency = currentBranch?.base_currency || ''
    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text('Purchase Order', 14, 18)

    doc.setFontSize(10)
    doc.text(order.title || order.order_number || '', 14, 27)
    doc.text(`PO #: ${order.order_number || '—'}`, 14, 33)
    doc.text(`Date: ${order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}`, 14, 39)
    doc.text(`Supplier: ${order.supplier?.name || '—'}`, 14, 45)
    doc.text(
      `Expected delivery: ${order.expected_delivery_date ? new Date(`${order.expected_delivery_date}T00:00:00`).toLocaleDateString() : '—'}`,
      14,
      51
    )

    autoTable(doc, {
      startY: 59,
      head: [['Product', 'SKU', 'Qty', 'Unit cost', 'Line total']],
      body: items.map((item) => [
        item.variantLabel !== 'Default variant' ? `${item.productTitle} · ${item.variantLabel}` : item.productTitle,
        item.sku || '—',
        Number(item.quantity_ordered || 0).toLocaleString(),
        formatCurrency(item.unit_cost_snapshot, currency),
        formatCurrency(item.line_total, currency),
      ]),
      foot: [['', '', '', 'Total', formatCurrency(total, currency)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    })

    if (order.notes) {
      const finalY = doc.lastAutoTable?.finalY || 59
      doc.setFontSize(9)
      doc.text('Notes:', 14, finalY + 10)
      doc.text(doc.splitTextToSize(order.notes, 180), 14, finalY + 16)
    }

    doc.save(`${order.order_number || 'purchase-order'}.pdf`)
    setPrintSheetOpen(false)
  }

  const handleCancelOrder = async () => {
    if (!order) return
    setCancelError('')
    setIsCancelling(true)

    try {
      const { error } = await supabase.rpc('cancel_purchase_order', {
        p_order_id: order.id,
        p_reason: cancelReason.trim() || null,
      })

      if (error) throw error
      router.push(base)
    } catch (err) {
      console.error('Failed to cancel purchase order:', err)
      setCancelError(err.message || 'Could not cancel this order.')
      setIsCancelling(false)
    }
  }

  const total = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0)

  if (isLoading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading purchase order...</p>
  }

  if (errorMessage || !order) {
    return (
      <div className="space-y-4 p-4">
        <Link href={base}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back to orders
          </Button>
        </Link>
        <div role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMessage || 'Purchase order not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={base} className="print:hidden">
            <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
              <ArrowLeft className="mr-1.5 size-3.5" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              {order.title || order.order_number || `Order ${order.id}`}
            </h1>
            {order.title && (
              <p className="text-[10px] text-muted-foreground">{order.order_number}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <OrderStatusBadge status={order.status} />
          {quarantineTotal > 0 && (
            <span className="rounded-sm bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              {quarantineTotal.toLocaleString()} in quarantine
            </span>
          )}
       
          {EDITABLE_STATUSES.includes(order.status) && (
            <Link href={`${base}/${order.id}/edit`}>
              <Button type="button" variant="outline" size="sm" className="h-7 bg-core_light rounded-sm text-xs">
                <Pencil className="mr-1.5 size-3" /> Edit
              </Button>
            </Link>
          )}
          {canCancel && CANCEL_ELIGIBLE_STATUSES.includes(order.status) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-sm text-xs border-red-200 text-red-700 hover:bg-red-50"
              disabled={isCancelling}
              onClick={() => setShowCancelConfirm((shown) => !shown)}
            >
              Cancel order
            </Button>
          )}
        </div>
      </div>

      {showCancelConfirm && (
        <div className="border border-red-200 bg-red-50/60 rounded-sm p-3 space-y-2 print:hidden">
          <p className="text-[10px] font-medium text-red-800">
            Cancel this purchase order? It will be removed from the active list and archived - this can't be undone from here.
          </p>
          <label className="block text-[10px] font-medium text-red-800">
            Reason (optional)
            <Textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="e.g. Supplier could not fulfill, duplicate order, no longer needed..."
              className="mt-1 min-h-16 bg-white text-xs"
            />
          </label>
          {cancelError && (
            <p role="alert" className="text-xs text-red-600">{cancelError}</p>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 bg-red-600 rounded-sm text-xs text-white hover:bg-red-700"
              disabled={isCancelling}
              onClick={handleCancelOrder}
            >
              {isCancelling ? 'Cancelling...' : 'Confirm cancellation'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-sm text-xs"
              disabled={isCancelling}
              onClick={() => {
                setShowCancelConfirm(false)
                setCancelError('')
                setCancelReason('')
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <section className="border border-border rounded-sm bg-card">
        <div className='border-b border-border bg-muted px-4 py-3 text-xs font-semibold text-foreground flex items-center justify-between'>
          <h2 className="">
            Order details
          </h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-sm text-xs"
              onClick={() => setPrintSheetOpen(true)}
            >
              <Printer className="mr-1.5 size-3" /> Print
            </Button>
            {order.status !== 'cancelled' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-sm text-xs"
                onClick={() => setSendSheetOpen(true)}
              >
                <Send className="mr-1.5 size-3" /> Send
              </Button>
            )}
          </div>

        </div>
        <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[10px] text-muted-foreground">Supplier</dt>
            <dd className="mt-1 font-medium text-foreground">{order.supplier?.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Expected delivery</dt>
            <dd className="mt-1 font-medium text-foreground">
              {order.expected_delivery_date ? new Date(`${order.expected_delivery_date}T00:00:00`).toLocaleDateString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Created</dt>
            <dd className="mt-1 font-medium text-foreground">
              {order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Branch currency</dt>
            <dd className="mt-1 font-medium text-foreground">{currentBranch?.base_currency || '—'}</dd>
          </div>
          {sourceRequest && (
            <div>
              <dt className="text-[10px] text-muted-foreground">Converted from</dt>
              <dd className="mt-1 font-medium text-foreground">
                <Link
                  href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/requests/${sourceRequest.id}`}
                  className="text-core hover:underline"
                >
                  {sourceRequest.title || sourceRequest.request_number}
                </Link>
              </dd>
            </div>
          )}
          {mergedSources.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-[10px] text-muted-foreground">Merged from</dt>
              <dd className="mt-1 flex flex-wrap gap-x-2 gap-y-1 font-medium text-foreground">
                {mergedSources.map((request, index) => (
                  <span key={request.id}>
                    <Link
                      href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/requests/${request.id}`}
                      className="text-core hover:underline"
                    >
                      {request.title || request.request_number}
                    </Link>
                    {index < mergedSources.length - 1 ? ',' : ''}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
        {order.notes && (
          <div className="border-t border-border px-4 py-3">
            <p className="text-[10px] text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{order.notes}</p>
          </div>
        )}
      </section>

      <section className="overflow-hidden border border-border rounded-sm bg-card">
        <h2 className="border-b border-border bg-muted px-4 py-3 text-xs font-semibold text-foreground">
          Order items
        </h2>
        {items.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">This order has no line items.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-muted/50 text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Product</th>
                  <th className="px-4 py-2 text-left font-medium">SKU</th>
                  <th className="px-4 py-2 text-right font-medium">Ordered</th>
                  <th className="px-4 py-2 text-right font-medium">Received</th>
                  <th className="px-4 py-2 text-right font-medium">In quarantine</th>
                  <th className="px-4 py-2 text-right font-medium">Returned</th>
                  <th className="px-4 py-2 text-right font-medium">Unit cost</th>
                  <th className="px-4 py-2 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-medium text-foreground">
                      {item.productTitle}
                      {item.variantLabel !== 'Default variant' && (
                        <span className="ml-1 text-muted-foreground">· {item.variantLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{item.sku || '—'}</td>
                    <td className="px-4 py-2 text-right text-foreground">{Number(item.quantity_ordered || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-foreground">{Number(item.quantity_received || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {item.inQuarantine > 0 ? (
                        <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          {item.inQuarantine.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-foreground">{Number(item.quantity_returned || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {formatCurrency(item.unit_cost_snapshot, currentBranch?.base_currency || '')}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-foreground">
                      {formatCurrency(item.line_total, currentBranch?.base_currency || '')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-muted/30">
                <tr>
                  <th colSpan={7} className="px-4 py-3 text-right text-xs font-semibold text-foreground">Total</th>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-foreground">
                    {formatCurrency(total, currentBranch?.base_currency || '')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <Sheet open={printSheetOpen} onOpenChange={setPrintSheetOpen}>
        <SheetContent side="right" className="text-xs">
          <SheetHeader>
            <SheetTitle>Print or export</SheetTitle>
            <SheetDescription>
              Print this order directly, or download it as a PDF to send or file.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 px-4">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-start rounded-sm text-xs"
              onClick={handlePrint}
            >
              <Printer className="mr-2 size-3.5" /> Print
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-start rounded-sm text-xs"
              onClick={handleExportPdf}
            >
              <FileDown className="mr-2 size-3.5" /> Export as PDF
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sendSheetOpen} onOpenChange={setSendSheetOpen}>
        <SheetContent side="right" className="text-xs">
          <SheetHeader>
            <SheetTitle>Send to supplier</SheetTitle>
            <SheetDescription>
              Confirm who this order is going to. This opens your own email client with the details filled
              in - actual sending isn't wired up yet, so export the PDF first and attach it there yourself.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3 px-4">
            <div>
              <p className="text-[10px] text-muted-foreground">Supplier</p>
              <p className="mt-1 font-medium text-foreground">{order.supplier?.name || '—'}</p>
            </div>

            <label className="block text-[10px] font-medium text-foreground">
              Email <span className="text-red-500">*</span>
              <Input
                type="email"
                value={sendEmail}
                onChange={(event) => setSendEmail(event.target.value)}
                placeholder="supplier@example.com"
                className="mt-1 h-auto w-full text-sm"
              />
            </label>

            <label className="block text-[10px] font-medium text-foreground">
              Alternate email (optional)
              <Input
                type="email"
                value={sendAltEmail}
                onChange={(event) => setSendAltEmail(event.target.value)}
                placeholder="e.g. a second contact at the supplier"
                className="mt-1 h-auto w-full text-sm"
              />
            </label>

            {sendError && (
              <p role="alert" className="text-xs text-red-600">{sendError}</p>
            )}

            <a
              href={sendEmail ? buildMailtoHref() : undefined}
              onClick={() => {
                if (sendEmail && canTransitionToSent) handleConfirmSent()
              }}
              aria-disabled={!sendEmail}
              className={`flex h-9 w-full items-center justify-center rounded-sm text-xs font-medium text-white ${
                sendEmail ? 'bg-core' : 'pointer-events-none bg-core/50'
              }`}
            >
              {isMarkingSent
                ? 'Marking as sent...'
                : canTransitionToSent
                  ? 'Confirm & open email'
                  : 'Resend email'}
            </a>

            {!canTransitionToSent && (
              <p className="text-[10px] text-muted-foreground">
                This order is already {order.status.replace(/_/g, ' ')}, so this just reopens your email
                client - its status won't change again.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}