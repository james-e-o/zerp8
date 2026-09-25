'use client'

import { useMemo } from 'react'
import { ChevronDown, ChevronUp, CirclePlus, CircleX, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNaira } from '@/components/modules/sales/dummy-data'

export default function InvoiceLineItemsTable({ items, setItems, contexts = [] }) {
  const updateRow = (index, patch) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  const insertRowAfter = (index) => setItems((current) => {
    const next = [...current]
    next.splice(index + 1, 0, emptyInvoiceLine())
    return next
  })
  const removeRow = (index) => setItems((current) => current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : current)

  const columns = useMemo(() => [
    { id: 'product', header: 'Product' },
    { id: 'qty', header: 'Qty' },
    { id: 'unitPrice', header: 'Unit Price' },
    { id: 'pricingContext', header: 'Price context' },
    { id: 'discount', header: 'Discount' },
    { id: 'amount', header: 'Line total' },
    { id: 'actions', header: '' },
  ], [])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[760px] w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-20 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>{columns.map((column) => <th key={column.id} className="border-b border-gray-200 px-3 py-2.5">{column.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((item, index) => (
              <tr key={item.id || index} className="align-middle">
                <td className="min-w-56 px-3 py-2"><Input value={item.productName} onChange={(event) => updateRow(index, { productName: event.target.value })} placeholder="Product or service" className="h-8 text-xs" /></td>
                <td className="px-3 py-2"><QuantityControl quantity={item.qty} stock={item.stock} onChange={(qty) => updateRow(index, { qty })} /></td>
                <td className="px-3 py-2"><Input type="number" min="0" value={item.unitPrice} onChange={(event) => updateRow(index, { unitPrice: Number(event.target.value) || 0 })} className="h-8 w-28 text-xs" /></td>
                <td className="px-3 py-2"><Select value={item.pricingContextId || undefined} onValueChange={(pricingContextId) => updateRow(index, { pricingContextId })} disabled={contexts.length === 0}><SelectTrigger className="h-8 min-w-32 px-2 text-[10px]"><SelectValue placeholder="Context" /></SelectTrigger><SelectContent>{contexts.map((context) => <SelectItem key={context.id} value={context.id}>{context.name}</SelectItem>)}</SelectContent></Select></td>
                <td className="px-3 py-2"><div className="flex items-center gap-1"><Select value={item.discountType} onValueChange={(discountType) => updateRow(index, { discountType })}><SelectTrigger className="h-8 w-16 px-1 text-[10px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="amount">Amount</SelectItem><SelectItem value="percentage">%</SelectItem></SelectContent></Select><Input type="number" min="0" value={item.discountValue} onChange={(event) => updateRow(index, { discountValue: Number(event.target.value) || 0 })} className="h-8 w-20 text-xs" /></div></td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-gray-700">{formatNaira(getLineTotal(item))}</td>
                <td className="px-3 py-2"><div className="flex items-center justify-end gap-1"><button type="button" onClick={() => removeRow(index)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label="Remove row"><CircleX className="size-4" /></button><button type="button" onClick={() => insertRowAfter(index)} className="rounded p-1.5 text-core hover:bg-core/10" aria-label="Add row below"><CirclePlus className="size-4" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => insertRowAfter(items.length - 1)} className="flex w-full shrink-0 items-center justify-end gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-core hover:bg-gray-100"><Plus className="size-3.5" /> Add item</button>
    </div>
  )
}

function emptyInvoiceLine() {
  return { id: `invoice-line-${Date.now()}-${Math.random()}`, productName: '', qty: 1, unitPrice: 0, discountType: 'amount', discountValue: 0 }
}

function getLineTotal(item) {
  const subtotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
  const discount = item.discountType === 'percentage' ? subtotal * Math.min(100, Math.max(0, Number(item.discountValue || 0))) / 100 : Math.min(subtotal, Math.max(0, Number(item.discountValue || 0)))
  return Math.max(0, subtotal - discount)
}

function QuantityControl({ quantity, stock = 0, onChange }) {
  const exceedsStock = Number(quantity) > Number(stock)
  return <div className="flex h-8 w-32 items-stretch overflow-hidden rounded border border-gray-200 bg-white"><div className="flex w-8 shrink-0 items-center justify-center bg-black text-xs font-semibold text-white" title="Available stock" aria-label={`Available stock: ${stock}`}>{stock}</div><Input type="number" min="1" value={quantity} onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))} className={`h-full min-w-0 flex-1 rounded-none border-0 px-2 text-center text-xs shadow-none focus-visible:ring-0 ${exceedsStock ? 'text-red-600' : 'text-gray-800'}`} aria-label="Quantity" /><div className="flex w-7 shrink-0 flex-col border-l border-gray-200"><button type="button" onClick={() => onChange(Number(quantity) + 1)} className="flex min-h-0 flex-1 items-center justify-center text-gray-500 hover:bg-gray-100" aria-label="Increase quantity"><ChevronUp className="size-3" /></button><button type="button" onClick={() => onChange(Math.max(1, Number(quantity) - 1))} className="flex min-h-0 flex-1 items-center justify-center border-t border-gray-200 text-gray-500 hover:bg-gray-100" aria-label="Decrease quantity"><ChevronDown className="size-3" /></button></div></div>
}
