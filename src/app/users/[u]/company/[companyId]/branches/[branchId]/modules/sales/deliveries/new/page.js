"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DUMMY_ORDERS } from "@/components/modules/sales/dummy-data"

export default function NewDeliveryPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const preselectedOrderId = useSearchParams().get("orderId")
  const deliverableOrders = useMemo(() => DUMMY_ORDERS.filter((order) => order.status !== "fulfilled" && order.status !== "cancelled"), [])
  const [orderId, setOrderId] = useState(preselectedOrderId || deliverableOrders[0]?.id || "")
  const [saving, setSaving] = useState(false)
  const order = DUMMY_ORDERS.find((item) => item.id === orderId)
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/deliveries`
  const handleSubmit = async (event) => { event.preventDefault(); setSaving(true); await new Promise((resolve) => setTimeout(resolve, 500)); setSaving(false); router.push(base) }
  return <div className="max-w-2xl space-y-6"><form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6"><label className="block text-sm font-semibold text-gray-800">Sales Order<select value={orderId} onChange={(event) => setOrderId(event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm">{deliverableOrders.map((item) => <option key={item.id} value={item.id}>{item.id} - {item.customerName}</option>)}</select></label>{order && <div><p className="mb-2 text-sm font-semibold text-gray-800">Items to deliver</p><div className="space-y-3">{order.items.map((item) => <div key={item.productId} className="flex items-center justify-between rounded border border-gray-100 p-3"><div><p className="text-sm font-semibold text-gray-800">{item.name}</p><p className="text-xs text-gray-500">Outstanding: {item.ordered - item.delivered} of {item.ordered}</p></div><span className="text-sm text-gray-600">{item.ordered - item.delivered}</span></div>)}</div></div>}<div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button><Button type="submit" className="bg-core text-white" disabled={saving}>{saving ? "Saving..." : "Create Delivery"}</Button></div></form></div>
}
