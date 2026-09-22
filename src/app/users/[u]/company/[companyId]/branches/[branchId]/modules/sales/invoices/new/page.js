"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DUMMY_ORDERS, formatNaira } from "@/components/modules/sales/dummy-data"

export default function NewInvoicePage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const searchParams = useSearchParams()
  const [type, setType] = useState(searchParams.get("type") || "sales_invoice")
  const [orderId, setOrderId] = useState(searchParams.get("orderId") || DUMMY_ORDERS[0]?.id || "")
  const [saving, setSaving] = useState(false)
  const order = DUMMY_ORDERS.find((item) => item.id === orderId)
  const total = useMemo(
    () => (order ? order.items.reduce((sum, item) => sum + item.delivered * (item.unitPrice || 0), 0) : 0),
    [order]
  )
  const invoicesPath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices`

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSaving(false)
    router.push(invoicesPath)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">New Invoice</h1><p className="mt-1 text-sm text-gray-600">Create a Proforma (preliminary) or Sales Invoice (official billing).</p></div>
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-800">Document type</label>
          <div className="flex gap-3">
            {[{ value: "proforma", label: "Proforma Invoice" }, { value: "sales_invoice", label: "Sales Invoice" }].map((option) => (
              <button key={option.value} type="button" onClick={() => setType(option.value)} className={`flex-1 rounded border-2 px-4 py-3 text-sm font-semibold ${type === option.value ? "border-core bg-core/5 text-core" : "border-gray-200 text-gray-600"}`}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-800">Source Sales Order</label>
          <select value={orderId} onChange={(event) => setOrderId(event.target.value)} className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-core focus:outline-none">
            {DUMMY_ORDERS.map((item) => <option key={item.id} value={item.id}>{item.id} - {item.customerName}</option>)}
          </select>
        </div>
        {order && (
          <div className="rounded border border-gray-100 p-4">
            <table className="w-full text-left text-sm"><thead className="text-xs font-semibold uppercase text-gray-500"><tr><th className="py-2">Product</th><th className="py-2">Delivered Qty</th><th className="py-2 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{order.items.map((item, index) => <tr key={index}><td className="py-2">{item.name}</td><td className="py-2">{item.delivered}</td><td className="py-2 text-right">{formatNaira(item.delivered * (item.unitPrice || 0))}</td></tr>)}</tbody>
            </table>
            <div className="mt-3 flex justify-between border-t border-gray-100 pt-3"><span className="text-sm font-semibold text-gray-800">Total</span><span className="text-xl font-bold text-slate-900">{formatNaira(total)}</span></div>
          </div>
        )}
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button><Button type="submit" className="bg-core text-white" disabled={saving}>{saving ? "Saving..." : `Create ${type === "proforma" ? "Proforma" : "Sales Invoice"}`}</Button></div>
      </form>
    </div>
  )
}