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

export default function OrdersList({ orders, base, title }) {
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState()

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesSearch = !term || order.id.toLowerCase().includes(term) || order.customerName.toLowerCase().includes(term)
      const createdDate = new Date(order.createdAt)
      const matchesStart = !dateRange?.from || createdDate >= startOfDay(dateRange.from)
      const matchesEnd = !dateRange?.to || createdDate <= endOfDay(dateRange.to)
      return matchesSearch && matchesStart && matchesEnd
    })
  }, [dateRange, orders, search])

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
      : formatDate(dateRange.from)
    : 'Created date'

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
        <div className="flex items-center justify-end gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by ID or customer..." className="h-9 pl-8 text-sm" />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="h-9 gap-2 text-sm">
                <CalendarDays className="size-4" /> {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={1} className="rounded-lg border-0" />
              {dateRange?.from && (
                <div className="border-t px-3 py-2">
                  <Button type="button" variant="ghost" size="sm" className="w-full gap-2" onClick={() => setDateRange(undefined)}>
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
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Created</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Ordered</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Delivered</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Outstanding</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-gray-500">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <FileText className="size-8" />
                    <p className="text-sm">{search.trim() || dateRange?.from ? 'No orders match your filters.' : 'No orders found.'}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredOrders.map((order) => {
              const ordered = order.items.reduce((sum, item) => sum + item.ordered, 0)
              const delivered = order.items.reduce((sum, item) => sum + item.delivered, 0)
              return (
                <TableRow key={order.id} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3"><Link href={`${base}/${order.id}`} className="font-semibold text-slate-900 hover:text-core">{order.id}</Link></TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{order.customerName}</TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{formatDateValue(order.createdAt)}</TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{ordered}</TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{delivered}</TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{ordered - delivered}</TableCell>
                  <TableCell className="px-4 py-3"><StatusBadge status={order.status} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-gray-400">{filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'}</p>
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
  return value ? formatDate(new Date(value)) : '—'
}
