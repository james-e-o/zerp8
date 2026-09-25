"use client"

import { useParams, usePathname } from "next/navigation"
import DeliveriesList from "@/components/modules/sales/deliveries-list"
import { DUMMY_DELIVERIES } from "@/components/modules/sales/dummy-data"

const TITLES = { delivery: "Delivery", pickup: "Pickup", pending: "Pending", completed: "Completed" }

export default function DeliveriesListPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const pathname = usePathname()
  const routeFilter = pathname.split('/').slice(-1)[0]
  const deliveries = routeFilter === 'deliveries' ? DUMMY_DELIVERIES : DUMMY_DELIVERIES.filter((delivery) => delivery.fulfillmentType === routeFilter || delivery.status === routeFilter || (routeFilter === 'completed' && delivery.status === 'delivered'))
  return <DeliveriesList base={base} deliveries={deliveries} title={TITLES[routeFilter] || "All Deliveries"} />
}
