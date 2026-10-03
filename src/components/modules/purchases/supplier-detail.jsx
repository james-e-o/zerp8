'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DUMMY_SUPPLIERS, formatNaira } from './dummy-data'

export default function SupplierDetail() {
  const { u, companyId, branchId, supplierId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases`
  const supplier = DUMMY_SUPPLIERS.find((item) => item.id === supplierId) || DUMMY_SUPPLIERS[0]

  return <div className="space-y-7"><div className="flex items-center justify-between border-b border-gray-200 pb-4"><div><p className="text-sm font-semibold text-slate-900">{supplier.name}</p><p className="text-sm text-gray-600">{supplier.email} - {supplier.phone}</p><p className="text-sm text-gray-500">{supplier.address}</p></div><Link href={`${base}/suppliers/${supplier.id}/edit`}><Button variant="outline">Edit Supplier</Button></Link></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[['Credit Limit', formatNaira(supplier.creditLimit)], ['Payment Terms', supplier.paymentTerms], ['Outstanding Balance', formatNaira(supplier.outstandingBalance)]].map(([label, value]) => <div key={label} className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>)}</div><SupplierTable title="Purchase Orders" headers={['ID', 'Date', 'Status']} /><SupplierTable title="Receipts" headers={['ID', 'Date', 'Status']} /><SupplierTable title="Bills / Statement" headers={['ID', 'Total', 'Paid', 'Status']} /></div>
}

function SupplierTable({ title, headers }) {
  return <section><h2 className="mb-3 text-xs font-semibold uppercase text-gray-500">{title}</h2><div className="overflow-x-auto rounded-lg border border-gray-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody><tr><td colSpan={headers.length} className="px-4 py-4 text-gray-400">No records yet.</td></tr></tbody></table></div></section>
}
