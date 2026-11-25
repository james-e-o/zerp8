'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMoney } from '@/components/modules/sales/quotation-shared'

// The line items table of PRO FORMA invoices (its own table; quotations, orders and invoices have theirs).
// Rows are lines of the sales order. Nothing is picked here: the product and the price come from the order
// and are read-only. The only things a pro forma adds are the quantity to quote now and a discount.
//
// row = { id, description, detail, ordered, billed, left, price, qty, discountType, discountValue }
export function proformaLineNet(row) {
  const base = Math.round(Number(row.price || 0) * Number(row.qty || 0) * 100) / 100
  const value = Math.max(0, Number(row.discountValue || 0))
  const discount = row.discountType === 'percentage' ? Math.round(base * Math.min(100, value)) / 100 : Math.min(base, value)
  return Math.max(0, Math.round((base - discount) * 100) / 100)
}

export default function ProformaLineItemsTable({ rows, setRows }) {
  const money = useMoney()
  const update = (index, patch) => setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-xs">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              {['Product', 'Ordered', 'Already billed', 'Left to bill', 'Quantity', 'Unit price', 'Discount', 'Line total'].map((label, index) => (
                <th key={label} className={`sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-3 py-2.5 ${index === 0 ? 'left-0 z-40 border-r shadow-sm' : 'text-right'}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row, index) => (
              <tr key={row.id} className="align-middle">
                <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <p className="font-medium text-gray-800">{row.description}</p>
                  {row.detail && <p className="text-[10px] text-muted-foreground">{row.detail}</p>}
                </td>
                <td className="px-3 py-2 text-right">{row.ordered}</td>
                <td className="px-3 py-2 text-right">{row.billed || '—'}</td>
                <td className="px-3 py-2 text-right">{row.left}</td>
                <td className="px-3 py-2 text-right">
                  <Input
                    type="number"
                    min="0"
                    max={row.left}
                    disabled={row.left === 0}
                    value={row.qty}
                    onChange={(event) => update(index, { qty: event.target.value })}
                    className="ml-auto h-8 w-24 text-right text-xs"
                    aria-label="Quantity"
                  />
                </td>
                <td className="px-3 py-2 text-right" title="Prices come from the sales order">{money(row.price)}</td>
                <td className="px-3 py-2">
                  <div className="ml-auto flex w-fit items-center gap-1">
                    <Select value={row.discountType || 'amount'} onValueChange={(value) => update(index, { discountType: value })}>
                      <SelectTrigger className="h-8 w-16 px-1 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="amount">Amount</SelectItem><SelectItem value="percentage">%</SelectItem></SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      value={row.discountValue ?? 0}
                      onChange={(event) => update(index, { discountValue: event.target.value })}
                      className="h-8 w-20 text-xs"
                      aria-label="Discount"
                    />
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold text-gray-700">{money(proformaLineNet(row))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
