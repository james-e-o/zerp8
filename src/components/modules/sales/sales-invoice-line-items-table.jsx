'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMoney } from '@/components/modules/sales/quotation-shared'

// The line items table of SALES INVOICES (its own table). Rows are lines of the sales order: no product is
// picked and no price is typed here (both come from the order and are read-only). The invoice decides how many
// units to bill now and may give a discount on a line.
//
// row = { id, description, detail, ordered, delivered, invoiced, left, unit, qty, discountType, discountValue }
// unit = the order line's net price per unit (what the database bills).
export function invoiceLineBase(row) {
  return Math.round(Number(row.unit || 0) * Number(row.qty || 0) * 100) / 100
}

export function invoiceLineNet(row) {
  const base = invoiceLineBase(row)
  const value = Math.max(0, Number(row.discountValue || 0))
  const discount = row.discountType === 'percentage' ? Math.round(base * Math.min(100, value)) / 100 : Math.min(base, value)
  return Math.max(0, Math.round((base - discount) * 100) / 100)
}

export default function SalesInvoiceLineItemsTable({ rows, setRows }) {
  const money = useMoney()
  const update = (id, patch) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  return (
    <div className="overflow-x-auto rounded-sm border border-border bg-card">
      <table className="w-full min-w-[900px] text-xs">
        <thead className="bg-muted text-[10px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Item</th>
            <th className="px-3 py-2 text-right font-medium">Ordered</th>
            <th className="px-3 py-2 text-right font-medium">Delivered</th>
            <th className="px-3 py-2 text-right font-medium">Invoiced</th>
            <th className="px-3 py-2 text-right font-medium">Left to invoice</th>
            <th className="px-3 py-2 text-right font-medium">Invoice now</th>
            <th className="px-3 py-2 text-right font-medium">Unit price</th>
            <th className="px-3 py-2 text-right font-medium">Discount</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2">
                <p className="font-medium text-foreground">{row.description}</p>
                {row.detail && <p className="text-[10px] text-muted-foreground">{row.detail}</p>}
              </td>
              <td className="px-3 py-2 text-right">{row.ordered}</td>
              <td className="px-3 py-2 text-right">{row.delivered}</td>
              <td className="px-3 py-2 text-right">{row.invoiced || '—'}</td>
              <td className="px-3 py-2 text-right">{row.left}</td>
              <td className="px-3 py-2 text-right">
                <Input
                  type="number"
                  min="0"
                  max={row.left}
                  disabled={row.left === 0}
                  value={row.qty}
                  onChange={(event) => update(row.id, { qty: event.target.value })}
                  className="ml-auto h-7 w-20 text-right text-xs"
                  aria-label="Quantity to invoice"
                />
              </td>
              <td className="px-3 py-2 text-right" title="Prices come from the sales order">{money(row.unit)}</td>
              <td className="px-3 py-2">
                <div className="ml-auto flex w-fit items-center gap-1">
                  <Select value={row.discountType || 'amount'} onValueChange={(value) => update(row.id, { discountType: value })}>
                    <SelectTrigger className="h-7 w-16 px-1 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="amount">Amount</SelectItem><SelectItem value="percentage">%</SelectItem></SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    value={row.discountValue ?? 0}
                    onChange={(event) => update(row.id, { discountValue: event.target.value })}
                    className="h-7 w-20 text-xs"
                    aria-label="Discount"
                  />
                </div>
              </td>
              <td className="px-3 py-2 text-right font-medium">{money(invoiceLineNet(row))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
