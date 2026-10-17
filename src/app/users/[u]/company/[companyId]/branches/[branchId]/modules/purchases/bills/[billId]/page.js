'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

import supabase from '@/config/supabaseClient'
import { formatNaira } from '@/components/modules/sales/dummy-data'
import StatusBadge from '@/components/modules/sales/status-badge'
import { AttachmentList } from '@/components/company-file-uploader'
// ASSUMPTION: same path the Bill form imports company-files from.
import { getAttachmentUrl, formatFileSize, useFileAttachments } from '@/components/company-files'

// Rewired onto the real schema from purchase-bills-migration.sql:
//  - purchase_bills_view (not the raw table) for effective_status,
//    which shows 'overdue' once due_date passes with nothing needing
//    to flip a stored column.
//  - purchase_bill_line_items for the actual billed lines.
//  - purchase_bill_payments for payment history, plus
//    record_purchase_bill_payment() to add one - purchase_bills.paid
//    and status update themselves via trigger once a payment lands.
//  - cancel_purchase_bill() for the Cancel action - the function
//    itself refuses if anything's been paid, so this page just
//    surfaces whatever it says rather than re-deciding that here.
//
// Layout (desktop), same idea as the New Bill page: header on top; below
// it a fixed left panel showing the supplier's uploaded document (the
// first file is open as soon as the page loads; other files are one
// click away; "Open in new tab" gives the full-size view) and a right
// column that is the ONLY scrollable region, kept compact. The right
// column takes about three quarters of the width, the document panel
// about one quarter.
// Layout (mobile): everything stacks and the page scrolls as one.

const isImageFile = (attachment) => (attachment?.mime_type || '').startsWith('image/')
const isPdfFile = (attachment) => (attachment?.mime_type || '') === 'application/pdf'

// The selected supplier document, shown large. The link is a short-lived
// signed URL (the bucket is private), fetched whenever the selection changes.
function DocumentPreview({ attachment }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setUrl('')
    setError('')
    if (!attachment) return undefined

    getAttachmentUrl(attachment.storage_path, 3600)
      .then((signed) => {
        if (!cancelled) setUrl(signed)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load this file.')
      })

    return () => {
      cancelled = true
    }
  }, [attachment])

  if (!attachment) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-gray-400">
        No supplier document attached to this bill.
      </div>
    )
  }
  if (error) return <p className="p-4 text-xs text-red-600">{error}</p>
  if (!url) return <p className="p-4 text-xs text-gray-400">Loading document...</p>

  if (isPdfFile(attachment)) {
    // navpanes=0 hides the browser PDF viewer's left sidebar (the page
    // thumbnails / numbering) so only the document shows; view=FitH fits the
    // page to the panel's width. The user can scroll, or use "Open in new tab".
    return (
      <iframe
        src={`${url}#navpanes=0&view=FitH`}
        title={attachment.file_name}
        className="h-full w-full border-0"
      />
    )
  }
  if (isImageFile(attachment)) {
    return <img src={url} alt={attachment.file_name} className="h-full w-full object-contain" />
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-gray-500">
      <FileText className="h-8 w-8" />
      <span className="break-all text-xs text-gray-700">{attachment.file_name}</span>
      <span className="text-[11px]">No preview for this file type - use "Open in new tab".</span>
    </div>
  )
}

// One word on where the billed goods are: received, partly received, still
// in quarantine, or not delivered yet. Received counts only goods that are
// available stock, measured against what THIS bill covers.
function DeliveryChip({ line }) {
  const billed = Number(line.quantity || 0)
  let label
  let className
  if (line.received >= billed && billed > 0) {
    label = 'Received'
    className = 'bg-emerald-100 text-emerald-800'
  } else if (line.received > 0) {
    label = 'Partly received'
    className = 'bg-amber-100 text-amber-800'
  } else if (line.inQuarantine > 0) {
    label = 'In quarantine'
    className = 'bg-amber-100 text-amber-800'
  } else {
    label = 'Not received'
    className = 'bg-gray-100 text-gray-600'
  }
  return (
    <span className={`ml-1.5 inline-flex rounded-sm px-1 py-0.5 align-middle text-[9px] font-medium ${className}`}>
      {label}
    </span>
  )
}

export default function PurchaseBillDetailPage() {
  const router = useRouter()
  const { u, companyId, branchId, billId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/bills`

  const [bill, setBill] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  // The supplier's uploaded documents, oldest first so the first one uploaded
  // is the one shown when the page opens.
  const { attachments: rawAttachments, reload: reloadAttachments } = useFileAttachments(
    'purchase_bill',
    billId
  )
  const attachments = useMemo(
    () =>
      [...rawAttachments].sort((a, b) => new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0)),
    [rawAttachments]
  )
  const [selectedFileId, setSelectedFileId] = useState('')
  const activeFile = attachments.find((file) => file.id === selectedFileId) || attachments[0] || null

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    const [{ data: billData, error: billError }, { data: lineData }, { data: paymentData }] =
      await Promise.all([
        supabase
          .from('purchase_bills_view')
          .select(
            `id, bill_number, effective_status, issued_at, due_date, total, subtotal, tax, paid,
             supplier_reference, notes,
             supplier:suppliers(id, name),
             purchase_order:purchase_orders(id, order_number),
             purchase_receipt:purchase_receipts(id, receipt_number)`
          )
          .eq('id', billId)
          .eq('branch', branchId)
          .single(),
        supabase
          .from('purchase_bill_line_items')
          .select('id, description_snapshot, quantity, unit_price_snapshot, line_total, variant, purchase_order_line_item')
          .eq('purchase_bill', billId),
        supabase
          .from('purchase_bill_payments')
          .select('id, amount, paid_at, method, reference, notes')
          .eq('purchase_bill', billId)
          .order('paid_at', { ascending: false }),
      ])

    if (billError) {
      setLoadError(billError.message || 'Could not load this bill.')
      setLoading(false)
      return
    }

    // Delivery status of what this bill covers. Received / returned are the
    // purchase order line's running totals (a PO can have several bills and
    // several deliveries); "in quarantine" is goods that arrived but are not
    // available stock yet, so they do not count as received.
    const orderLineIds = [...new Set((lineData || []).map((line) => line.purchase_order_line_item).filter(Boolean))]
    const orderLines = new Map()
    const quarantine = new Map()
    if (orderLineIds.length > 0) {
      const [{ data: poLines }, { data: holdRows }] = await Promise.all([
        supabase
          .from('purchase_order_line_items')
          .select('id, quantity_received, quantity_returned')
          .in('id', orderLineIds),
        supabase
          .from('purchase_receipt_holds')
          .select('purchase_order_line_item, quantity')
          .in('purchase_order_line_item', orderLineIds)
          .in('status', ['awaiting_review', 'damaged']),
      ])
      ;(poLines || []).forEach((row) => orderLines.set(row.id, row))
      ;(holdRows || []).forEach((row) => {
        quarantine.set(
          row.purchase_order_line_item,
          (quarantine.get(row.purchase_order_line_item) || 0) + Number(row.quantity || 0)
        )
      })
    }

    setBill(billData)
    setLineItems(
      (lineData || []).map((line) => {
        const poLine = orderLines.get(line.purchase_order_line_item)
        return {
          ...line,
          received: Number(poLine?.quantity_received || 0),
          returned: Number(poLine?.quantity_returned || 0),
          inQuarantine: quarantine.get(line.purchase_order_line_item) || 0,
        }
      })
    )
    setPayments(paymentData || [])
    setLoading(false)
  }, [billId, branchId])

  useEffect(() => {
    load()
  }, [load])

  const handleRecordPayment = async (event) => {
    event.preventDefault()
    setPaymentError('')

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setPaymentError('Enter an amount greater than zero.')
      return
    }

    setRecordingPayment(true)
    const { error } = await supabase.rpc('record_purchase_bill_payment', {
      p_purchase_bill: billId,
      p_amount: Number(paymentAmount),
      p_paid_at: paymentDate || new Date().toISOString(),
      p_method: paymentMethod || null,
      p_reference: paymentReference || null,
    })
    setRecordingPayment(false)

    if (error) {
      setPaymentError(error.message || 'Could not record this payment.')
      return
    }

    setPaymentAmount('')
    setPaymentDate('')
    setPaymentMethod('')
    setPaymentReference('')
    load()
  }

  const handleCancel = async () => {
    setCancelling(true)
    setCancelError('')

    const { error } = await supabase.rpc('cancel_purchase_bill', { p_purchase_bill: billId })
    setCancelling(false)

    if (error) {
      setCancelError(error.message || 'Could not cancel this bill.')
      return
    }

    load()
  }

  if (loading && !bill) {
    return <p className="p-6 text-xs text-gray-400">Loading bill...</p>
  }

  if (loadError || !bill) {
    return <p className="p-6 text-xs text-red-600">{loadError || 'Bill not found.'}</p>
  }

  const balance = Number(bill.total || 0) - Number(bill.paid || 0)
  const canCancel = Number(bill.paid || 0) <= 0 && bill.effective_status !== 'cancelled'
  const orderHref = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders/${bill.purchase_order?.id}`

  const openActiveFile = async () => {
    if (!activeFile) return
    // Open the tab inside the click (so the popup blocker allows it), then
    // point it at a fresh signed link.
    const tab = window.open('', '_blank')
    try {
      const signed = await getAttachmentUrl(activeFile.storage_path)
      if (tab) {
        tab.opener = null
        tab.location.href = signed
      }
    } catch (err) {
      if (tab) tab.close()
    }
  }

  return (
    <div className="flex w-full max-w-none grow flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-slate-900">{bill.bill_number}</h1>
            <StatusBadge status={bill.effective_status} />
          </div>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {bill.supplier?.name} ·{' '}
            <Link href={orderHref} className="text-core hover:underline">
              {bill.purchase_order?.order_number}
            </Link>
            {bill.purchase_receipt && (
              <>
                {' · '}
                <Link
                  href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/receipts/${bill.purchase_receipt.id}`}
                  className="text-core hover:underline"
                >
                  {bill.purchase_receipt.receipt_number}
                </Link>
              </>
            )}
            {bill.supplier_reference && <> · Invoice {bill.supplier_reference}</>}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-6 text-xs"
            onClick={() => router.push(`${base}/${billId}/edit`)}
          >
            Edit bill
          </Button>
          {canCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={cancelling}
              className="h-6 bg-red-300 text-xs"
              onClick={() => setCancelOpen(true)}
            >
              {cancelling ? 'Cancelling...' : 'Cancel bill'}
            </Button>
          )}
        </div>
      </div>

      {cancelError && <p className="shrink-0 text-xs text-red-600">{cancelError}</p>}

      {/* Body. Desktop: fixed left panel (document, ~25%) + the one scrollable
          right column (~75%). Mobile: stacked, page scrolls as a whole. */}
      <div className="flex min-h-0 grow flex-col gap-3 overflow-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
        {/* LEFT - the supplier's document, first file open by default */}
        <section className="flex flex-col gap-2 lg:min-h-0">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-gray-800">Supplier invoice / screenshot</h2>
            {activeFile && (
              <button
                type="button"
                onClick={openActiveFile}
                className="flex items-center gap-1 text-[11px] text-core hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open in new tab
              </button>
            )}
          </div>

          {attachments.length > 1 && (
            <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5">
              {attachments.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelectedFileId(file.id)}
                  title={file.file_name}
                  className={`max-w-[160px] shrink-0 truncate rounded-md border px-2 py-1 text-[10px] ${
                    activeFile?.id === file.id
                      ? 'border-core bg-core/5 text-core'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {file.file_name}
                </button>
              ))}
            </div>
          )}

          <div className="h-80 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 lg:h-auto lg:min-h-0 lg:flex-1">
            <DocumentPreview attachment={activeFile} />
          </div>

          {activeFile && (
            <p className="shrink-0 truncate text-[10px] text-gray-400" title={activeFile.file_name}>
              {activeFile.file_name} · {formatFileSize(activeFile.size_bytes)}
              {activeFile.uploaded_at ? ` · ${new Date(activeFile.uploaded_at).toLocaleDateString()}` : ''}
            </p>
          )}

          <div className="shrink-0 [&_li]:py-1 [&_li]:text-[11px]">
            <AttachmentList
              entityType="purchase_bill"
              entityId={billId}
              companyId={companyId}
              branchId={branchId}
              moduleKey="purchases-bills"
              canAdd={bill.effective_status !== 'cancelled'}
              canDelete={bill.effective_status !== 'cancelled'}
              onChange={reloadAttachments}
            />
          </div>
        </section>

        {/* RIGHT - the only scrollable region on desktop, kept compact */}
        <section className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 px-3 py-2 sm:grid-cols-5">
            <div>
              <p className="text-[10px] text-gray-500">Issued</p>
              <p className="text-xs text-gray-800">
                {bill.issued_at ? new Date(bill.issued_at).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Due</p>
              <p className="text-xs text-gray-800">
                {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Total</p>
              <p className="text-xs font-medium text-gray-900">{formatNaira(bill.total)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Paid</p>
              <p className="text-xs text-gray-800">{formatNaira(bill.paid || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Balance</p>
              <p className={`text-xs font-medium ${balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {formatNaira(balance)}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-gray-800">Line items</h2>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 text-[10px] text-gray-600">
                  <tr>
                    <th className="px-2.5 py-1.5 text-left">Item</th>
                    <th className="px-2.5 py-1.5 text-right">Billed</th>
                    <th className="px-2.5 py-1.5 text-right">Received</th>
                    <th className="px-2.5 py-1.5 text-right">In quarantine</th>
                    <th className="px-2.5 py-1.5 text-right">Returned</th>
                    <th className="px-2.5 py-1.5 text-right">Unit price</th>
                    <th className="px-2.5 py-1.5 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lineItems.map((line) => (
                    <tr key={line.id}>
                      <td className="px-2.5 py-1 text-gray-800">
                        {line.description_snapshot || '—'}
                        <DeliveryChip line={line} />
                      </td>
                      <td className="px-2.5 py-1 text-right text-gray-600">{line.quantity}</td>
                      <td className="px-2.5 py-1 text-right text-gray-600">{line.received.toLocaleString()}</td>
                      <td className="px-2.5 py-1 text-right text-gray-600">
                        {line.inQuarantine > 0 ? (
                          <span className="rounded-sm bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800">
                            {line.inQuarantine.toLocaleString()}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-2.5 py-1 text-right text-gray-600">{line.returned.toLocaleString()}</td>
                      <td className="px-2.5 py-1 text-right text-gray-600">
                        {formatNaira(line.unit_price_snapshot)}
                      </td>
                      <td className="px-2.5 py-1 text-right font-medium text-gray-800">
                        {formatNaira(line.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-200 text-[11px]">
                  <tr>
                    <td colSpan={6} className="px-2.5 py-1 text-right text-gray-500">Subtotal</td>
                    <td className="px-2.5 py-1 text-right text-gray-700">{formatNaira(bill.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="px-2.5 py-1 text-right text-gray-500">Tax</td>
                    <td className="px-2.5 py-1 text-right text-gray-700">{formatNaira(bill.tax)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {bill.notes && <p className="text-[11px] text-gray-500">Notes: {bill.notes}</p>}
          </div>

          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-gray-800">Payment history</h2>
            {payments.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-200 px-3 py-2 text-center text-[11px] text-gray-400">
                No payments recorded yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50 text-[10px] text-gray-600">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left">Date</th>
                      <th className="px-2.5 py-1.5 text-left">Method</th>
                      <th className="px-2.5 py-1.5 text-left">Reference</th>
                      <th className="px-2.5 py-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-2.5 py-1 text-gray-700">
                          {new Date(payment.paid_at).toLocaleDateString()}
                        </td>
                        <td className="px-2.5 py-1 text-gray-700">{payment.method || '—'}</td>
                        <td className="px-2.5 py-1 text-gray-700">{payment.reference || '—'}</td>
                        <td className="px-2.5 py-1 text-right font-medium text-gray-800">
                          {formatNaira(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {balance > 0 && bill.effective_status !== 'cancelled' && (
            <form onSubmit={handleRecordPayment} className="space-y-2 rounded-lg border border-gray-200 p-3">
              <h2 className="text-xs font-semibold text-gray-800">Record a payment</h2>

              {paymentError && <p className="text-[11px] text-red-600">{paymentError}</p>}

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-medium text-gray-700">
                  Amount <span className="text-red-500">*</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    max={balance}
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    className="mt-0.5 h-7 w-full text-xs"
                  />
                  <span className="mt-0.5 block text-[10px] font-normal text-gray-400">
                    Balance: {formatNaira(balance)} (a part-payment is fine)
                  </span>
                </label>

                <label className="block text-[11px] font-medium text-gray-700">
                  Date
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    className="mt-0.5 h-7 w-full text-xs"
                  />
                </label>

                <label className="block text-[11px] font-medium text-gray-700">
                  Method
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-0.5 h-7 w-full text-xs">
                      <SelectValue placeholder="Select a method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="block text-[11px] font-medium text-gray-700">
                  Reference
                  <Input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder="Transfer ID, cheque no."
                    className="mt-0.5 h-7 w-full text-xs"
                  />
                </label>
              </div>

              <Button type="submit" className="h-6 bg-core text-xs text-white" disabled={recordingPayment}>
                {recordingPayment ? 'Recording...' : 'Record payment'}
              </Button>
            </form>
          )}
        </section>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Cancel this bill?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {bill.bill_number} will be cancelled and its quantities become billable again on the
              purchase order. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">Keep bill</AlertDialogCancel>
            <AlertDialogAction className="h-7 bg-red-600 text-xs text-white" onClick={handleCancel}>
              Cancel bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}