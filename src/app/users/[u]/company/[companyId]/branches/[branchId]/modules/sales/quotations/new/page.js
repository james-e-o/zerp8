'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, FileDown, Mail, Send } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import QuotationLineItemsTable from '@/components/modules/sales/quotation-line-items-table'
import { emptyQuotationLine } from '@/components/modules/sales/dummy-product-variants'
import { DUMMY_CUSTOMERS, formatNaira } from '@/components/modules/sales/dummy-data'
import { useQuotationCatalog, resolveQuotationPrice } from '@/components/modules/sales/quotation-catalog'

const VAT_RATE = 0.075 // 7.5% — adjust or make configurable per branch later

// Generates a client-side placeholder reference (e.g. QT-260925-4K2P).
// Replace with a real sequential number from the DB once the quotations
// table/RPC is wired up — this is just so the document isn't reference-less.
const generateQuotationNumber = () => {
  const date = new Date()
  const stamp = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `QT-${stamp}-${rand}`
}

export default function NewQuotationPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`

  const [quotationNumber, setQuotationNumber] = useState('')
  const [customerId, setCustomerId] = useState(DUMMY_CUSTOMERS[0]?.id || '')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState([emptyQuotationLine()])
  const [saving, setSaving] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [sendMode, setSendMode] = useState('choose')
  const [sending, setSending] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sendMessage, setSendMessage] = useState('Please find our quotation attached.')
  const [discountType, setDiscountType] = useState('amount')
  const [discountValue, setDiscountValue] = useState(0)
  const [applyVat, setApplyVat] = useState(true)
  const [notes, setNotes] = useState('')
  const { contexts, defaultContext, catalog, pricingRules, loading: catalogLoading, error: catalogError, warning: catalogWarning } = useQuotationCatalog(branchId)
  const [pricingContextId, setPricingContextId] = useState('')

  useEffect(() => {
    setQuotationNumber(generateQuotationNumber())
  }, [])

  useEffect(() => {
    if (defaultContext?.id && !pricingContextId) setPricingContextId(defaultContext.id)
  }, [defaultContext, pricingContextId])

  useEffect(() => {
    if (!pricingContextId) return
    setItems((current) => current.map((item) => {
      const variant = catalog.find((entry) => entry.id === item.variantId)
      return variant ? { ...item, unitPrice: resolveQuotationPrice(variant, pricingContextId, pricingRules, item.qty) } : item
    }))
  }, [catalog, pricingContextId, pricingRules])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0), [items])
  const lineDiscountTotal = useMemo(() => items.reduce((sum, item) => sum + getLineDiscount(item), 0), [items])
  const lineTotal = subtotal - lineDiscountTotal
  const documentDiscount = discountType === 'percentage'
    ? lineTotal * Math.min(100, Math.max(0, Number(discountValue || 0))) / 100
    : Math.min(lineTotal, Math.max(0, Number(discountValue || 0)))
  const taxableAmount = Math.max(0, lineTotal - documentDiscount)
  const vatAmount = applyVat ? taxableAmount * VAT_RATE : 0
  const total = taxableAmount + vatAmount

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    // TODO: replace with real insert once the quotations RPC/table is wired up
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSaving(false)
    router.push(base)
  }

  const handleSend = async (event) => {
    event.preventDefault()
    setSending(true)
    // TODO: generate the PDF, persist the quotation snapshot, and email it.
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSending(false)
    setSendOpen(false)
    router.push(base)
  }

  const handleExport = async () => {
    setExporting(true)
    // TODO: generate and download the quotation PDF.
    await new Promise((resolve) => setTimeout(resolve, 500))
    setExporting(false)
    setSendOpen(false)
    setSendMode('choose')
  }

  const openExportMode = () => setSendMode('export')

  const handleSheetChange = (open) => {
    setSendOpen(open)
    if (!open) setSendMode('choose')
  }

  return (
    <div className="w-full max-w-none flex-col flex overflow-hidden grow space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">New Quotation</h1>
          <p className="text-xs text-gray-500">{quotationNumber}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="submit" form="quotation-form" variant="outline" disabled={saving || sending}>Save as Draft</Button>
          <Button type="button" className="gap-2 bg-core text-white" disabled={saving || sending || exporting} onClick={() => setSendOpen(true)}>
            <Send className="size-4" /> 
          </Button>
        </div>
      </div>

      <form id="quotation-form" onSubmit={handleSubmit} className="flex min-h-0 grow flex-col justify-between gap-2 overflow-hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <label className="text-xs font-medium text-gray-800">
            Customer
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm"><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>{DUMMY_CUSTOMERS.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="text-xs font-medium text-gray-800">
            Valid until
            <Input
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-core focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-gray-800">
            Pricing context
            <Select value={pricingContextId} onValueChange={setPricingContextId} disabled={catalogLoading || contexts.length === 0}>
              <SelectTrigger className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm"><SelectValue placeholder="Select pricing context" /></SelectTrigger>
              <SelectContent>{contexts.map((context) => <SelectItem key={context.id} value={context.id}>{context.name}{context.is_default ? ' (Standard)' : ''}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>

        <div className="min-h-0 grow overflow-hidden">
          {catalogError && <p className="mb-2 text-xs text-red-600">{catalogError}</p>}
          {!catalogError && catalogWarning && <p className="mb-2 text-xs text-amber-600">{catalogWarning}</p>}
          {catalogLoading ? <p className="text-xs text-gray-500">Loading products and pricing contexts...</p> : <QuotationLineItemsTable items={items} setItems={setItems} catalog={catalog} contexts={contexts} pricingContextId={pricingContextId} pricingRules={pricingRules} />}
        </div>

        {/* Elegant summary / footer */}
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50/60 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800">
              <span>Document discount</span>
              <Select value={discountType} onValueChange={setDiscountType}>
                <SelectTrigger className="h-8 w-24 bg-white px-2 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="percentage">Percent</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                value={discountValue}
                onChange={(event) => setDiscountValue(Number(event.target.value))}
                className="h-8 w-24 bg-white px-2 text-xs"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={applyVat}
                onChange={(event) => setApplyVat(event.target.checked)}
                className="size-3.5 rounded border-gray-300 text-core focus:ring-core"
              />
              Apply VAT ({(VAT_RATE * 100).toFixed(1)}%)
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Terms &amp; notes
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Payment terms, delivery notes, bank details..."
                className="mt-1 min-h-20 bg-white text-xs"
              />
            </label>
          </div>

          <div className="w-full max-w-xs shrink-0 space-y-1.5 sm:ml-auto">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Subtotal</span>
              <span className="font-medium text-gray-700">{formatNaira(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Line discounts</span>
              <span className="font-medium text-gray-700">-{formatNaira(lineDiscountTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Document discount</span>
              <span className="font-medium text-gray-700">-{formatNaira(documentDiscount)}</span>
            </div>
            {applyVat && (
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>VAT ({(VAT_RATE * 100).toFixed(1)}%)</span>
                <span className="font-medium text-gray-700">+{formatNaira(vatAmount)}</span>
              </div>
            )}
            <div className="my-2 border-t border-dashed border-gray-300" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Total</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">{formatNaira(total)}</span>
            </div>
          </div>
        </div>
      </form>

      <Sheet open={sendOpen} onOpenChange={handleSheetChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{sendMode === 'email' ? 'Send Quotation' : 'Quotation actions'}</SheetTitle>
            <SheetDescription>
              {sendMode === 'email' ? 'Review the recipient and message before sending this quotation.' : 'Choose how you want to share this quotation.'}
            </SheetDescription>
          </SheetHeader>
          {sendMode === 'choose' ? (
            <div className="flex flex-col gap-3 px-4 pt-4">
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 px-4 py-4 text-left" onClick={() => setSendMode('email')}>
                <Mail className="size-5 text-core" />
                <span><span className="block font-semibold">Send by email</span><span className="block text-xs font-normal text-gray-500">Email this quotation to a recipient.</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 px-4 py-4 text-left" onClick={openExportMode}>
                <FileDown className="size-5 text-core" />
                <span><span className="block font-semibold">Export as PDF</span><span className="block text-xs font-normal text-gray-500">Download a PDF copy of this quotation.</span></span>
              </Button>
            </div>
          ) : sendMode === 'export' ? (
            <div className="flex flex-1 flex-col gap-5 px-4 pt-4">
              <Button type="button" variant="ghost" className="w-fit gap-2 px-0 text-gray-600 hover:text-gray-900" onClick={() => setSendMode('choose')}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <p className="font-semibold text-gray-800">Quotation summary</p>
                <p className="mt-1">{quotationNumber}</p>
                <p>{items.length} line item{items.length === 1 ? '' : 's'}</p>
                <p>Total: {formatNaira(total)}</p>
                {validUntil && <p>Valid until: {validUntil}</p>}
              </div>
              <SheetFooter className="mt-auto px-0">
                <Button type="button" className="w-full gap-2 bg-core text-white" onClick={handleExport} disabled={exporting}>
                  <FileDown className="size-4" /> {exporting ? 'Exporting...' : 'Export as PDF'}
                </Button>
              </SheetFooter>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex flex-1 flex-col gap-5 px-4">
              <Button type="button" variant="ghost" className="w-fit gap-2 px-0 text-gray-600 hover:text-gray-900" onClick={() => setSendMode('choose')}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <label className="text-sm font-medium text-gray-800">Recipient email
                <Input type="email" required value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="customer@example.com" className="mt-1" />
              </label>
              <label className="text-sm font-medium text-gray-800">Message
                <Textarea value={sendMessage} onChange={(event) => setSendMessage(event.target.value)} className="mt-1 min-h-28" />
              </label>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <p className="font-semibold text-gray-800">Quotation summary</p>
                <p className="mt-1">{quotationNumber}</p>
                <p>{items.length} line item{items.length === 1 ? '' : 's'}</p>
                <p>Total: {formatNaira(total)}</p>
                {validUntil && <p>Valid until: {validUntil}</p>}
              </div>
              <SheetFooter className="mt-auto px-0">
                <Button type="submit" className="ml-auto size-10 gap-2 bg-core p-0 text-white" disabled={sending} aria-label={sending ? 'Sending quotation' : 'Send quotation'} title={sending ? 'Sending quotation' : 'Send quotation'}>
                  <Send className="size-4" />
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function getLineDiscount(item) {
  const subtotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
  return item.discountType === 'percentage'
    ? subtotal * Math.min(100, Math.max(0, Number(item.discountValue || 0))) / 100
    : Math.min(subtotal, Math.max(0, Number(item.discountValue || 0)))
}