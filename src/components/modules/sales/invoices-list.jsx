'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CalendarDays, FileText, Plus, Search, X } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import StatusBadge from '@/components/modules/sales/status-badge'
import { formatNaira } from '@/components/modules/sales/dummy-data'

export default function InvoicesList({ invoices, base, title, newHref, newLabel }) {
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState()

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const matchesSearch = !term || invoice.id.toLowerCase().includes(term) || invoice.customerName.toLowerCase().includes(term)
      const issuedDate = new Date(invoice.issuedAt)
      const matchesStart = !dateRange?.from || issuedDate >= startOfDay(dateRange.from)
      const matchesEnd = !dateRange?.to || issuedDate <= endOfDay(dateRange.to)
      return matchesSearch && matchesStart && matchesEnd
    })
  }, [dateRange, invoices, search])

  const dateLabel = dateRange?.from ? dateRange.to ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}` : formatDate(dateRange.from) : 'Issued date'

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
        <div className="flex items-center justify-end gap-2">
          {newHref && <Button asChild className="h-7 gap-2 bg-core text-xs text-white"><Link href={newHref}><Plus className="size-4" /> {newLabel}</Link></Button>}
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by ID or customer..." className="h-7 pl-8 text-xs" />
          </div>
          <Popover>
            <PopoverTrigger asChild><Button type="button" variant="outline" className="h-7 gap-2 text-xs"><CalendarDays className="size-4" /> {dateLabel}</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={1} className="rounded-lg border-0" />
              {dateRange?.from && <div className="border-t px-3 py-2"><Button type="button" variant="ghost" size="sm" className="w-full gap-2" onClick={() => setDateRange(undefined)}><X className="size-3.5" /> Clear date filter</Button></div>}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader><TableRow className="bg-gray-50 hover:bg-gray-50"><TableHead className="text-xs font-semibold uppercase text-gray-500">ID</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Type</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Customer</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Created</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Due date</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Total</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Paid</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredInvoices.length === 0 ? <TableRow><TableCell colSpan={8} className="px-4 py-12 text-center"><div className="flex flex-col items-center gap-2 text-gray-400"><FileText className="size-8" /><p className="text-sm">{search.trim() || dateRange?.from ? 'No documents match your filters.' : 'No documents found.'}</p></div></TableCell></TableRow> : filteredInvoices.map((invoice) => <TableRow key={invoice.id} className="hover:bg-gray-50"><TableCell className="px-4 py-3"><Link href={`${base}/${invoice.id}`} className="font-semibold text-slate-900 hover:text-core">{invoice.id}</Link></TableCell><TableCell className="px-4 py-3"><StatusBadge status={invoice.type} /></TableCell><TableCell className="px-4 py-3 text-gray-600">{invoice.customerName}</TableCell><TableCell className="px-4 py-3 text-gray-600">{formatDateValue(invoice.issuedAt)}</TableCell><TableCell className="px-4 py-3 text-gray-600">{formatDateValue(invoice.dueDate)}</TableCell><TableCell className="px-4 py-3 font-medium text-gray-800">{formatNaira(invoice.total)}</TableCell><TableCell className="px-4 py-3 text-gray-600">{formatNaira(invoice.paid)}</TableCell><TableCell className="px-4 py-3"><StatusBadge status={invoice.status} /></TableCell></TableRow>)}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">{filteredInvoices.length} document{filteredInvoices.length === 1 ? '' : 's'}</p>
    </div>
  )
}

function startOfDay(date) { const value = new Date(date); value.setHours(0, 0, 0, 0); return value }
function endOfDay(date) { const value = new Date(date); value.setHours(23, 59, 59, 999); return value }
function formatDate(date) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date) }
function formatDateValue(value) { return value ? formatDate(new Date(value)) : '—' }
