'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { X, Upload } from 'lucide-react'

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
import { formatNaira } from '@/components/modules/sales/dummy-data'
import { useBillableReceipts } from './purchase-catalog'

const generateBillNumber = () => {
  const date = new Date()
  const stamp = `${String(date.getFullYear()).slice(2)}${String(
    date.getMonth() + 1
  ).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `BILL-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
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

  const [billNumber] = useState(generateBillNumber)
  const [receiptId, setReceiptId] = useState('')
  const [supplierReference, setSupplierReference] = useState('')
  const [billDate, setBillDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [tax, setTax] = useState('')
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState([]) // { file, uploading, url, error }
  const [saving, setSaving] = useState(false)

  const { receipts, loading: receiptsLoading } = useBillableReceipts(
    branchId
  )

  const selectedReceipt = receipts.find((receipt) => receipt.id === receiptId)

  const total = Number(subtotal || 0) + Number(tax || 0)

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
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            New Bill
          </h1>
          <p className="text-xs text-gray-500">{billNumber}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={(event) => handleSubmit(event, 'draft')}
          >
            Save as Draft
          </Button>

          <Button
            type="button"
            className="bg-core text-white"
            disabled={saving}
            onClick={(event) => handleSubmit(event, 'unpaid')}
          >
            {saving ? 'Saving...' : 'Save Bill'}
          </Button>
        </div>
      </div>

      <form className="flex min-h-0 grow flex-col gap-4 overflow-auto">
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

        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-800">
            Supplier invoice / screenshot
          </h2>
          <p className="mb-2 text-xs text-gray-500">
            Upload a photo or scan of what the supplier sent. Enter the totals
            from it manually below — amounts are not read automatically.
          </p>

          <label className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-6 py-8 text-center hover:bg-gray-50">
            <Upload className="h-5 w-5 text-gray-400" />
            <span className="text-xs text-gray-600">
              Click to upload one or more files (images or PDF)
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
          </label>

          {attachments.length > 0 && (
            <ul className="mt-2 space-y-1">
              {attachments.map((entry, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs"
                >
                  <span className="truncate text-gray-700">
                    {entry.file.name}
                    {entry.uploading && ' — uploading...'}
                    {entry.error && (
                      <span className="text-red-600"> — {entry.error}</span>
                    )}
                    {entry.url && !entry.uploading && !entry.error && (
                      <span className="text-emerald-600"> — uploaded</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(entry.file)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-gray-50/60 p-5 sm:grid-cols-3">
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

          <div className="flex flex-col justify-end">
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
            className="mt-1 min-h-20 bg-white text-xs"
          />
        </label>
      </form>
    </div>
  )
}
