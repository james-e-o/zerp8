'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { formatDate, useMoney } from '@/components/modules/sales/quotation-shared'

// Credit note detail. The whole page lives here (nothing else uses it).
// A credit note lowers what the customer owes on one invoice. If they had already paid, the
// refund is recorded on that invoice.
export default function Page() {
  const { u, companyId, branchId, creditNoteId } = useParams()
  const money = useMoney()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`

  const [note, setNote] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!creditNoteId || !branchId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('credit_notes')
        .select(
          `id, credit_note_number, status, total, note, created_at,
           invoice:sales_invoices!credit_notes_sales_invoice_fkey ( id, invoice_number, customer:customers!sales_invoices_customer_fkey ( id, name ) ),
           sales_return:sales_returns!credit_notes_return_record_fkey ( id, return_number )`
        )
        .eq('id', creditNoteId)
        .eq('branch', branchId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        const message = error?.message || 'Credit note not found.'
        console.error('Failed to load credit note:', error)
        setErrorMessage(message)
        toast.error(message)
        setLoading(false)
        return
      }
      setNote(data)
      const { data: lineRows, error: lineError } = await supabase
        .from('credit_note_line_items')
        .select('id, description_snapshot, quantity, unit_price_snapshot, line_total')
        .eq('credit_note', creditNoteId)
      if (cancelled) return
      if (lineError) {
        console.error('Failed to load credit note lines:', lineError)
        toast.error(lineError.message)
      }
      setLines(lineRows || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [creditNoteId, branchId])

  if (loading) return <p className="px-1 py-3 text-xs text-muted-foreground">Loading credit note...</p>
  if (errorMessage && !note) return <p role="alert" className="m-3 border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>
  if (!note) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{note.credit_note_number}</h2>
          <span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium capitalize text-emerald-700">{note.status}</span>
        </div>
        <button type="button" onClick={() => window.print()} className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">Print / PDF</button>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-sm border border-border p-3 sm:grid-cols-4">
        <div><p className="text-[10px] text-muted-foreground">Customer</p><p className="font-medium">{note.invoice?.customer?.name || '—'}</p></div>
        <div>
          <p className="text-[10px] text-muted-foreground">Invoice</p>
          <p className="font-medium">{note.invoice ? <Link href={`${salesBase}/invoices/sales-invoices/${note.invoice.id}`} className="hover:text-core">{note.invoice.invoice_number}</Link> : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Return</p>
          <p className="font-medium">{note.sales_return ? <Link href={`${salesBase}/returns/${note.sales_return.id}`} className="hover:text-core">{note.sales_return.return_number}</Link> : '—'}</p>
        </div>
        <div><p className="text-[10px] text-muted-foreground">Issued</p><p className="font-medium">{formatDate(note.created_at)}</p></div>
        {note.note && <div className="col-span-2 sm:col-span-4"><p className="text-[10px] text-muted-foreground">Note</p><p>{note.note}</p></div>}
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="bg-muted text-[10px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty credited</th>
              <th className="px-3 py-2 text-right font-medium">Unit price</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">{line.description_snapshot || 'Item'}</td>
                <td className="px-3 py-2 text-right">{Number(line.quantity)}</td>
                <td className="px-3 py-2 text-right">{money(line.unit_price_snapshot)}</td>
                <td className="px-3 py-2 text-right">{money(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-xs space-y-1 rounded-sm border border-border p-3">
        <div className="flex justify-between border-b border-border pb-1 text-[10px] text-muted-foreground"><span>Lines, before discount and VAT</span><span>{money(lines.reduce((sum, line) => sum + Number(line.line_total), 0))}</span></div>
        <div className="flex justify-between text-sm font-semibold"><span>Credit total</span><span>{money(note.total)}</span></div>
        <p className="pt-1 text-[10px] text-muted-foreground">The total includes the invoice's share of discount and VAT.</p>
      </div>
    </div>
  )
}
