import Link from 'next/link'
import { DUMMY_SUPPLIERS, formatNaira } from './dummy-data'

export default function SuppliersList({ base }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Payment Terms</th><th className="px-4 py-3">Credit Limit</th><th className="px-4 py-3">Outstanding</th></tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {DUMMY_SUPPLIERS.map((supplier) => (
            <tr key={supplier.id} className="hover:bg-gray-50">
              <td className="px-4 py-3"><Link href={`${base}/${supplier.id}`} className="font-semibold text-slate-900 hover:text-core">{supplier.name}</Link><div className="text-xs text-gray-400">{supplier.id}</div></td>
              <td className="px-4 py-3 text-gray-600"><div>{supplier.email}</div><div className="text-xs text-gray-400">{supplier.phone}</div></td>
              <td className="px-4 py-3 text-gray-600">{supplier.paymentTerms}</td>
              <td className="px-4 py-3 text-gray-600">{formatNaira(supplier.creditLimit)}</td>
              <td className={`px-4 py-3 font-semibold ${supplier.outstandingBalance > 0 ? 'text-amber-700' : 'text-gray-600'}`}>{formatNaira(supplier.outstandingBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
