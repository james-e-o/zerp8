'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Input } from '@/components/ui/input'
import { QuotationStatusPill, formatDate, isQuotationExpired, useMoney } from '@/components/modules/sales/quotation-shared'

// One list for every Quotations tab. Drafts are a different table, so the Draft tab uses
// QuotationDraftsListPage. "Sent" means sent and still valid; "Expired" is a sent
// quotation whose valid-until date has passed (worked out here, never stored).
const EMPTY_TEXT = {
  all: 'No quotations yet.',
  sent: 'No quotations are waiting for an answer.',
  accepted: 'No accepted quotations.',
  rejected: 'No rejected quotations.',
  expired: 'No expired quotations.',
}

export default function QuotationsListPage({ status = 'all' }) {
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`

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
        .from('quotations')
        .select(
          `id, quote_number, status, valid_until, total, created_at, sent_at,
           customer:customers!quotations_customer_fkey ( id, name, customer_number )`
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })

      if (status === 'sent' || status === 'expired') query = query.eq('status', 'sent')
      else if (status === 'accepted' || status === 'rejected') query = query.eq('status', status)

      const { data, error } = await query
      if (cancelled) return
      if (error) {
        console.error('Failed to load quotations:', error)
        setErrorMessage(error.message || 'Could not load quotations.')
        toast.error(error.message || 'Could not load quotations.')
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
    return rows.filter((row) => {
      if (status === 'sent' && isQuotationExpired(row)) return false
      if (status === 'expired' && !isQuotationExpired(row)) return false
      if (!term) return true
      return `${row.quote_number} ${row.customer?.name || ''} ${row.customer?.customer_number || ''}`.toLowerCase().includes(term)
    })
  }, [rows, status, search])

  return (
    <div className="flex flex-col gap-3 px-1 py-3 text-xs">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by number or customer..."
        className="h-8 max-w-xs text-xs"
      />

      {loading ? (
        <p className="text-muted-foreground">Loading quotations...</p>
      ) : errorMessage ? (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">{errorMessage}</p>
      ) : visible.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          {search ? 'No quotation matches your search.' : EMPTY_TEXT[status] || EMPTY_TEXT.all}
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Quotation</th>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-left font-medium">Valid until</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link href={`${base}/${row.id}`} className="font-medium text-foreground hover:text-core">{row.quote_number}</Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.customer ? (
                      <>
                        {row.customer.name}
                        <span className="ml-1 text-[10px]">{row.customer.customer_number}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{money(row.total)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(row.valid_until)}</td>
                  <td className="px-4 py-2"><QuotationStatusPill quotation={row} /></td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
