'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import InvoiceLineItemsTable from '@/components/modules/sales/invoice-line-items-table'
import { DUMMY_ORDERS, formatNaira } from '@/components/modules/sales/dummy-data'
import { useQuotationCatalog } from '@/components/modules/sales/quotation-catalog'

const VAT_RATE = 0.075

export default function InvoiceNewForm({ documentType }) {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const searchParams = useSearchParams()
  const isProforma = documentType === 'proforma'
  const [orderId, setOrderId] = useState(searchParams.get('orderId') || DUMMY_ORDERS[0]?.id || '')
  const [documentDate, setDocumentDate] = useState('')
  const [items, setItems] = useState(() => createInvoiceItems(DUMMY_ORDERS.find((item) => item.id === (searchParams.get('orderId') || DUMMY_ORDERS[0]?.id || ''))))
  const [discountType, setDiscountType] = useState('amount')
  const [discountValue, setDiscountValue] = useState(0)
  const [applyVat, setApplyVat] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { contexts, defaultContext } = useQuotationCatalog(branchId)
  const invoicesPath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices`

  useEffect(() => {
    if (!defaultContext?.id) return
    setItems((current) => current.map((item) => ({ ...item, pricingContextId: item.pricingContextId || defaultContext.id })))
  }, [defaultContext])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0), [items])
  const lineDiscountTotal = useMemo(() => items.reduce((sum, item) => sum + getLineDiscount(item), 0), [items])
  const lineTotal = subtotal - lineDiscountTotal
  const documentDiscount = discountType === 'percentage' ? lineTotal * Math.min(100, Math.max(0, Number(discountValue || 0))) / 100 : Math.min(lineTotal, Math.max(0, Number(discountValue || 0)))
  const taxableAmount = Math.max(0, lineTotal - documentDiscount)
  const vatAmount = applyVat ? taxableAmount * VAT_RATE : 0
  const total = taxableAmount + vatAmount

  const onOrderChange = (nextOrderId) => {
    setOrderId(nextOrderId)
    setItems(createInvoiceItems(DUMMY_ORDERS.find((item) => item.id === nextOrderId)))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSaving(false)
    router.push(invoicesPath)
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="text-lg font-bold tracking-tight text-slate-900">New {isProforma ? 'Proforma Invoice' : 'Sales Invoice'}</h1><p className="text-xs text-gray-500">{isProforma ? 'Prepare a preliminary invoice from a sales order.' : 'Create an official invoice from delivered order items.'}</p></div>
        <div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button><Button type="submit" form="invoice-form" className="bg-core text-white" disabled={saving}>{saving ? 'Saving...' : `Create ${isProforma ? 'Proforma' : 'Sales Invoice'}`}</Button></div>
      </div>

      <form id="invoice-form" onSubmit={handleSubmit} className="flex min-h-0 grow flex-col justify-between gap-3 overflow-hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <label className="text-xs font-medium text-gray-800">Source Sales Order<select value={orderId} onChange={(event) => onOrderChange(event.target.value)} className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-core focus:outline-none">{DUMMY_ORDERS.map((item) => <option key={item.id} value={item.id}>{item.id} - {item.customerName}</option>)}</select></label>
          <label className="text-xs font-medium text-gray-800">{isProforma ? 'Valid until' : 'Due date'}<Input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-core focus:outline-none" /></label>
          <label className="text-xs font-medium text-gray-800">Payment terms<Input placeholder={isProforma ? 'Optional validity terms' : 'e.g. Net 30'} className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-core focus:outline-none" /></label>
        </div>

        <div className="min-h-0 grow overflow-hidden"><InvoiceLineItemsTable items={items} setItems={setItems} contexts={contexts} /></div>

        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50/60 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800"><span>Document discount</span><Select value={discountType} onValueChange={setDiscountType}><SelectTrigger className="h-8 w-24 bg-white px-2 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="amount">Amount</SelectItem><SelectItem value="percentage">Percent</SelectItem></SelectContent></Select><Input type="number" min="0" value={discountValue} onChange={(event) => setDiscountValue(Number(event.target.value))} className="h-8 w-24 bg-white px-2 text-xs" /></div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700"><input type="checkbox" checked={applyVat} onChange={(event) => setApplyVat(event.target.checked)} className="size-3.5 rounded border-gray-300 text-core focus:ring-core" />Apply VAT ({(VAT_RATE * 100).toFixed(1)}%)</label>
            <label className="block text-xs font-medium text-gray-700">Terms &amp; notes<Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Payment terms, delivery notes, bank details..." className="mt-1 min-h-20 bg-white text-xs" /></label>
          </div>
          <div className="w-full max-w-xs shrink-0 space-y-1.5 sm:ml-auto"><SummaryRow label="Subtotal" value={formatNaira(subtotal)} /><SummaryRow label="Line discounts" value={`-${formatNaira(lineDiscountTotal)}`} /><SummaryRow label="Document discount" value={`-${formatNaira(documentDiscount)}`} />{applyVat && <SummaryRow label={`VAT (${(VAT_RATE * 100).toFixed(1)}%)`} value={`+${formatNaira(vatAmount)}`} />}<div className="my-2 border-t border-dashed border-gray-300" /><div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-800">Total</span><span className="text-2xl font-bold tracking-tight text-slate-900">{formatNaira(total)}</span></div></div>
        </div>
      </form>
    </div>
  )
}

function createInvoiceItems(order) {
  return (order?.items || []).map((item, index) => ({ id: `invoice-line-${order.id}-${index}`, productName: item.name, qty: item.delivered || item.qty || 1, stock: 0, pricingContextId: '', unitPrice: item.unitPrice || 0, discountType: 'amount', discountValue: 0 }))
}

function getLineDiscount(item) {
  const subtotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
  return item.discountType === 'percentage' ? subtotal * Math.min(100, Math.max(0, Number(item.discountValue || 0))) / 100 : Math.min(subtotal, Math.max(0, Number(item.discountValue || 0)))
}

function SummaryRow({ label, value }) {
  return <div className="flex items-center justify-between text-xs text-gray-500"><span>{label}</span><span className="font-medium text-gray-700">{value}</span></div>
}
