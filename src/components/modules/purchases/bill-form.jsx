'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { X, Upload, FileText, Maximize2 } from 'lucide-react'

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import supabase from '@/config/supabaseClient'
import { formatNaira } from '@/components/modules/sales/dummy-data'
import { useBillableReceipts } from './purchase-catalog'

const generateBillNumber = () => {
  const date = new Date()
  const stamp = `${String(date.getFullYear()).slice(2)}${String(
    date.getMonth() + 1
  ).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `BILL-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

const isPdf = (file) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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

function FileMedia({ file }) {
  const url = useObjectUrl(file)
  if (!url) return null

  if (isPdf(file)) {
    return <iframe src={url} title={file.name} className="h-full w-full border-0" />
  }
  return <img src={url} alt={file.name} className="h-full w-full object-contain" />
}

// Bills always reference a Receipt (and, through it, a Purchase Order) —
// there is no standalone bill. What the supplier actually charged is
// captured two ways: the raw invoice/screenshot as an attachment (for
// record-keeping and dispute resolution) AND the totals typed in manually,
// since we can't reliably assume OCR accuracy on a supplier's own document.

export default function BillForm() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/bills`

  // Generated client-side only, after mount — Math.random() inside a
  // useState lazy initializer runs once during SSR and again during
  // client hydration, producing two different values and a hydration
  // mismatch (same issue already fixed in receipt-form.jsx).
  const [billNumber, setBillNumber] = useState('')
  const [receiptId, setReceiptId] = useState('')
  const [supplierReference, setSupplierReference] = useState('')
  const [billDate, setBillDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [tax, setTax] = useState('')
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState([]) // { file, uploading, url, error }
  const [saving, setSaving] = useState(false)

  // Which attachment is shown large in the viewer, and whether the
  // enlarged dialog is open. Display-only - nothing here is submitted.
  const [activeFile, setActiveFile] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    setBillNumber(generateBillNumber())
  }, [])

  const { receipts, loading: receiptsLoading } = useBillableReceipts(
    branchId
  )

  const selectedReceipt = receipts.find((receipt) => receipt.id === receiptId)

  const total = Number(subtotal || 0) + Number(tax || 0)

  const hasAttachments = attachments.length > 0
  const activeEntry =
    attachments.find((item) => item.file === activeFile) || attachments[0] || null
  const activeStatus = activeEntry ? getEntryStatus(activeEntry) : null

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const newEntries = files.map((file) => ({
      file,
      uploading: true,
      url: null,
      error: null,
    }))

    setAttachments((prev) => [...prev, ...newEntries])
    // Show the first newly-added file large; the rest sit in the thumbnail strip.
    setActiveFile(newEntries[0].file)

    // Upload each file to a Supabase Storage bucket, e.g. 'bill-attachments'.
    // Bucket path convention: {companyId}/{branchId}/{billNumber}/{filename}
    for (const entry of newEntries) {
      const path = `${companyId}/${branchId}/${billNumber}/${Date.now()}-${entry.file.name}`

      const { data, error } = await supabase.storage
        .from('bill-attachments')
        .upload(path, entry.file)

      setAttachments((prev) =>
        prev.map((item) =>
          item.file === entry.file
            ? {
                ...item,
                uploading: false,
                url: error ? null : data?.path,
                error: error?.message || null,
              }
            : item
        )
      )
    }

    event.target.value = ''
  }

  const removeAttachment = (file) => {
    setAttachments((prev) => prev.filter((item) => item.file !== file))
  }

  const handleSubmit = async (event, submitStatus) => {
    event.preventDefault()

    if (!receiptId) {
      alert('A Bill must reference an existing Receipt / Purchase Order.')
      return
    }
    if (!subtotal) {
      alert('Enter the amounts from the supplier invoice.')
      return
    }

    setSaving(true)

    // TODO: wire to Supabase insert into bills (+ bill_attachments rows
    // pointing at the uploaded storage paths from `attachments`).
    await new Promise((resolve) => setTimeout(resolve, 500))

    setSaving(false)
    router.push(base)
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900">
            New Bill
          </h1>
          <p className="text-xs text-gray-500">{billNumber}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" className="h-7 text-xs hover:bg-red-300" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>

          <Button
            type="button"
            className="bg-core_light h-7 text-xs text-black"
            variant="outline"
            disabled={saving}
            onClick={(event) => handleSubmit(event, 'draft')}
          >
            Save as Draft
          </Button>

          <Button
            type="button"
            className="bg-core hover:bg-core/80 h-7 text-white text-xs"
            disabled={saving}
            onClick={(event) => handleSubmit(event, 'unpaid')}
          >
            {saving ? 'Saving...' : 'Save Bill'}
          </Button>
        </div>
      </div>

      <form className="flex min-h-0 grow flex-col gap-4 overflow-auto lg:overflow-hidden">
        {/* Header fields - full width, unchanged */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-800">
            Purchase Order / Receipt <span className="text-red-500">*</span>
            <Select value={receiptId} onValueChange={setReceiptId}>
              <SelectTrigger className="mt-1 h-auto w-full text-sm">
                <SelectValue
                  placeholder={
                    receiptsLoading
                      ? 'Loading receipts...'
                      : 'Select a posted receipt to bill against'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {receipts.map((receipt) => (
                  <SelectItem key={receipt.id} value={receipt.id}>
                    {receipt.receipt_number} — {receipt.purchase_order?.order_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="text-xs font-medium text-gray-800">
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

        {/* Split: invoice upload + viewer (left) | amounts + notes (right).
            Stacked on mobile, side by side from lg up. */}
        <div className="flex flex-col gap-6 lg:grid lg:min-h-0 lg:grow lg:grid-cols-2">
          {/* LEFT - supplier invoice / screenshot */}
          <section className="flex flex-col gap-3 lg:min-h-0">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Supplier invoice / screenshot
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Upload a photo or scan of what the supplier sent. Enter the
                totals from it manually — amounts are not read automatically.
              </p>
            </div>

            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 text-center hover:bg-gray-50 ${
                hasAttachments
                  ? 'flex-row px-4 py-2.5'
                  : 'flex-col px-6 py-10 lg:flex-1'
              }`}
            >
              <Upload className="h-5 w-5 text-gray-400" />
              <span className="text-xs text-gray-600">
                {hasAttachments
                  ? 'Add more files'
                  : 'Click to upload one or more files (images or PDF)'}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </label>

            {hasAttachments && activeEntry && (
              <div className="flex flex-col gap-2 lg:min-h-0 lg:flex-1">
                {/* Large preview - fills the remaining height on desktop */}
                <div className="relative h-80 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 sm:h-96 lg:h-auto lg:min-h-0 lg:flex-1">
                  {isPdf(activeEntry.file) ? (
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
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(true)}
                      className="rounded-md bg-white/90 p-1.5 text-gray-600 shadow-sm hover:text-gray-900"
                      aria-label="View larger"
                      title="View larger"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
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

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-gray-700" title={activeEntry.file.name}>
                    {activeEntry.file.name}
                  </span>
                  <span className={`shrink-0 truncate ${activeStatus.text}`} title={activeStatus.label}>
                    {activeStatus.label}
                  </span>
                </div>

                {/* Minimized files - click one to make it the large preview */}
                {attachments.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {attachments.map((entry, index) => {
                      const isActive = entry.file === activeEntry.file
                      const status = getEntryStatus(entry)
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setActiveFile(entry.file)}
                          title={entry.file.name}
                          className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-gray-50 ${
                            isActive
                              ? 'border-core ring-2 ring-core/30'
                              : 'border-gray-200 opacity-80 hover:opacity-100'
                          }`}
                        >
                          {isPdf(entry.file) ? (
                            <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-gray-500">
                              <FileText className="h-5 w-5" />
                              <span className="w-full truncate text-center text-[9px]">
                                {entry.file.name}
                              </span>
                            </span>
                          ) : (
                            <FileMedia file={entry.file} />
                          )}
                          <span
                            className={`absolute bottom-1 right-1 h-2 w-2 rounded-full ring-1 ring-white ${status.dot}`}
                          />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* RIGHT - amounts + notes */}
          <section className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto">
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-gray-50/60 p-5 sm:grid-cols-2">
              <label className="text-xs font-medium text-gray-700">
                Subtotal (from invoice) <span className="text-red-500">*</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={subtotal}
                  onChange={(event) => setSubtotal(event.target.value)}
                  className="mt-1 h-auto w-full bg-white text-sm"
                />
              </label>

              <label className="text-xs font-medium text-gray-700">
                Tax / VAT (from invoice)
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tax}
                  onChange={(event) => setTax(event.target.value)}
                  className="mt-1 h-auto w-full bg-white text-sm"
                />
              </label>

              <div className="flex flex-col gap-1 border-t border-gray-200 pt-4 sm:col-span-2">
                <span className="text-xs font-medium text-gray-700">Total</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900">
                  {formatNaira(total)}
                </span>
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

      {/* Enlarged view of the active attachment */}
      <Dialog open={previewOpen && !!activeEntry} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6 text-sm">
              {activeEntry?.file.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {activeEntry
                ? [
                    isPdf(activeEntry.file) ? 'PDF' : activeEntry.file.type || 'File',
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