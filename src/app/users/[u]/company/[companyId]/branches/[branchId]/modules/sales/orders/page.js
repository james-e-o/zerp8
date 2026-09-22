"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import StatusBadge from "@/components/modules/sales/status-badge"
import { DUMMY_ORDERS } from "@/components/modules/sales/dummy-data"

export default function OrdersListPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/orders`
  const filter = useSearchParams().get("status") || "all"
  const orders = useMemo(() => filter === "all" ? DUMMY_ORDERS : DUMMY_ORDERS.filter((order) => order.status === filter), [filter])

  return <div className="space-y-6">
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Ordered</th><th className="px-4 py-3">Delivered</th><th className="px-4 py-3">Outstanding</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{orders.map((order) => { const ordered = order.items.reduce((sum, item) => sum + item.ordered, 0); const delivered = order.items.reduce((sum, item) => sum + item.delivered, 0); return <tr key={order.id} className="hover:bg-gray-50"><td className="px-4 py-3"><Link href={`${base}/${order.id}`} className="font-semibold text-slate-900 hover:text-core">{order.id}</Link></td><td className="px-4 py-3 text-gray-600">{order.customerName}</td><td className="px-4 py-3 text-gray-600">{ordered}</td><td className="px-4 py-3 text-gray-600">{delivered}</td><td className="px-4 py-3 text-gray-600">{ordered - delivered}</td><td className="px-4 py-3"><StatusBadge status={order.status} /></td></tr> })}</tbody></table></div>
  </div>
}
