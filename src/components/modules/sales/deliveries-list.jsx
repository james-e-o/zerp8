'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CalendarDays, FileText, Search, X } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import StatusBadge from '@/components/modules/sales/status-badge'

export default function DeliveriesList({ deliveries, base, title }) {
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState()

  const filteredDeliveries = useMemo(() => {
    const term = search.trim().toLowerCase()
    return deliveries.filter((delivery) => {
      const matchesSearch = !term || delivery.id.toLowerCase().includes(term) || delivery.orderId.toLowerCase().includes(term) || delivery.customerName.toLowerCase().includes(term)
      const createdDate = new Date(delivery.createdAt || delivery.deliveredAt)
      const matchesStart = !dateRange?.from || createdDate >= startOfDay(dateRange.from)
      const matchesEnd = !dateRange?.to || createdDate <= endOfDay(dateRange.to)
      return matchesSearch && matchesStart && matchesEnd
    })
  }, [dateRange, deliveries, search])

  const dateLabel = dateRange?.from ? dateRange.to ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}` : formatDate(dateRange.from) : 'Created date'

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
        <div className="flex items-center justify-end gap-2">
          <div className="relative w-56"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by ID, order, or customer..." className="h-7 pl-8 text-xs" /></div>
          <Popover>
            <PopoverTrigger asChild><Button type="button" variant="outline" className="h-7 gap-2 text-xs"><CalendarDays className="size-4" /> {dateLabel}</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0"><Calendar mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={1} className="rounded-lg border-0" />{dateRange?.from && <div className="border-t px-3 py-2"><Button type="button" variant="ghost" size="sm" className="w-full gap-2" onClick={() => setDateRange(undefined)}><X className="size-3.5" /> Clear date filter</Button></div>}</PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader><TableRow className="bg-gray-50 hover:bg-gray-50"><TableHead className="text-xs font-semibold uppercase text-gray-500">ID</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Sales Order</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Customer</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Type</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Created</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Delivered</TableHead><TableHead className="text-xs font-semibold uppercase text-gray-500">Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredDeliveries.length === 0 ? <TableRow><TableCell colSpan={7} className="px-4 py-12 text-center"><div className="flex flex-col items-center gap-2 text-gray-400"><FileText className="size-8" /><p className="text-sm">{search.trim() || dateRange?.from ? 'No deliveries match your filters.' : 'No deliveries found.'}</p></div></TableCell></TableRow> : filteredDeliveries.map((delivery) => <TableRow key={delivery.id} className="hover:bg-gray-50"><TableCell className="px-4 py-3"><Link href={`${base}/deliveries/${delivery.id}`} className="font-semibold text-slate-900 hover:text-core">{delivery.id}</Link></TableCell><TableCell className="px-4 py-3"><Link href={`${base}/orders/${delivery.orderId}`} className="text-core hover:underline">{delivery.orderId}</Link></TableCell><TableCell className="px-4 py-3 text-gray-600">{delivery.customerName}</TableCell><TableCell className="px-4 py-3 text-gray-600 capitalize">{delivery.fulfillmentType}</TableCell><TableCell className="px-4 py-3 text-gray-600">{formatDateValue(delivery.createdAt || delivery.deliveredAt)}</TableCell><TableCell className="px-4 py-3 text-gray-600">{delivery.items.reduce((sum, item) => sum + item.qty, 0)} units</TableCell><TableCell className="px-4 py-3"><StatusBadge status={delivery.status} /></TableCell></TableRow>)}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">{filteredDeliveries.length} deliver{filteredDeliveries.length === 1 ? 'y' : 'ies'}</p>
    </div>
  )
}

function startOfDay(date) { const value = new Date(date); value.setHours(0, 0, 0, 0); return value }
function endOfDay(date) { const value = new Date(date); value.setHours(23, 59, 59, 999); return value }
function formatDate(date) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date) }
function formatDateValue(value) { return value ? formatDate(new Date(value)) : '—' }
