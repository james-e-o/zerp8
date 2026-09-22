"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { DUMMY_CUSTOMERS, formatNaira } from "@/components/modules/sales/dummy-data"

export default function CustomersListPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/customers`

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Payment Terms</th><th className="px-4 py-3">Credit Limit</th><th className="px-4 py-3">Outstanding</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{DUMMY_CUSTOMERS.map((customer) => <tr key={customer.id} className="hover:bg-gray-50"><td className="px-4 py-3"><Link href={`${base}/${customer.id}`} className="font-semibold text-slate-900 hover:text-core">{customer.name}</Link></td><td className="px-4 py-3 text-gray-600"><div>{customer.email}</div><div className="text-xs text-gray-400">{customer.phone}</div></td><td className="px-4 py-3 text-gray-600">{customer.paymentTerms}</td><td className="px-4 py-3 text-gray-600">{formatNaira(customer.creditLimit)}</td><td className={`px-4 py-3 font-semibold ${customer.outstandingBalance > 0 ? "text-amber-700" : "text-gray-600"}`}>{formatNaira(customer.outstandingBalance)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}
