"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import {
  DUMMY_QUOTATIONS,
  DUMMY_ORDERS,
  DUMMY_INVOICES,
  DUMMY_POS_SALES,
  formatNaira,
} from "@/components/modules/sales/dummy-data"

export default function SalesOverviewPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const openQuotations = DUMMY_QUOTATIONS.filter((quotation) => quotation.status === "sent" || quotation.status === "draft").length
  const ordersAwaitingFulfillment = DUMMY_ORDERS.filter((order) => order.status !== "fulfilled" && order.status !== "cancelled").length
  const unpaidInvoices = DUMMY_INVOICES.filter((invoice) => ["unpaid", "partially_paid", "overdue"].includes(invoice.status))
  const unpaidTotal = unpaidInvoices.reduce((sum, invoice) => sum + (invoice.total - invoice.paid), 0)
  const today = new Date().toDateString()
  const posTodayTotal = DUMMY_POS_SALES
    .filter((sale) => new Date(sale.createdAt).toDateString() === today)
    .reduce((sum, sale) => sum + sale.total, 0)

  const cards = [
    { label: "Open Quotations", value: openQuotations, href: `${base}/quotations` },
    { label: "Orders Awaiting Fulfillment", value: ordersAwaitingFulfillment, href: `${base}/orders` },
    { label: "Unpaid Invoices", value: `${unpaidInvoices.length} · ${formatNaira(unpaidTotal)}`, href: `${base}/invoices?status=unpaid` },
    { label: "Today's POS Total", value: formatNaira(posTodayTotal), href: `${base}/pos/history` },
  ]

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Overview</h1>
        <p className="mt-1 text-sm text-gray-600">Snapshot of quotations, orders, invoices and POS activity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-core/40">
            <p className="text-xs font-semibold uppercase text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase text-gray-500">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href={`${base}/quotations/new`} className="rounded border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-core/50">New Quotation</Link>
          <Link href={`${base}/orders/new`} className="rounded border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-core/50">New Sales Order</Link>
          <Link href={`${base}/invoices/new`} className="rounded border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-core/50">New Invoice</Link>
          <Link href={`${base}/pos`} className="rounded bg-core px-3 py-2 text-sm font-semibold text-white">Open POS</Link>
        </div>
      </div>
    </div>
  )
}
