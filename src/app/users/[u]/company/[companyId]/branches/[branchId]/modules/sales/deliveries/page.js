"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import StatusBadge from "@/components/modules/sales/status-badge"
import { DUMMY_DELIVERIES } from "@/components/modules/sales/dummy-data"

export default function DeliveriesListPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  return <div className="space-y-6"><div className="overflow-x-auto rounded-lg border border-gray-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Sales Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Delivered</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{DUMMY_DELIVERIES.map((delivery) => <tr key={delivery.id} className="hover:bg-gray-50"><td className="px-4 py-3"><Link href={`${base}/deliveries/${delivery.id}`} className="font-semibold text-slate-900 hover:text-core">{delivery.id}</Link></td><td className="px-4 py-3"><Link href={`${base}/orders/${delivery.orderId}`} className="text-core hover:underline">{delivery.orderId}</Link></td><td className="px-4 py-3 text-gray-600">{delivery.customerName}</td><td className="px-4 py-3 text-gray-600">{delivery.items.reduce((sum, item) => sum + item.qty, 0)} units</td><td className="px-4 py-3"><StatusBadge status={delivery.status} /></td></tr>)}</tbody></table></div></div>
}
