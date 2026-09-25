'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CalendarDays, FileText, Search, X } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import StatusBadge from '@/components/modules/sales/status-badge'
import { formatNaira } from '@/components/modules/sales/dummy-data'
import QuotationsPageHeader from '@/components/modules/sales/quotations-page-header'

export default function QuotationsFilteredList({ quotations, base, title, emptyMessage }) {
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState()
  const [dateField, setDateField] = useState('createdAt')

  const filteredQuotations = useMemo(() => {
    const term = search.trim().toLowerCase()
    return quotations.filter((quotation) => {
      const matchesSearch = !term || quotation.id.toLowerCase().includes(term) || quotation.customerName.toLowerCase().includes(term)
      const quotationDate = new Date(quotation[dateField])
      const matchesStart = !dateRange?.from || quotationDate >= startOfDay(dateRange.from)
      const matchesEnd = !dateRange?.to || quotationDate <= endOfDay(dateRange.to)
      return matchesSearch && matchesStart && matchesEnd
    })
  }, [dateField, dateRange, quotations, search])

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
      : formatDate(dateRange.from)
    : dateField === 'createdAt' ? 'Created date' : 'Valid until'

  const clearDateRange = () => setDateRange(undefined)

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <QuotationsPageHeader title={title} />
        <div className="flex items-center justify-end gap-2">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by ID or customer..."
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-9 gap-2 text-sm">
              <CalendarDays className="size-4" />
              {dateLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <div className="border-b p-3">
              <Select value={dateField} onValueChange={setDateField}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created date</SelectItem>
                  <SelectItem value="validUntil">Valid until</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={1}
              className="rounded-lg border-0"
            />
            {dateRange?.from && (
              <div className="border-t px-3 py-2">
                <Button type="button" variant="ghost" size="sm" className="w-full gap-2" onClick={clearDateRange}>
                  <X className="size-3.5" /> Clear date filter
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-xs font-semibold uppercase text-gray-500">ID</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Customer</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Total</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Created</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Valid Until</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <FileText className="size-8" />
                    <p className="text-sm">{search.trim() || dateRange?.from ? 'No quotations match your filters.' : emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredQuotations.map((quotation) => (
              <TableRow key={quotation.id} className="hover:bg-gray-50">
                <TableCell className="px-4 py-3">
                  <Link href={`${base}/${quotation.id}`} className="font-semibold text-slate-900 hover:text-core">{quotation.id}</Link>
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{quotation.customerName}</TableCell>
                <TableCell className="px-4 py-3 font-medium text-gray-800">{formatNaira(quotation.total)}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{formatDateValue(quotation.createdAt)}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{quotation.validUntil}</TableCell>
                <TableCell className="px-4 py-3"><StatusBadge status={quotation.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-gray-400">{filteredQuotations.length} quotation{filteredQuotations.length === 1 ? '' : 's'}</p>
    </div>
  )
}

function startOfDay(date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function endOfDay(date) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatDateValue(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}
