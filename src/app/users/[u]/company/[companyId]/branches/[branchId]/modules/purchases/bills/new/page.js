'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { X, Upload, FileText, Maximize2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  usePurchaseOrdersForBilling,
  useReceiptsForPurchaseOrder,
  usePoPurchaseBalance,
  useVariantNames,
} from '@/components/modules/purchases/purchase-catalog'
// ASSUMPTION: adjust this path to wherever company-files.js is placed.
import {
  ACCEPTED_FILE_TYPES,
  fileKindLabel,
  formatFileSize,
  isImage,
  isPdf,
  isPreviewable,
  useStagedFiles,
} from '@/components/company-files'
// ASSUMPTION: same folder as company-files.js.
import { AttachmentList } from '@/components/company-file-uploader'

const getEntryStatus = (entry) => {
  if (entry.uploading) return { label: 'Uploading...', dot: 'bg-amber-400', text: 'text-amber-600' }
  if (entry.error) return { label: entry.error, dot: 'bg-red-500', text: 'text-red-600' }
  if (entry.url) return { label: 'Uploaded', dot: 'bg-emerald-500', text: 'text-emerald-600' }
  return { label: 'Pending', dot: 'bg-gray-300', text: 'text-gray-500' }
}

// Local preview of a selected file, independent of whether the upload to
// storage has finished. The object URL is revoked on cleanup so previews
// don't leak memory as files are added/removed.
function useObjectUrl(file) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return undefined
    }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return url
}

// Images and PDFs preview inline; anything else (Word documents) can't be
// rendered by the browser, so it shows a file card instead.
function FileMedia({ file }) {
  const url = useObjectUrl(file)

  if (isPdf(file)) {
    if (!url) return null
    return <iframe src={url} title={file.name} className="h-full w-full border-0" />
  }
  if (isImage(file)) {
    if (!url) return null
    return <img src={url} alt={file.name} className="h-full w-full object-contain" />
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-gray-500">
      <FileText className="h-8 w-8" />
      <span className="break-all text-xs text-gray-700">{file.name}</span>
      <span className="text-[11px]">
        {fileKindLabel(file)} · {formatFileSize(file.size)} · no preview available
      </span>
    </div>
  )
}

// A Bill always starts from a Purchase Order — never a Receipt. Whether
// a Receipt exists yet for that PO is informational only (shown once a
// PO is picked), because real supplier terms sometimes require a bill,
// and even a payment, BEFORE anything has been received (a deposit).
// Quantity/price matching against what's actually been received only
// kicks in per line, via create_purchase_bill on the backend, driven
// by this branch's Purchase Settings (bills_matching_mode etc) — this
// form doesn't duplicate that policy, it just shows the same numbers
// the backend will check against and surfaces whatever it reports back.
//
// Attachments: files are picked and previewed locally, then uploaded
// together AFTER the bill is created (there's no bill id to file them
// under before that) via the shared useStagedFiles() hook - they go to
// the company-documents bucket and are recorded in file_attachments.
// If a file fails to upload the bill is still saved, and you land on
// its page, where more files can be added.
//
// Layout (desktop): header inputs fixed at the top; below them the page
// is split into a fixed left panel (F4-proportioned supplier-invoice
// upload/preview) and a right column that is the ONLY scrollable region
// (PO balance, line items, then subtotal/tax/total and notes).
// Layout (mobile): everything stacks and the form scrolls as one page.
// On mobile the large file preview is hidden; only the file name/status
// row and the thumbnail strip are shown.

export default function BillForm() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const searchParams = useSearchParams()
  const draftParam = searchParams.get('draft') // open an existing draft: .../bills/new?draft=<id>
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/bills`

  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [receiptId, setReceiptId] = useState('') // optional, informational
  const [supplierReference, setSupplierReference] = useState('')
  const [billDate, setBillDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [tax, setTax] = useState('')
  const [notes, setNotes] = useState('')
  const [lineQuantities, setLineQuantities] = useState({}) // { [poLineItemId]: quantity }
  const [linePrices, setLinePrices] = useState({}) // { [poLineItemId]: billing price (blank = use estimated) }
  const [selectedLines, setSelectedLines] = useState({}) // { [poLineItemId]: true } - lines included in this bill
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [fileError, setFileError] = useState('')
  const [draftId, setDraftId] = useState(draftParam || '')
  const [draftLoading, setDraftLoading] = useState(Boolean(draftParam))
  const [draftFilesKey, setDraftFilesKey] = useState(0)
  // The loaded draft's saved values, waiting until the purchase orders list
  // has loaded so the PO, its lines, quantities and prices can all be put
  // back together in one step. null once applied (or when there's no draft).
  const [pendingDraft, setPendingDraft] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false) // "review before saving" dialog
  const [updateEstimates, setUpdateEstimates] = useState(false) // tick: also update estimated cost prices
  const [notice, setNotice] = useState(null) // { title, lines, redirectTo } shown after saving

  // { id, file, uploading, url, error } per picked file; nothing is sent
  // to storage until the bill itself has been saved.
  const {
    files: attachments,
    addFiles,
    removeFile: removeAttachment,
    uploadAll,
  } = useStagedFiles()

  const [activeFile, setActiveFile] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
  } = usePurchaseOrdersForBilling(branchId)
  const { receipts, loading: receiptsLoading } = useReceiptsForPurchaseOrder(purchaseOrderId)
  const { balance, loading: balanceLoading } = usePoPurchaseBalance(purchaseOrderId)

  const selectedOrder = orders.find((order) => order.id === purchaseOrderId)
  const poLineItems = selectedOrder?.purchase_order_line_items || []
  const { names: variantNames } = useVariantNames(poLineItems.map((line) => line.variant))

  // The user picked a different Purchase Order: start the per-PO state fresh,
  // so stale quantities/prices from a previously-selected order never leak
  // into this one. (This used to be an effect on purchaseOrderId, which also
  // fired while a draft was being restored and had to be worked around; doing
  // it here means it only ever runs for a real user change.)
  const handlePurchaseOrderChange = (value) => {
    // The PO is required and can't be cleared by the user, so an empty value
    // here is never a real choice. (Radix Select can report '' when its value
    // is set programmatically before its options exist; ignoring it stops a
    // restored draft from being wiped.)
    if (!value) return
    setPurchaseOrderId(value)
    setReceiptId('')
    setLineQuantities({})
    setLinePrices({})
    setSelectedLines({})
  }

  // Load the draft being continued (if any). The simple header fields are
  // put back right away; the PO selection and its lines are applied by the
  // effect below, once the purchase orders list is available.
  useEffect(() => {
    if (!draftParam) return undefined
    let cancelled = false

    async function loadDraft() {
      const { data, error } = await supabase
        .from('purchase_bill_drafts')
        .select('id, payload')
        .eq('id', draftParam)
        .eq('branch', branchId)
        .maybeSingle()

      if (cancelled) return
      if (error || !data) {
        console.error('Could not load the draft:', error)
        setSubmitError(error?.message || 'That draft could not be found.')
        setDraftLoading(false)
        return
      }

      const payload = data.payload || {}
      setSupplierReference(payload.supplierReference || '')
      setBillDate(payload.billDate || '')
      setDueDate(payload.dueDate || '')
      setTax(payload.tax ?? '')
      setNotes(payload.notes || '')
      setPendingDraft(payload)
      setDraftLoading(false)
    }

    loadDraft()
    return () => {
      cancelled = true
    }
  }, [draftParam, branchId])

  // Put the draft's Purchase Order, receipt, line selection, quantities and
  // prices back — all in one go, and only when BOTH the draft and the orders
  // list are ready, so it doesn't matter which one finishes loading first
  // (or whether you arrived by clicking a link or by reloading the page).
  useEffect(() => {
    if (!pendingDraft || ordersLoading) return

    const wanted = pendingDraft.purchaseOrderId
    if (!wanted) {
      setPendingDraft(null)
      return
    }

    // The list hasn't actually arrived yet (nothing in it, no error): keep waiting.
    if (orders.length === 0 && !ordersError) return

    if (!orders.some((order) => order.id === wanted)) {
      setPendingDraft(null)
      setSubmitError(
        'The purchase order on this draft is no longer available (it may have been cancelled). Pick another one to continue.'
      )
      return
    }

    setPurchaseOrderId(wanted)
    setReceiptId(pendingDraft.receiptId || '')
    setLineQuantities(pendingDraft.lineQuantities || {})
    setLinePrices(pendingDraft.linePrices || {})
    setSelectedLines(pendingDraft.selectedLines || {})
    setPendingDraft(null)
  }, [pendingDraft, orders, ordersLoading, ordersError])

  // Only SELECTED lines are part of this bill. Per line, the price used is
  // the Billing price if one was entered, otherwise the Estimated price from
  // the Purchase Order.
  const billableLines = useMemo(
    () =>
      poLineItems.map((line) => {
        const isSelected = Boolean(selectedLines[line.id])
        const quantity = Number(lineQuantities[line.id] || 0)
        const billingRaw = linePrices[line.id]
        const hasBillingPrice = billingRaw !== undefined && billingRaw !== ''
        const unitPrice = hasBillingPrice
          ? Number(billingRaw)
          : Number(line.unit_cost_snapshot || 0)

        // What can still be billed on this line: ordered minus what earlier
        // (non-cancelled) bills already cover. Billing more than that is
        // never allowed.
        const billable = Math.max(
          Number(line.quantity_ordered || 0) - Number(line.quantity_billed || 0),
          0
        )
        const fullyBilled = billable === 0
        const overLimit = isSelected && quantity > billable

        // Paying ahead of delivery is allowed, but flagged: how much of this
        // bill's quantity is NOT yet covered by received goods.
        const billedAfter = Number(line.quantity_billed || 0) + quantity
        const aheadOfReceipts = isSelected
          ? Math.max(billedAfter - Number(line.quantity_received || 0), 0)
          : 0

        return {
          ...line,
          isSelected,
          hasBillingPrice,
          quantity,
          unitPrice,
          billable,
          fullyBilled,
          overLimit,
          aheadOfReceipts: Math.min(aheadOfReceipts, quantity),
          displayName: variantNames[line.variant]?.display || '',
          lineTotal: isSelected ? quantity * unitPrice : 0,
        }
      }),
    [poLineItems, lineQuantities, linePrices, selectedLines, variantNames]
  )

  const hasOverLimit = billableLines.some((line) => line.overLimit)
  const linesAheadOfReceipts = billableLines.filter((line) => line.aheadOfReceipts > 0)

  // Lines whose billing price differs from the Purchase Order's estimated
  // price, with the exact difference in money and in percent of the PO price.
  const priceDifferences = useMemo(
    () =>
      billableLines
        .filter((line) => line.isSelected && line.quantity > 0)
        .map((line) => {
          const estimated = Number(line.unit_cost_snapshot || 0)
          const billed = Number(line.unitPrice || 0)
          const difference = billed - estimated
          return {
            id: line.id,
            variant: line.variant,
            name: line.displayName || 'Item',
            currency: line.cost_currency || null,
            estimated,
            billed,
            difference,
            percent: estimated > 0 ? (difference / estimated) * 100 : null,
          }
        })
        .filter((row) => Math.abs(row.difference) > 0.000001),
    [billableLines]
  )
  const needsReview = priceDifferences.length > 0 || linesAheadOfReceipts.length > 0

  const subtotal = billableLines.reduce((sum, line) => sum + line.lineTotal, 0)
  const total = subtotal + Number(tax || 0)
  const hasAnySelected = billableLines.some((line) => line.isSelected)
  const hasAnyQuantity = billableLines.some((line) => line.isSelected && line.quantity > 0)
  const selectableLines = billableLines.filter((line) => !line.fullyBilled)
  const allLinesSelected =
    selectableLines.length > 0 && selectableLines.every((line) => line.isSelected)

  // Selecting a line pre-fills its quantity with what's still unbilled on
  // the PO (ordered - billed so far) so the total updates immediately;
  // the quantity stays editable for partial bills.
  const toggleLine = (line, checked) => {
    setSelectedLines((prev) => ({ ...prev, [line.id]: checked }))
    if (checked) {
      setLineQuantities((prev) => {
        if (prev[line.id] !== undefined && prev[line.id] !== '') return prev
        const remaining = Math.max(
          Number(line.quantity_ordered || 0) - Number(line.quantity_billed || 0),
          0
        )
        return { ...prev, [line.id]: String(remaining) }
      })
    }
  }

  // Lines already billed in full can't be selected, so "select all" skips them.
  const isFullyBilled = (line) =>
    Number(line.quantity_ordered || 0) - Number(line.quantity_billed || 0) <= 0

  const toggleAllLines = (checked) => {
    poLineItems.filter((line) => !isFullyBilled(line)).forEach((line) => toggleLine(line, checked))
  }

  const hasAttachments = attachments.length > 0
  const activeEntry =
    attachments.find((item) => item.file === activeFile) || attachments[0] || null
  const activeStatus = activeEntry ? getEntryStatus(activeEntry) : null

  const handleFilesSelected = (event) => {
    const { accepted, rejected } = addFiles(event.target.files)
    setFileError(rejected.join('\n'))
    // Show the first newly-added file large; the rest sit in the thumbnail strip.
    if (accepted.length) setActiveFile(accepted[0])
    event.target.value = ''
  }

  // Save as Draft: the whole form goes into purchase_bill_drafts as jsonb,
  // and any NEW files are uploaded and filed under the draft. Files already
  // uploaded on an earlier save are never sent again (the staged list marks
  // them uploaded, and a reopened draft lists them from file_attachments).
  // Nothing here touches real bills or quantity_billed.
  const handleSaveDraft = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (!purchaseOrderId) {
      setSubmitError('Select a Purchase Order first.')
      return
    }
    if (!hasAnySelected) {
      setSubmitError('Select at least one line item to save this draft.')
      return
    }
    if (hasOverLimit) {
      setSubmitError('One or more lines are billed for more than what is still left to bill. Fix the lines shown in red.')
      return
    }

    setSaving(true)

    const payload = {
      purchaseOrderId,
      receiptId,
      supplierReference,
      billDate,
      dueDate,
      tax,
      notes,
      selectedLines,
      lineQuantities,
      linePrices,
    }
    const title = [selectedOrder?.order_number, selectedOrder?.supplier?.name, supplierReference]
      .filter(Boolean)
      .join(' · ')

    let id = draftId
    if (id) {
      const { error } = await supabase
        .from('purchase_bill_drafts')
        .update({ title, payload })
        .eq('id', id)
      if (error) {
        setSaving(false)
        setSubmitError(error.message || 'Could not save this draft.')
        return
      }
    } else {
      const { data, error } = await supabase
        .from('purchase_bill_drafts')
        .insert({ company: companyId, branch: branchId, title, payload })
        .select('id')
        .single()
      if (error) {
        setSaving(false)
        setSubmitError(error.message || 'Could not save this draft.')
        return
      }
      id = data.id
      setDraftId(id)
    }

    let failedUploads = []
    if (attachments.length > 0) {
      const results = await uploadAll({
        companyId,
        branchId,
        moduleKey: 'purchases-bills',
        entityType: 'purchase_bill_draft',
        entityId: id,
      })
      failedUploads = results.filter((result) => !result.ok)
    }

    setSaving(false)
    setDraftFilesKey((key) => key + 1)

    if (failedUploads.length > 0) {
      setSubmitError(
        `The draft was saved, but ${failedUploads.length} file(s) could not be uploaded: ` +
          failedUploads.map((result) => `${result.file.name} (${result.error})`).join(', ') +
          '. Press Save as Draft again to retry them.'
      )
      return
    }

    router.push(base)
  }

  // Checks that must pass before anything is saved. Returns the message to
  // show, or '' when the bill is fine to save.
  const validateBill = () => {
    if (!purchaseOrderId) return 'Select a Purchase Order to bill against.'
    if (!hasAnySelected) return 'Select at least one line item to bill.'
    if (!hasAnyQuantity) return 'Enter a quantity against at least one selected line item.'
    if (hasOverLimit) {
      return 'One or more lines are billed for more than what is still left to bill. Fix the lines shown in red.'
    }
    return ''
  }

  // Save Bill button: if anything differs from the Purchase Order (price) or
  // is being billed ahead of delivery, show the review dialog first; the
  // bill is only saved once the user confirms there.
  const handleSaveClick = (event) => {
    event.preventDefault()
    setSubmitError('')
    const problem = validateBill()
    if (problem) {
      setSubmitError(problem)
      return
    }
    if (needsReview) {
      setReviewOpen(true)
      return
    }
    handleSubmit(event, 'unpaid')
  }

  const handleSubmit = async (event, submitStatus) => {
    event?.preventDefault?.()
    setSubmitError('')

    const problem = validateBill()
    if (problem) {
      setSubmitError(problem)
      return
    }

    setSaving(true)

    const lineItems = billableLines
      .filter((line) => line.isSelected && line.quantity > 0)
      .map((line) => ({
        purchase_order_line_item: line.id,
        variant: line.variant,
        description_snapshot:
          line.displayName || line.product_variants?.variant_label || line.product_variants?.sku || '',
        quantity: line.quantity,
        unit_price_snapshot: line.unitPrice,
        line_total: line.lineTotal,
      }))

    const { data, error } = await supabase.rpc('create_purchase_bill', {
      p_branch: branchId,
      p_supplier: selectedOrder?.supplier?.id,
      p_purchase_order: purchaseOrderId,
      p_purchase_receipt: receiptId || null,
      p_supplier_reference: supplierReference || null,
      p_bill_date: billDate || null,
      p_due_date: dueDate || null,
      p_subtotal: subtotal,
      p_tax: Number(tax || 0),
      p_notes: notes || null,
      p_line_items: lineItems,
      p_status: submitStatus,
    })

    if (error) {
      setSaving(false)
      setSubmitError(error.message || 'Could not create this bill.')
      return
    }

    // Everything the user should still be told once the bill is saved.
    const noticeLines = []

    // The bill exists now, so the picked files can be filed under it.
    const billId = data?.bill?.id
    let failedUploads = []
    if (billId && attachments.length > 0) {
      const results = await uploadAll({
        companyId,
        branchId,
        moduleKey: 'purchases-bills',
        entityType: 'purchase_bill',
        entityId: billId,
      })
      failedUploads = results.filter((result) => !result.ok)
    }

    // The bill came from a draft: its already-uploaded files move across to
    // the bill (no re-upload) and the draft is removed.
    if (billId && draftId) {
      const { error: promoteError } = await supabase.rpc('promote_purchase_bill_draft', {
        p_draft: draftId,
        p_bill: billId,
      })
      if (promoteError) {
        console.error('Could not close the draft after saving the bill:', promoteError)
        noticeLines.push(
          `The draft could not be removed (${promoteError.message}). You can delete it from Draft Bills.`
        )
      }
    }

    // Ticked in the review dialog: make the billed prices the products'
    // estimated cost prices.
    if (billId && updateEstimates && priceDifferences.length > 0) {
      const { data: estimateResult, error: estimateError } = await supabase.rpc(
        'update_cost_estimates_from_bill',
        {
          p_branch: branchId,
          p_updates: priceDifferences.map((row) => ({
            variant: row.variant,
            cost_price: row.billed,
            cost_currency: row.currency,
          })),
        }
      )
      if (estimateError) {
        noticeLines.push(`Estimated cost prices were not updated: ${estimateError.message}`)
      } else {
        const updated = Number(estimateResult?.updated || 0)
        const skipped = Number(estimateResult?.skipped || 0)
        noticeLines.push(
          `Estimated cost price updated for ${updated} product${updated === 1 ? '' : 's'}.` +
            (skipped > 0
              ? ` ${skipped} left unchanged (different currency, or you can't edit that product).`
              : '')
        )
      }
    }

    // Flags raised by the server's own tolerance check.
    if (data?.warnings?.length) {
      data.warnings.forEach((w) => {
        noticeLines.push(
          w.type === 'quantity'
            ? `Billed quantity is ${w.overage_percent}% more than what has been received.`
            : `Billing price differs from the Purchase Order price by ${w.difference_percent}%.`
        )
      })
      noticeLines.push('This bill has been flagged for review.')
    }

    if (failedUploads.length > 0) {
      failedUploads.forEach((result) => {
        noticeLines.push(`File not uploaded: ${result.file.name} (${result.error}). Add it again from the bill's page.`)
      })
    }

    setSaving(false)

    const redirectTo = failedUploads.length > 0 ? `${base}/${billId}` : base
    if (noticeLines.length > 0) {
      setNotice({ title: 'Bill saved', lines: noticeLines, redirectTo })
      return
    }
    router.push(redirectTo)
  }

  // Shared file input, rendered inside whichever upload trigger is
  // currently visible (the empty-state F4 dropzone, or the "Add files"
  // button once something has been uploaded).
  const fileInput = (
    <input
      type="file"
      accept={ACCEPTED_FILE_TYPES}
      multiple
      onChange={handleFilesSelected}
      className="hidden"
    />
  )

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900">New Bill</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" className="h-6 text-xs" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-6 text-xs"
            disabled={saving || hasOverLimit || draftLoading}
            onClick={handleSaveDraft}
          >
            Save as Draft
          </Button>
          <Button
            type="button"
            className="bg-core text-white h-6 text-xs hover:bg-core/90"
            disabled={saving || hasOverLimit || draftLoading}
            onClick={handleSaveClick}
          >
            {saving ? 'Saving...' : 'Save Bill'}
          </Button>
        </div>
      </div>

      {submitError && <p className="text-xs text-red-600">{submitError}</p>}

      <form className="flex min-h-0 grow flex-col gap-4 overflow-auto lg:overflow-hidden">
        {/* Header inputs. Desktop: 3 on the first line (PO, receipt, supplier
            reference), then bill date + due date on the second. Mobile: PO,
            receipt and reference stack full width; the two dates sit side by
            side to keep this block short. */}
        <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          <label className="col-span-2 text-xs font-medium text-gray-800 lg:col-span-1">
            Purchase Order <span className="text-red-500">*</span>
            <Select value={purchaseOrderId} onValueChange={handlePurchaseOrderChange}>
              <SelectTrigger className="mt-1 h-auto w-full text-sm">
                <SelectValue
                  placeholder={ordersLoading ? 'Loading purchase orders...' : 'Select a purchase order to bill against'}
                />
              </SelectTrigger>
              <SelectContent>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.order_number} — {order.supplier?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ordersError && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                Could not load purchase orders: {ordersError}
              </p>
            )}
          </label>

          <label
            className="col-span-2 text-xs font-medium text-gray-800 lg:col-span-1"
            title="Leave blank for a bill raised before delivery"
          >
            Receipt <span className="font-normal text-gray-400">(optional)</span>
            <Select value={receiptId} onValueChange={setReceiptId} disabled={!purchaseOrderId}>
              <SelectTrigger className="mt-1 h-auto w-full text-sm">
                <SelectValue
                  placeholder={
                    !purchaseOrderId
                      ? 'Select a purchase order first'
                      : receiptsLoading
                        ? 'Loading receipts...'
                        : receipts.length
                          ? 'No specific receipt (optional)'
                          : 'No receipts posted against this PO yet'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {receipts.map((receipt) => (
                  <SelectItem key={receipt.id} value={receipt.id}>
                    {receipt.receipt_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="col-span-2 text-xs font-medium text-gray-800 lg:col-span-1">
            Supplier's invoice/reference number
            <Input
              value={supplierReference}
              onChange={(event) => setSupplierReference(event.target.value)}
              placeholder="As printed on the supplier's invoice"
              className="mt-1 h-auto w-full text-sm"
            />
          </label>

          <label className="text-xs font-medium text-gray-800">
            Bill date
            <Input
              type="date"
              value={billDate}
              onChange={(event) => setBillDate(event.target.value)}
              className="mt-1 h-auto w-full text-sm"
            />
          </label>

          <label className="text-xs font-medium text-gray-800">
            Due date
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="mt-1 h-auto w-full text-sm"
            />
          </label>
        </div>

        {/* Body. Desktop: fixed left panel (~25%) + the one scrollable right
            column (~75%). Mobile: stacked, page scrolls as a whole. */}
        <div className="flex flex-col gap-4 lg:grid lg:min-h-0 lg:grow lg:grid-cols-[minmax(0,1fr)_minmax(0,4fr)] lg:grid-rows-[minmax(0,1fr)]">
          {/* LEFT - supplier invoice / screenshot (fixed, F4 proportions) */}
          <section className="flex flex-col gap-2 lg:min-h-0">
            <div className="flex shrink-0 flex-col items-start gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-800">Supplier invoice / screenshot</h2>
                <p className="mt-0.5 text-[11px] leading-4 text-gray-500">
                  Upload supplier documents (image, PDF or docs)
                </p>
              </div>

              {hasAttachments && (
                <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50">
                  <Upload className="h-3.5 w-3.5" />
                  Add files
                  {fileInput}
                </label>
              )}
            </div>

            {fileError && (
              <p className="shrink-0 whitespace-pre-line text-[11px] text-red-600">{fileError}</p>
            )}

            {/* F4 (210 x 330) page. On desktop its height fills whatever the
                panel has left and the width follows from the ratio, pinned to
                the left. On mobile, once a file is added, the large preview is
                hidden (only the name row and thumbnails below are shown). */}
            <div className="relative lg:min-h-0 lg:flex-1">
              {!hasAttachments ? (
                <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-4 text-center hover:bg-gray-50 sm:h-40 lg:absolute lg:inset-y-0 lg:left-0 lg:h-auto lg:aspect-[210/330] lg:w-auto lg:max-w-full">
                  <Upload className="h-5 w-5 text-gray-400" />
                  <span className="text-xs text-gray-600">
                    Click to upload one or more files (images, PDF or Word)
                  </span>
                  {fileInput}
                </label>
              ) : (
                activeEntry && (
                  <div className="relative hidden h-48 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 sm:h-64 lg:absolute lg:inset-y-0 lg:left-0 lg:block lg:h-auto lg:aspect-[210/330] lg:w-auto lg:max-w-full">
                    {!isImage(activeEntry.file) ? (
                      <FileMedia file={activeEntry.file} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        className="block h-full w-full cursor-zoom-in"
                        aria-label="View larger"
                      >
                        <FileMedia file={activeEntry.file} />
                      </button>
                    )}

                    <div className="absolute right-2 top-2 flex gap-1.5">
                      {isPreviewable(activeEntry.file) && (
                        <button
                          type="button"
                          onClick={() => setPreviewOpen(true)}
                          className="rounded-md bg-white/90 p-1.5 text-gray-600 shadow-sm hover:text-gray-900"
                          aria-label="View larger"
                          title="View larger"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(activeEntry.file)}
                        className="rounded-md bg-white/90 p-1.5 text-gray-600 shadow-sm hover:text-red-600"
                        aria-label="Remove attachment"
                        title="Remove attachment"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            {hasAttachments && activeEntry && (
              <div className="flex shrink-0 flex-col gap-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-gray-700" title={activeEntry.file.name}>
                    {activeEntry.file.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`truncate ${activeStatus.text}`} title={activeStatus.label}>
                      {activeStatus.label}
                    </span>
                    {/* Mobile only: the remove button inside the (hidden) large preview isn't reachable here. */}
                    <button
                      type="button"
                      onClick={() => removeAttachment(activeEntry.file)}
                      className="text-gray-400 hover:text-red-600 lg:hidden"
                      aria-label="Remove attachment"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                </div>

                {/* Thumbnail strip: on desktop only with 2+ files; on mobile always
                    (even for a single file), since it replaces the large preview. */}
                <div
                  className={`gap-2 overflow-x-auto pb-1 ${
                    attachments.length > 1 ? 'flex' : 'flex lg:hidden'
                  }`}
                >
                  {attachments.map((entry) => {
                    const isActive = entry.file === activeEntry.file
                    const status = getEntryStatus(entry)
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setActiveFile(entry.file)}
                        title={entry.file.name}
                        className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-gray-50 ${
                          isActive ? 'border-core ring-2 ring-core/30' : 'border-gray-200 opacity-80 hover:opacity-100'
                        }`}
                      >
                        {isImage(entry.file) ? (
                          <FileMedia file={entry.file} />
                        ) : (
                          <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-gray-500">
                            <FileText className="h-4 w-4" />
                            <span className="w-full truncate text-center text-[8px]">{entry.file.name}</span>
                          </span>
                        )}
                        <span className={`absolute bottom-1 right-1 h-2 w-2 rounded-full ring-1 ring-white ${status.dot}`} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {draftId && (
              <div className="flex shrink-0 flex-col gap-1">
                <p className="text-[11px] font-medium text-gray-700">Already saved with this draft</p>
                <AttachmentList
                  entityType="purchase_bill_draft"
                  entityId={draftId}
                  companyId={companyId}
                  branchId={branchId}
                  moduleKey="purchases-bills"
                  canDelete
                  reloadKey={draftFilesKey}
                />
              </div>
            )}
          </section>

          {/* RIGHT - the only scrollable region on desktop: PO balance, line
              items, then subtotal/tax/total and notes at the end. */}
          <section className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            {purchaseOrderId && (
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                <h2 className="text-xs font-semibold text-gray-800">This Purchase Order's balance</h2>
                {balanceLoading || !balance ? (
                  <p className="mt-2 text-xs text-gray-400">Loading balance...</p>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div>
                      <p className="text-[11px] text-gray-500">Ordered</p>
                      <p className="text-sm font-medium text-gray-800">{formatNaira(balance.ordered_total)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">Received</p>
                      <p className="text-sm font-medium text-gray-800">{formatNaira(balance.received_total)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">Already billed</p>
                      <p className="text-sm font-medium text-gray-800">{formatNaira(balance.billed_total)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">Already paid</p>
                      <p className="text-sm font-medium text-gray-800">{formatNaira(balance.paid_total)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">Received, not billed (GRNI)</p>
                      <p className="text-sm font-medium text-amber-700">{formatNaira(balance.grni_total)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {purchaseOrderId && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-800">Line items</h2>
                <p className="text-xs text-gray-500">
                  Select the lines to bill. Leave Billing price blank to use the Estimated price.
                </p>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full min-w-[860px] text-xs">
                    <thead className="bg-gray-50 text-[11px] text-gray-600">
                      <tr>
                        <th className="w-9 px-3 py-2 text-left">
                          <Checkbox
                            checked={allLinesSelected ? true : hasAnySelected ? 'indeterminate' : false}
                            onCheckedChange={(checked) => toggleAllLines(checked === true)}
                            aria-label="Select all line items"
                          />
                        </th>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-right">Ordered</th>
                        <th className="px-3 py-2 text-right">Received</th>
                        <th className="px-3 py-2 text-right">Billed so far</th>
                        <th className="px-3 py-2 text-right">Billing qty</th>
                        <th className="px-3 py-2 text-right">Estimated price</th>
                        <th className="px-3 py-2 text-right">Billing price</th>
                        <th className="px-3 py-2 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {billableLines.map((line) => (
                        <tr
                          key={line.id}
                          className={
                            line.fullyBilled ? 'bg-gray-50/70 opacity-60' : line.isSelected ? 'bg-core/5' : ''
                          }
                        >
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={line.isSelected}
                              disabled={line.fullyBilled}
                              onCheckedChange={(checked) => toggleLine(line, checked === true)}
                              aria-label="Select line item to bill"
                            />
                          </td>
                          <td className="max-w-[220px] px-3 py-2">
                            <p
                              className="text-[10px] leading-[1.15] text-gray-800"
                              title={line.displayName}
                            >
                              {line.displayName || '—'}
                            </p>
                            {line.fullyBilled && (
                              <p className="text-[9px] leading-[1.15] text-gray-500">Fully billed</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{line.quantity_ordered}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{line.quantity_received}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{line.quantity_billed}</td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              max={line.billable}
                              disabled={!line.isSelected}
                              value={lineQuantities[line.id] ?? ''}
                              onChange={(event) =>
                                setLineQuantities((prev) => ({ ...prev, [line.id]: event.target.value }))
                              }
                              aria-invalid={line.overLimit}
                              title={
                                line.overLimit
                                  ? `Only ${line.billable} left to bill on this line`
                                  : undefined
                              }
                              className={`h-7 w-24 text-right text-xs ${
                                line.overLimit
                                  ? 'border-red-500 text-red-600 focus-visible:ring-red-500'
                                  : ''
                              }`}
                            />
                            {line.overLimit && (
                              <p className="mt-0.5 text-[10px] text-red-600">Max {line.billable}</p>
                            )}
                          </td>
                          <td
                            className={`px-3 py-2 text-right ${
                              line.isSelected && line.hasBillingPrice
                                ? 'text-gray-400 line-through'
                                : 'text-gray-600'
                            }`}
                          >
                            {formatNaira(line.unit_cost_snapshot || 0)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={!line.isSelected}
                              value={linePrices[line.id] ?? ''}
                              placeholder={String(line.unit_cost_snapshot ?? '')}
                              onChange={(event) =>
                                setLinePrices((prev) => ({ ...prev, [line.id]: event.target.value }))
                              }
                              className="h-7 w-28 text-right text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-800">
                            {line.isSelected ? formatNaira(line.lineTotal) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {linesAheadOfReceipts.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
                    <p className="font-medium">Billing ahead of delivery</p>
                    <ul className="mt-0.5 list-disc pl-4">
                      {linesAheadOfReceipts.map((line) => (
                        <li key={line.id}>
                          {line.displayName || 'Item'}: {line.aheadOfReceipts} of {line.quantity} not
                          received yet ({line.quantity_received || 0} received of {line.quantity_ordered} ordered)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3 sm:grid-cols-3 sm:items-end sm:gap-4">
              <div>
                <p className="text-xs font-medium text-gray-700">Subtotal (from selected line items)</p>
                <p className="mt-1 text-sm text-gray-800">{formatNaira(subtotal)}</p>
              </div>

              <label className="text-xs font-medium text-gray-700">
                Tax / VAT
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tax}
                  onChange={(event) => setTax(event.target.value)}
                  className="mt-1 h-auto w-full bg-white text-sm"
                />
              </label>

              <div className="flex flex-col gap-0.5 border-t border-gray-200 pt-3 sm:border-t-0 sm:pt-0 sm:text-right">
                <span className="text-xs font-medium text-gray-700">Total</span>
                <span className="text-xl font-bold tracking-tight text-slate-900">{formatNaira(total)}</span>
              </div>
            </div>

            <label className="text-xs font-medium text-gray-700">
              Notes
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Discrepancies against the receipt, payment instructions, etc..."
                className="mt-1 min-h-32 bg-white text-xs"
              />
            </label>
          </section>
        </div>
      </form>

      {/* Review before saving: shown when a price differs from the Purchase
          Order, or goods are being billed before they have arrived. */}
      <AlertDialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Review before saving this bill</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This bill differs from the Purchase Order in the ways below. Nothing is saved until you
              press Save Bill.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1 text-xs">
            {linesAheadOfReceipts.length > 0 && (
              <div>
                <p className="mb-1 font-semibold text-amber-800">Billing ahead of delivery</p>
                <p className="mb-1.5 text-[11px] text-gray-500">
                  You are billing for goods that have not been received yet.
                </p>
                <table className="w-full text-[11px]">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="py-1 text-left font-medium">Item</th>
                      <th className="py-1 text-right font-medium">Billing on this bill</th>
                      <th className="py-1 text-right font-medium">Received so far</th>
                      <th className="py-1 text-right font-medium">Not yet received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {linesAheadOfReceipts.map((line) => (
                      <tr key={line.id}>
                        <td className="py-1 pr-2 text-gray-800">{line.displayName || 'Item'}</td>
                        <td className="py-1 text-right">{line.quantity}</td>
                        <td className="py-1 text-right">{line.quantity_received || 0}</td>
                        <td className="py-1 text-right font-medium text-amber-700">{line.aheadOfReceipts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {priceDifferences.length > 0 && (
              <div>
                <p className="mb-1 font-semibold text-gray-800">Price differs from the Purchase Order</p>
                <p className="mb-1.5 text-[11px] text-gray-500">
                  Difference is the billing price minus the Purchase Order price, per unit.
                </p>
                <table className="w-full text-[11px]">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="py-1 text-left font-medium">Item</th>
                      <th className="py-1 text-right font-medium">PO price</th>
                      <th className="py-1 text-right font-medium">Billing price</th>
                      <th className="py-1 text-right font-medium">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {priceDifferences.map((row) => {
                      const higher = row.difference > 0
                      return (
                        <tr key={row.id}>
                          <td className="py-1 pr-2 text-gray-800">{row.name}</td>
                          <td className="py-1 text-right">{formatNaira(row.estimated)}</td>
                          <td className="py-1 text-right">{formatNaira(row.billed)}</td>
                          <td className={`py-1 text-right font-medium ${higher ? 'text-red-600' : 'text-emerald-600'}`}>
                            {higher ? '+' : '-'}
                            {formatNaira(Math.abs(row.difference))}
                            {row.percent === null
                              ? ''
                              : ` (${higher ? '+' : '-'}${Math.abs(row.percent).toFixed(2)}%)`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 bg-gray-50/60 p-2.5">
                  <Checkbox
                    checked={updateEstimates}
                    onCheckedChange={(checked) => setUpdateEstimates(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="text-[11px] leading-4 text-gray-700">
                    <span className="font-medium text-gray-900">
                      Also update the estimated cost price of {priceDifferences.length === 1 ? 'this product' : 'these products'}
                    </span>
                    <br />
                    The billing price above becomes each product's estimated cost price for future
                    Purchase Orders. Products priced in a different currency, or that you can't edit,
                    are left unchanged.
                  </span>
                </label>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">Go back</AlertDialogCancel>
            <AlertDialogAction
              className="h-7 bg-core text-xs text-white hover:bg-core/90"
              disabled={saving}
              onClick={() => handleSubmit(null, 'unpaid')}
            >
              Save Bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shown after the bill is saved, when there is something to tell the
          user (flags from the server, files that failed, estimate update). */}
      <AlertDialog
        open={!!notice}
        onOpenChange={(open) => {
          if (!open && notice) {
            const target = notice.redirectTo
            setNotice(null)
            router.push(target)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">{notice?.title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="list-disc space-y-1 pl-4 text-xs text-gray-700">
                {(notice?.lines || []).map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="h-7 bg-core text-xs text-white hover:bg-core/90">
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewOpen && !!activeEntry} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6 text-sm">{activeEntry?.file.name}</DialogTitle>
            <DialogDescription className="text-xs">
              {activeEntry
                ? [
                    fileKindLabel(activeEntry.file),
                    formatFileSize(activeEntry.file.size),
                    activeStatus?.label,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : ''}
            </DialogDescription>
          </DialogHeader>
          {activeEntry && (
            <div className="h-[70vh] w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50">
              <FileMedia file={activeEntry.file} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}