"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useParams } from "next/navigation"
import StatusBadge from "@/components/modules/sales/status-badge"
import { DUMMY_INVOICES, formatNaira } from "@/components/modules/sales/dummy-data"

export default function InvoicesListPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices`
  const filter = useSearchParams().get("status") || "all"
  const invoices = filter === "all"
    ? DUMMY_INVOICES
    : ["sales_invoice", "proforma", "credit_note"].includes(filter)
      ? DUMMY_INVOICES.filter((invoice) => invoice.type === filter)
      : DUMMY_INVOICES.filter((invoice) => invoice.status === filter)

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No documents match this filter.</td></tr>}
            {invoices.map((invoice) => <tr key={invoice.id} className="hover:bg-gray-50"><td className="px-4 py-3"><Link href={`${base}/${invoice.id}`} className="font-semibold text-slate-900 hover:text-core">{invoice.id}</Link></td><td className="px-4 py-3"><StatusBadge status={invoice.type} /></td><td className="px-4 py-3 text-gray-600">{invoice.customerName}</td><td className="px-4 py-3 text-gray-600">{formatNaira(invoice.total)}</td><td className="px-4 py-3 text-gray-600">{formatNaira(invoice.paid)}</td><td className="px-4 py-3"><StatusBadge status={invoice.status} /></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
