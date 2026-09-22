"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import StatusBadge from "@/components/modules/sales/status-badge"
import { DUMMY_DELIVERIES } from "@/components/modules/sales/dummy-data"

export default function DeliveryDetailPage() {
  const { u, companyId, branchId, deliveryId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const delivery = DUMMY_DELIVERIES.find((item) => item.id === deliveryId) || DUMMY_DELIVERIES[0]
  return <div className="max-w-2xl space-y-6"><div className="flex items-center justify-between border-b border-gray-200 pb-4"><p className="text-sm text-gray-600">{delivery.id} - Against <Link href={`${base}/orders/${delivery.orderId}`} className="text-core hover:underline">{delivery.orderId}</Link> - {delivery.customerName}</p><StatusBadge status={delivery.status} /></div><div className="rounded-lg border border-gray-200 bg-white p-5"><h2 className="mb-3 text-xs font-semibold uppercase text-gray-500">Items delivered</h2><table className="w-full text-left text-sm"><thead className="text-xs font-semibold uppercase text-gray-500"><tr><th className="py-2">Product</th><th className="py-2 text-right">Qty</th></tr></thead><tbody className="divide-y divide-gray-100">{delivery.items.map((item, index) => <tr key={index}><td className="py-2">{item.name}</td><td className="py-2 text-right">{item.qty}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-gray-400">Delivered on {delivery.deliveredAt}</p></div><div className="flex flex-wrap gap-3"><Button variant="outline">Print Delivery Note</Button><Link href={`${base}/returns/new?deliveryId=${delivery.id}`}><Button variant="outline">Record a Return</Button></Link></div></div>
}
