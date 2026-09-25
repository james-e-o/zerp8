"use client"

import { useMemo } from "react"
import { useParams, usePathname } from "next/navigation"
import OrdersList from "@/components/modules/sales/orders-list"
import { DUMMY_ORDERS } from "@/components/modules/sales/dummy-data"

const TITLES = {
  open: "Open",
  partially_fulfilled: "Partially Fulfilled",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
}

export default function OrdersListPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/orders`
  const pathname = usePathname()
  const filter = pathname === base ? "all" : pathname.slice(base.length + 1).split("/")[0]
  const orders = useMemo(() => filter === "all" ? DUMMY_ORDERS : DUMMY_ORDERS.filter((order) => order.status === filter), [filter])

  return <OrdersList base={base} orders={orders} title={TITLES[filter] || "All Orders"} />
}
