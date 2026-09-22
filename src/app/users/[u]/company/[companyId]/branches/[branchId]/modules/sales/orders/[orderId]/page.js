"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import StatusBadge from "@/components/modules/sales/status-badge"
import { DUMMY_ORDERS, formatNaira } from "@/components/modules/sales/dummy-data"

export default function OrderDetailPage() {
  const { u, companyId, branchId, orderId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const order = DUMMY_ORDERS.find((item) => item.id === orderId) || DUMMY_ORDERS[0]
  const hasDeliveries = order.items.some((item) => item.delivered > 0)
  return <div className="max-w-3xl space-y-6"><div className="flex items-start justify-between"><div><h1 className="text-2xl font-bold text-slate-900">{order.id}</h1><p className="mt-1 text-sm text-gray-600"><Link href={`${base}/customers/${order.customerId}`} className="text-core hover:underline">{order.customerName}</Link> - Created {order.createdAt}</p></div><StatusBadge status={order.status} /></div><div className="rounded-lg border border-gray-200 bg-white p-5"><h2 className="mb-3 text-xs font-semibold uppercase text-gray-500">Line items</h2><table className="w-full text-left text-sm"><thead className="text-xs font-semibold uppercase text-gray-500"><tr><th className="py-2">Product</th><th className="py-2">Ordered</th><th className="py-2">Delivered</th><th className="py-2">Outstanding</th><th className="py-2 text-right">Unit Price</th></tr></thead><tbody className="divide-y divide-gray-100">{order.items.map((item, index) => <tr key={index}><td className="py-2">{item.name}</td><td className="py-2">{item.ordered}</td><td className="py-2">{item.delivered}</td><td className="py-2">{item.ordered - item.delivered}</td><td className="py-2 text-right">{formatNaira(item.unitPrice)}</td></tr>)}</tbody></table></div><div className="flex flex-wrap gap-3"><Link href={`${base}/invoices/new?type=proforma&orderId=${order.id}`}><Button className="bg-core text-white">Create Proforma</Button></Link><Link href={`${base}/deliveries/new?orderId=${order.id}`}><Button variant="outline">Create Delivery</Button></Link>{!hasDeliveries && <Link href={`${base}/orders/${order.id}/edit`}><Button variant="outline">Edit</Button></Link>}</div></div>
}
