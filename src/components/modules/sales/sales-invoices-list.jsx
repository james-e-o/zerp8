'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Input } from '@/components/ui/input'
import { formatDate, useMoney } from '@/components/modules/sales/quotation-shared'
import { InvoiceStatusPill, balanceOf } from '@/components/modules/sales/invoice-shared'

// One list for every Invoices tab. `view` is the tab: all, draft, unpaid, partially_paid, paid,
// overdue (unpaid or partly paid and past its due date) or cancelled.
const EMPTY_TEXT = {
  all: 'No invoices yet. Invoices are raised from a sales order.',
  draft: 'No draft invoices.',
  unpaid: 'No unpaid invoices.',
  partially_paid: 'No partly paid invoices.',
  paid: 'No paid invoices.',
  overdue: 'Nothing is overdue.',
  cancelled: 'No cancelled invoices.',
}

export default function SalesInvoicesList({ view = 'all' }) {
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices/sales-invoices`
  const ordersBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/orders`

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
        .from('sales_invoices')
        .select(
          `id, invoice_number, status, issued_at, due_date, total, paid, created_at,
           customer:customers!sales_invoices_customer_fkey ( id, name, customer_number ),
           order:sales_orders!sales_invoices_sales_order_fkey ( id, order_number )`
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })
      if (view === 'overdue') query = query.in('status', ['unpaid', 'partially_paid']).lt('due_date', new Date().toISOString())
      else if (view !== 'all') query = query.eq('status', view)

      const { data, error } = await query
      if (cancelled) return
      if (error) {
        console.error('Failed to load invoices:', error)
        setErrorMessage(error.message || 'Could not load invoices.')
        toast.error(error.message || 'Could not load invoices.')
      } else {
        setRows(data || [])
      }
      setLoading(false)
    }
    if (branchId) load()
    return () => {
      cancelled = true
    }
  }, [branchId, view])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) =>
      `${row.invoice_number} ${row.order?.order_number || ''} ${row.customer?.name || ''} ${row.customer?.customer_number || ''}`.toLowerCase().includes(term)
    )
  }, [rows, search])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-3 text-xs">
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by number, order or customer..." className="h-8 max-w-xs text-xs" />

      {loading ? (
        <p className="text-muted-foreground">Loading invoices...</p>
      ) : errorMessage ? (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">{errorMessage}</p>
      ) : visible.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          {search ? 'No invoice matches your search.' : EMPTY_TEXT[view] || EMPTY_TEXT.all}
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Invoice</th>
                <th className="px-4 py-2 text-left font-medium">Order</th>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
                <th className="px-4 py-2 text-left font-medium">Issued</th>
                <th className="px-4 py-2 text-left font-medium">Due</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link href={`${base}/${row.id}`} className="font-medium text-foreground hover:text-core">{row.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.order ? <Link href={`${ordersBase}/${row.order.id}`} className="hover:text-core">{row.order.order_number}</Link> : '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{row.customer?.name || '—'}</td>
                  <td className="px-4 py-2 text-right">{money(row.total)}</td>
                  <td className="px-4 py-2 text-right">{['draft', 'cancelled'].includes(row.status) ? '—' : money(balanceOf(row))}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.status === 'draft' ? '—' : formatDate(row.issued_at)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(row.due_date)}</td>
                  <td className="px-4 py-2"><InvoiceStatusPill invoice={row} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
