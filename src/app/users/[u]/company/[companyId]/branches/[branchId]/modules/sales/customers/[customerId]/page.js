"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import StatusBadge from "@/components/modules/sales/status-badge"
import { DUMMY_CUSTOMERS, DUMMY_QUOTATIONS, DUMMY_ORDERS, DUMMY_INVOICES, formatNaira } from "@/components/modules/sales/dummy-data"

export default function CustomerDetailPage() {
  const { u, companyId, branchId, customerId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const customer = DUMMY_CUSTOMERS.find((item) => item.id === customerId) || DUMMY_CUSTOMERS[0]
  const quotations = DUMMY_QUOTATIONS.filter((item) => item.customerId === customer.id)
  const orders = DUMMY_ORDERS.filter((item) => item.customerId === customer.id)
  const invoices = DUMMY_INVOICES.filter((item) => item.customerId === customer.id)

  return <div className="space-y-7">
    <div className="flex items-center justify-between border-b border-gray-200 pb-4"><div><p className="text-sm font-semibold text-slate-900">{customer.name}</p><p className="text-sm text-gray-600">{customer.email} - {customer.phone}</p><p className="text-sm text-gray-500">{customer.address}</p></div><Link href={`${base}/customers/${customer.id}/edit`}><Button variant="outline">Edit Profile</Button></Link></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[["Credit Limit", formatNaira(customer.creditLimit)], ["Payment Terms", customer.paymentTerms], ["Outstanding Balance", formatNaira(customer.outstandingBalance)]].map(([label, value]) => <div key={label} className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>)}</div>
    <CustomerTable title="Quotations" headers={["ID", "Date", "Total", "Status"]} rows={quotations.map((item) => [<Link key={item.id} href={`${base}/quotations/${item.id}`} className="font-semibold text-core">{item.id}</Link>, item.createdAt, formatNaira(item.total), <StatusBadge key={`${item.id}-status`} status={item.status} />])} />
    <CustomerTable title="Sales Orders" headers={["ID", "Date", "Status"]} rows={orders.map((item) => [<Link key={item.id} href={`${base}/orders/${item.id}`} className="font-semibold text-core">{item.id}</Link>, item.createdAt, <StatusBadge key={`${item.id}-status`} status={item.status} />])} />
    <CustomerTable title="Invoices / Statement" headers={["ID", "Total", "Paid", "Status"]} rows={invoices.map((item) => [<Link key={item.id} href={`${base}/invoices/${item.id}`} className="font-semibold text-core">{item.id}</Link>, formatNaira(item.total), formatNaira(item.paid), <StatusBadge key={`${item.id}-status`} status={item.status} />])} />
  </div>
}

function CustomerTable({ title, headers, rows }) {
  return <section><h2 className="mb-3 text-xs font-semibold uppercase text-gray-500">{title}</h2><div className="overflow-x-auto rounded-lg border border-gray-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.length === 0 ? <tr><td colSpan={headers.length} className="px-4 py-4 text-gray-400">No records yet.</td></tr> : rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-gray-600">{cell}</td>)}</tr>)}</tbody></table></div></section>
}
