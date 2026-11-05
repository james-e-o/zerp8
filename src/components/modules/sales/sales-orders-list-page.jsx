'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Input } from '@/components/ui/input'
import { OrderStatusPill, ReturnPill, formatDate, useMoney } from '@/components/modules/sales/quotation-shared'

// One list for every Orders tab except Draft (drafts are a different table,
// see SalesOrderDraftsListPage). `status` is the database status or 'all'.
const EMPTY_TEXT = {
  all: 'No sales orders yet.',
  open: 'No open orders.',
  partially_fulfilled: 'No partially fulfilled orders.',
  fulfilled: 'No completed orders.',
  cancelled: 'No cancelled orders.',
}

export default function SalesOrdersListPage({ status = 'all' }) {
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/orders`

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErrorMessage('')
      let query = supabase
        .from('sales_orders')
        .select(
          `id, order_number, status, return_status, order_date, requested_delivery_date, total, created_at,
           customer:customers!sales_orders_customer_fkey ( id, name, customer_number )`
        )
        .eq('branch', branchId)
        .neq('status', 'draft')
        .order('created_at', { ascending: false })
      if (status === 'cancelled') query = query.in('status', ['cancelled', 'cancelled_partial'])
      else if (status !== 'all') query = query.eq('status', status)

      const { data, error } = await query
      if (cancelled) return
      if (error) {
        console.error('Failed to load sales orders:', error)
        setErrorMessage(error.message || 'Could not load sales orders.')
        toast.error(error.message || 'Could not load sales orders.')
      } else {
        setRows(data || [])
      }
      setLoading(false)
    }
    if (branchId) load()
    return () => {
      cancelled = true
    }
  }, [branchId, status])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) => `${row.order_number} ${row.customer?.name || ''} ${row.customer?.customer_number || ''}`.toLowerCase().includes(term))
  }, [rows, search])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-3 text-xs">
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by number or customer..." className="h-8 max-w-xs text-xs" />

      {loading ? (
        <p className="text-muted-foreground">Loading sales orders...</p>
      ) : errorMessage ? (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">{errorMessage}</p>
      ) : visible.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          {search ? 'No order matches your search.' : EMPTY_TEXT[status] || EMPTY_TEXT.all}
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Order</th>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-left font-medium">Order date</th>
                <th className="px-4 py-2 text-left font-medium">Requested delivery</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link href={`${base}/${row.id}`} className="font-medium text-foreground hover:text-core">{row.order_number}</Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.customer ? (
                      <>
                        {row.customer.name}
                        <span className="ml-1 text-[10px]">{row.customer.customer_number}</span>
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">{money(row.total)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(row.order_date)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(row.requested_delivery_date)}</td>
                  <td className="px-4 py-2"><span className="flex flex-wrap items-center gap-1"><OrderStatusPill status={row.status} /><ReturnPill status={row.return_status} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
