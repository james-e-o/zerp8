"use client"

import { useParams, usePathname } from "next/navigation"
import InvoicesList from "@/components/modules/sales/invoices-list"
import { DUMMY_INVOICES } from "@/components/modules/sales/dummy-data"

const TITLES = { sales_invoice: "Sales Invoices", proforma: "Proforma Invoices", credit_note: "Credit Notes", unpaid: "Unpaid", partially_paid: "Partially Paid", paid: "Paid", overdue: "Overdue" }
const NEW_ROUTES = { sales_invoice: ["sales_invoice/new", "New Sales Invoice"], proforma: ["proforma/new", "New Proforma Invoice"], credit_note: ["credit_note/new", "New Credit Note"] }

export default function InvoicesListPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices`
  const pathname = usePathname()
  const routeFilter = pathname === base ? "all" : pathname.slice(base.length + 1).split("/")[0]
  const filter = routeFilter === "partially-paid" ? "partially_paid" : routeFilter
  const invoices = filter === "all"
    ? DUMMY_INVOICES
    : ["sales_invoice", "proforma", "credit_note"].includes(filter)
      ? DUMMY_INVOICES.filter((invoice) => invoice.type === filter)
      : DUMMY_INVOICES.filter((invoice) => invoice.status === filter)

  const newRoute = NEW_ROUTES[filter]
  return <InvoicesList base={base} invoices={invoices} title={TITLES[filter] || "All Invoices"} newHref={newRoute ? `${base}/${newRoute[0]}` : undefined} newLabel={newRoute?.[1]} />
}
