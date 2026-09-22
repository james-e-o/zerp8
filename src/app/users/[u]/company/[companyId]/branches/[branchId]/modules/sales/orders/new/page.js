"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DUMMY_CUSTOMERS, DUMMY_PRODUCTS, DUMMY_QUOTATIONS, formatNaira } from "@/components/modules/sales/dummy-data"

export default function NewSalesOrderPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const sourceId = useSearchParams().get("fromQuotation")
  const source = sourceId ? DUMMY_QUOTATIONS.find((quotation) => quotation.id === sourceId) : null
  const [customerId, setCustomerId] = useState(source?.customerId || DUMMY_CUSTOMERS[0]?.id || "")
  const [items, setItems] = useState(source?.items.map((item) => ({ ...item, ordered: item.qty })) || [{ productId: DUMMY_PRODUCTS[0]?.id, name: DUMMY_PRODUCTS[0]?.name, ordered: 1, delivered: 0, unitPrice: DUMMY_PRODUCTS[0]?.unitPrice || 0 }])
  const [saving, setSaving] = useState(false)
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/orders`
  const updateItem = (index, key, value) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  const addItem = () => setItems((current) => [...current, { productId: DUMMY_PRODUCTS[0].id, name: DUMMY_PRODUCTS[0].name, ordered: 1, delivered: 0, unitPrice: DUMMY_PRODUCTS[0].unitPrice }])
  const total = useMemo(() => items.reduce((sum, item) => sum + item.ordered * (item.unitPrice || 0), 0), [items])
  const handleSubmit = async (event) => { event.preventDefault(); setSaving(true); await new Promise((resolve) => setTimeout(resolve, 500)); setSaving(false); router.push(base) }
  return <div className="max-w-3xl space-y-6"><div><h1 className="text-2xl font-bold text-slate-900">New Sales Order</h1><p className="mt-1 text-sm text-gray-600">Create a customer order and its line items.</p></div><form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6"><label className="block text-sm font-semibold text-gray-800">Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm">{DUMMY_CUSTOMERS.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-semibold text-gray-800">Line items</label><button type="button" onClick={addItem} className="text-xs font-semibold text-core hover:underline">+ Add item</button></div><div className="space-y-3">{items.map((item, index) => <div key={index} className="grid grid-cols-12 gap-2 rounded border border-gray-100 p-3"><select value={item.productId} onChange={(event) => { const product = DUMMY_PRODUCTS.find((value) => value.id === event.target.value); updateItem(index, "productId", event.target.value); updateItem(index, "name", product?.name); updateItem(index, "unitPrice", product?.unitPrice || 0) }} className="col-span-5 rounded border border-gray-200 px-2 py-1.5 text-sm">{DUMMY_PRODUCTS.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><input type="number" min="1" value={item.ordered} onChange={(event) => updateItem(index, "ordered", Number(event.target.value))} className="col-span-2 rounded border border-gray-200 px-2 py-1.5 text-sm" /><input type="number" min="0" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", Number(event.target.value))} className="col-span-3 rounded border border-gray-200 px-2 py-1.5 text-sm" /><span className="col-span-2 py-1.5 text-right text-xs text-gray-500">{formatNaira(item.ordered * item.unitPrice)}</span></div>)}</div></div><div className="flex items-center justify-between border-t border-gray-100 pt-4"><span className="text-sm font-semibold text-gray-800">Total</span><span className="text-xl font-bold text-slate-900">{formatNaira(total)}</span></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button><Button type="submit" className="bg-core text-white" disabled={saving}>{saving ? "Saving..." : "Create Sales Order"}</Button></div></form></div>
}
