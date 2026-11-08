'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/components/modules/sales/quotation-shared'
import { ReturnStatusPill } from '@/components/modules/sales/return-shared'

// One list for every Returns tab (all, requested, approved, received, cancelled).
// The Approved tab also holds returns that are partly received.
const STATUSES = {
  requested: ['requested'],
  approved: ['approved', 'partially_received'],
  received: ['received'],
  cancelled: ['cancelled'],
}
const EMPTY_TEXT = {
  all: 'No returns yet.',
  requested: 'No returns waiting for approval.',
  approved: 'No approved returns waiting for the goods.',
  received: 'No returns have been received yet.',
  cancelled: 'No cancelled returns.',
}

export default function ReturnsList({ view = 'all' }) {
  const { u, companyId, branchId } = useParams()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`

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
        .from('sales_returns')
        .select(
          `id, return_number, status, reason, created_at,
           customer:customers!sales_returns_customer_fkey ( name ),
           order:sales_orders!sales_returns_sales_order_fkey ( id, order_number ),
           delivery:deliveries!returns_delivery_fkey ( id, delivery_number )`
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })
      if (STATUSES[view]) query = query.in('status', STATUSES[view])
      const { data, error } = await query
      if (cancelled) return
      if (error) {
        console.error('Failed to load returns:', error)
        setErrorMessage(error.message || 'Could not load returns.')
        toast.error(error.message || 'Could not load returns.')
      } else {
        setRows(data || [])
      }
      setLoading(false)
    }
    if (branchId) load()
    return () => { cancelled = true }
  }, [branchId, view])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) => `${row.return_number} ${row.customer?.name || ''} ${row.order?.order_number || ''} ${row.delivery?.delivery_number || ''}`.toLowerCase().includes(term))
  }, [rows, search])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-3 text-xs">
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by return, customer, order or delivery..." className="h-8 max-w-sm text-xs" />
      {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading returns...</p>
      ) : visible.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border p-6 text-center text-muted-foreground">{search ? 'No return matches your search.' : EMPTY_TEXT[view] || EMPTY_TEXT.all}</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Return</th>
                <th className="px-3 py-2 text-left font-medium">Customer</th>
                <th className="px-3 py-2 text-left font-medium">Order</th>
                <th className="px-3 py-2 text-left font-medium">Delivery</th>
                <th className="px-3 py-2 text-left font-medium">Raised</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2"><Link href={`${salesBase}/returns/${row.id}`} className="font-medium text-foreground hover:text-core">{row.return_number}</Link></td>
                  <td className="px-3 py-2">{row.customer?.name || '—'}</td>
                  <td className="px-3 py-2">{row.order ? <Link href={`${salesBase}/orders/${row.order.id}`} className="hover:text-core">{row.order.order_number}</Link> : '—'}</td>
                  <td className="px-3 py-2">{row.delivery ? <Link href={`${salesBase}/deliveries/${row.delivery.id}`} className="hover:text-core">{row.delivery.delivery_number}</Link> : '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2 text-right"><ReturnStatusPill status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
