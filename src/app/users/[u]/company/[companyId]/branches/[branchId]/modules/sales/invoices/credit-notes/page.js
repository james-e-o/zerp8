'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Input } from '@/components/ui/input'
import { formatDate, useMoney } from '@/components/modules/sales/quotation-shared'

// Credit notes list (the whole page lives here). Credit notes are not created by hand: they come
// from a sales return, or from a cancelled order that was invoiced for goods that were never delivered.
export default function Page() {
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
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
      const { data, error } = await supabase
        .from('credit_notes')
        .select(
          `id, credit_note_number, status, total, created_at,
           invoice:sales_invoices!credit_notes_sales_invoice_fkey ( id, invoice_number, customer:customers!sales_invoices_customer_fkey ( id, name ) )`
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        console.error('Failed to load credit notes:', error)
        setErrorMessage(error.message || 'Could not load credit notes.')
        toast.error(error.message || 'Could not load credit notes.')
      } else {
        setRows(data || [])
      }
      setLoading(false)
    }
    if (branchId) load()
    return () => { cancelled = true }
  }, [branchId])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) => `${row.credit_note_number} ${row.invoice?.invoice_number || ''} ${row.invoice?.customer?.name || ''}`.toLowerCase().includes(term))
  }, [rows, search])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-3 text-xs">
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by number, invoice or customer..." className="h-8 max-w-xs text-xs" />
      {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading credit notes...</p>
      ) : visible.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border p-6 text-center text-muted-foreground">
          {search ? 'No credit note matches your search.' : 'No credit notes yet. They are issued from a return or a cancelled order.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Credit note</th>
                <th className="px-3 py-2 text-left font-medium">Customer</th>
                <th className="px-3 py-2 text-left font-medium">Invoice</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2"><Link href={`${salesBase}/invoices/credit-notes/${row.id}`} className="font-medium text-foreground hover:text-core">{row.credit_note_number}</Link></td>
                  <td className="px-3 py-2">{row.invoice?.customer?.name || '—'}</td>
                  <td className="px-3 py-2">
                    {row.invoice ? <Link href={`${salesBase}/invoices/sales-invoices/${row.invoice.id}`} className="hover:text-core">{row.invoice.invoice_number}</Link> : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2 text-right">{money(row.total)}</td>
                  <td className="px-3 py-2 text-right capitalize">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
