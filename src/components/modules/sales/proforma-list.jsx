'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Input } from '@/components/ui/input'
import { formatDate, useMoney } from '@/components/modules/sales/quotation-shared'
import { ProformaStatusPill } from '@/components/modules/sales/proforma-shared'

// One list for every Proforma tab (all, saved, sent, converted, cancelled).
const EMPTY_TEXT = {
  all: 'No proforma invoices yet.',
  saved: 'No saved proforma invoices.',
  sent: 'No sent proforma invoices.',
  converted: 'Nothing has been converted yet.',
  cancelled: 'No cancelled proforma invoices.',
}

export default function ProformaList({ view = 'all' }) {
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices/proforma-invoices`
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
        .from('proforma_invoices')
        .select(
          `id, proforma_number, status, valid_until, total, created_at,
           customer:customers!proforma_invoices_customer_fkey ( id, name, customer_number ),
           invoice:sales_invoices!proforma_invoices_converted_invoice_fkey ( id, invoice_number )`
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })
      if (view !== 'all') query = query.eq('status', view)
      const { data, error } = await query
      if (cancelled) return
      if (error) {
        console.error('Failed to load proforma invoices:', error)
        setErrorMessage(error.message || 'Could not load proforma invoices.')
        toast.error(error.message || 'Could not load proforma invoices.')
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
    return rows.filter((row) => `${row.proforma_number} ${row.customer?.name || ''} ${row.customer?.customer_number || ''}`.toLowerCase().includes(term))
  }, [rows, search])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-3 text-xs">
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by number or customer..." className="h-8 max-w-xs text-xs" />
      {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading proforma invoices...</p>
      ) : visible.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border p-6 text-center text-muted-foreground">
          {search ? 'No proforma matches your search.' : EMPTY_TEXT[view] || EMPTY_TEXT.all}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Proforma</th>
                <th className="px-3 py-2 text-left font-medium">Customer</th>
                <th className="px-3 py-2 text-left font-medium">Valid until</th>
                <th className="px-3 py-2 text-left font-medium">Invoice</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2"><Link href={`${base}/${row.id}`} className="font-medium text-foreground hover:text-core">{row.proforma_number}</Link></td>
                  <td className="px-3 py-2">{row.customer?.name || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(row.valid_until)}</td>
                  <td className="px-3 py-2">
                    {row.invoice ? <Link href={`${salesBase}/invoices/sales-invoices/${row.invoice.id}`} className="hover:text-core">{row.invoice.invoice_number}</Link> : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{money(row.total)}</td>
                  <td className="px-3 py-2 text-right"><ProformaStatusPill proforma={row} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
