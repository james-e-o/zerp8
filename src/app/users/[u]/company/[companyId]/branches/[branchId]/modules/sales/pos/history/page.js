'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DUMMY_POS_SALES, formatNaira } from '@/components/modules/sales/dummy-data'

export default function POSHistoryPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/pos`

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">POS History</h1><p className="mt-1 text-sm text-gray-600">Completed walk-in transactions for this branch.</p></div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500"><tr><th className="px-4 py-3">POS ID</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {DUMMY_POS_SALES.map((sale) => <tr key={sale.id} className="hover:bg-gray-50"><td className="px-4 py-3"><Link href={`${base}/history/${sale.id}`} className="font-semibold text-slate-900 hover:text-core">{sale.id}</Link></td><td className="px-4 py-3 text-gray-600">{new Date(sale.createdAt).toLocaleString()}</td><td className="px-4 py-3 text-gray-600">{sale.items.reduce((count, item) => count + item.qty, 0)}</td><td className="px-4 py-3 text-gray-600">{sale.paymentMethod}</td><td className="px-4 py-3 text-right text-gray-600">{formatNaira(sale.total)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}