'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/components/modules/sales/quotation-shared'
import { DeliveryStatusPill, deliveryBasePath } from '@/components/modules/sales/delivery-shared'

// One list for every delivery tab, in Sales > Deliveries (context "sales") and in
// Inventory > Outgoing (context "inventory"; its Done tab shows Delivered).
const EMPTY_TEXT = {
  all: 'No deliveries yet.',
  pending: 'Nothing is waiting to be picked.',
  picking: 'Nothing is being picked.',
  ready: 'Nothing is waiting to be handed over.',
  delivered: 'Nothing has been delivered yet.',
  cancelled: 'No cancelled deliveries.',
}

export default function DeliveriesListPage({ status = 'all', context = 'sales' }) {
  const params = useParams()
  const { branchId } = params
  const base = deliveryBasePath(params, context)

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
        .from('deliveries')
        .select(
          `id, delivery_number, status, planned_date, created_at, delivered_at,
           sales_order:sales_orders!deliveries_sales_order_fkey ( id, order_number ),
           customer:customers!deliveries_customer_fkey ( id, name ),
           delivery_lines ( quantity, quantity_picked, quantity_delivered )`
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })
      if (status !== 'all') query = query.eq('status', status)

      const { data, error } = await query
      if (cancelled) return
      if (error) {
        console.error('Failed to load deliveries:', error)
        setErrorMessage(error.message || 'Could not load deliveries.')
        toast.error(error.message || 'Could not load deliveries.')
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
    return rows.filter((row) => `${row.delivery_number} ${row.sales_order?.order_number || ''} ${row.customer?.name || ''}`.toLowerCase().includes(term))
  }, [rows, search])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-3 text-xs">
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by delivery, order or customer..." className="h-8 max-w-xs text-xs" />

      {loading ? (
        <p className="text-muted-foreground">Loading deliveries...</p>
      ) : errorMessage ? (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">{errorMessage}</p>
      ) : visible.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          {search ? 'No delivery matches your search.' : EMPTY_TEXT[status] || EMPTY_TEXT.all}
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Delivery</th>
                <th className="px-4 py-2 text-left font-medium">Order</th>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-right font-medium">Items</th>
                <th className="px-4 py-2 text-left font-medium">Planned</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => {
                const qty = (row.delivery_lines || []).reduce((sum, line) => sum + Number(row.status === 'delivered' ? line.quantity_delivered : line.quantity), 0)
                return (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <Link href={`${base}/${row.id}`} className="font-medium text-foreground hover:text-core">{row.delivery_number}</Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{row.sales_order?.order_number || '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{row.customer?.name || '—'}</td>
                    <td className="px-4 py-2 text-right">{qty}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(row.planned_date)}</td>
                    <td className="px-4 py-2"><DeliveryStatusPill status={row.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
