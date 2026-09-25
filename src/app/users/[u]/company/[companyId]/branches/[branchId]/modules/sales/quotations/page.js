'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FileText, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import StatusBadge from '@/components/modules/sales/status-badge'
import { DUMMY_QUOTATIONS, formatNaira } from '@/components/modules/sales/dummy-data'
import QuotationsPageHeader from '@/components/modules/sales/quotations-page-header'

export default function QuotationsPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`
  const [search, setSearch] = useState('')

  const quotations = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return DUMMY_QUOTATIONS
    return DUMMY_QUOTATIONS.filter((quotation) =>
      quotation.id.toLowerCase().includes(term) || quotation.customerName.toLowerCase().includes(term)
    )
  }, [search])

  return (
    <div className="flex w-full max-w-none flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <QuotationsPageHeader title="All Quotations" />
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by ID or customer..." className="h-9 pl-8 text-sm" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-xs font-semibold uppercase text-gray-500">ID</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Customer</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Total</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Valid Until</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <FileText className="size-8" />
                    <p className="text-sm">No quotations match your search.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              quotations.map((quotation) => (
                <TableRow key={quotation.id} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3">
                    <Link href={`${base}/${quotation.id}`} className="font-semibold text-slate-900 hover:text-core">
                      {quotation.id}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{quotation.customerName}</TableCell>
                  <TableCell className="px-4 py-3 font-medium text-gray-800">{formatNaira(quotation.total)}</TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{quotation.validUntil}</TableCell>
                  <TableCell className="px-4 py-3"><StatusBadge status={quotation.status} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-gray-400">{quotations.length} quotation{quotations.length === 1 ? '' : 's'}</p>
    </div>
  )
}