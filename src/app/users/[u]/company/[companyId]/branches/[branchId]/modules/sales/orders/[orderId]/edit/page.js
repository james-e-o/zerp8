"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DUMMY_ORDERS, DUMMY_PRODUCTS, formatNaira } from "@/components/modules/sales/dummy-data"

export default function EditOrderPage() {
  const router = useRouter()
  const { u, companyId, branchId, orderId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/orders`
  const existing = DUMMY_ORDERS.find((order) => order.id === orderId) || DUMMY_ORDERS[0]
  const hasDeliveries = existing.items.some((item) => item.delivered > 0)
  const [items, setItems] = useState(existing.items.map((item) => ({ ...item })))
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (hasDeliveries) router.replace(`${base}/${existing.id}`) }, [base, existing.id, hasDeliveries, router])
  const updateItem = (index, key, value) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  const total = useMemo(() => items.reduce((sum, item) => sum + item.ordered * (item.unitPrice || 0), 0), [items])
  const handleSubmit = async (event) => { event.preventDefault(); setSaving(true); await new Promise((resolve) => setTimeout(resolve, 500)); setSaving(false); router.push(`${base}/${existing.id}`) }
  if (hasDeliveries) return null
  return <div className="max-w-3xl space-y-6"><div><h1 className="text-2xl font-bold text-slate-900">Edit {existing.id}</h1><p className="mt-1 text-sm text-gray-600">Editable while no delivery has been made against this order yet.</p></div><form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6"><div className="space-y-3">{items.map((item, index) => <div key={index} className="grid grid-cols-12 items-center gap-2 rounded border border-gray-100 p-3"><select value={item.productId} onChange={(event) => { const product = DUMMY_PRODUCTS.find((value) => value.id === event.target.value); updateItem(index, "productId", event.target.value); updateItem(index, "name", product?.name); updateItem(index, "unitPrice", product?.unitPrice || 0) }} className="col-span-5 rounded border border-gray-200 px-2 py-1.5 text-sm">{DUMMY_PRODUCTS.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><input type="number" min="1" value={item.ordered} onChange={(event) => updateItem(index, "ordered", Number(event.target.value))} className="col-span-2 rounded border border-gray-200 px-2 py-1.5 text-sm" /><input type="number" min="0" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", Number(event.target.value))} className="col-span-3 rounded border border-gray-200 px-2 py-1.5 text-sm" /><span className="col-span-2 text-right text-xs text-gray-500">{formatNaira(item.ordered * item.unitPrice)}</span></div>)}</div><div className="flex items-center justify-between border-t border-gray-100 pt-4"><span className="text-sm font-semibold text-gray-800">Total</span><span className="text-xl font-bold text-slate-900">{formatNaira(total)}</span></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button><Button type="submit" className="bg-core text-white" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button></div></form></div>
}
