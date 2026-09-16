"use client"

import { useParams } from "next/navigation"

const dummyHistory = [
  { id: "INV-2026-0012", date: "Sep 15, 2026", amount: "₦35,000", type: "Invoice", status: "Paid" },
  { id: "PAY-2026-0007", date: "Aug 15, 2026", amount: "₦35,000", type: "Payment", status: "Successful" },
]

export default function SubscriptionHistoryPage() {
  const { companyId } = useParams()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing history</h1>
        <p className="mt-1 text-sm text-gray-600">Invoices and payments in one chronological record.</p>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Billing history is currently using temporary data until the Bachs.io billing endpoints are connected.
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 border-b bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500">
          <span>Reference</span><span>Date</span><span>Amount</span><span>Status</span>
        </div>
        {dummyHistory.map((entry) => (
          <div key={entry.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-4 border-b px-4 py-4 last:border-0">
            <div><p className="text-sm font-medium text-slate-900">{entry.id}</p><p className="text-xs text-gray-500">{entry.type}</p></div>
            <span className="text-sm text-gray-600">{entry.date}</span>
            <span className="text-sm font-medium text-slate-900">{entry.amount}</span>
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">{entry.status}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400">Company: {companyId}</p>
    </div>
  )
}