'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDate, useMoney } from '@/components/modules/sales/quotation-shared'
import { ProformaStatusPill, isProformaExpired } from '@/components/modules/sales/proforma-shared'

// Proforma detail. The whole page lives here (nothing else uses it).
// Actions: Edit, Print / mark as sent, Convert to invoice, Cancel.
// Converting (once the customer has approved) creates a DRAFT sales invoice with the same lines and
// discounts and opens it. The pro forma is raised on a sales order; no order is created here.
export default function Page() {
  const router = useRouter()
  const { u, companyId, branchId, proformaId } = useParams()
  const money = useMoney()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const base = `${salesBase}/invoices/proforma-invoices`

  const [proforma, setProforma] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [working, setWorking] = useState(false)
  const [action, setAction] = useState(null) // 'convert' | 'cancel'
  const [cancelReason, setCancelReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('proforma_invoices')
      .select(
        `id, proforma_number, status, valid_until, discount_type, discount_value, apply_vat, vat_rate, notes,
         subtotal, discount_total, vat_total, total, sent_at, converted_at, cancelled_at, cancel_reason, created_at,
         customer:customers!proforma_invoices_customer_fkey ( id, name, customer_number ),
         order:sales_orders!proforma_invoices_sales_order_fkey ( id, order_number ),
         invoice:sales_invoices!proforma_invoices_converted_invoice_fkey ( id, invoice_number )`
      )
      .eq('id', proformaId)
      .eq('branch', branchId)
      .maybeSingle()
    if (error || !data) {
      const message = error?.message || 'Proforma not found.'
      console.error('Failed to load proforma:', error)
      setErrorMessage(message)
      toast.error(message)
      setLoading(false)
      return
    }
    setProforma(data)
    const { data: lineRows, error: lineError } = await supabase
      .from('proforma_invoice_line_items')
      .select('id, description_snapshot, variant_label_snapshot, sku_snapshot, quantity, unit_price_snapshot, discount_type, discount_value, line_total, position')
      .eq('proforma_invoice', proformaId)
      .order('position')
    if (lineError) {
      console.error('Failed to load proforma lines:', lineError)
      toast.error(lineError.message)
    }
    setLines(lineRows || [])
    setLoading(false)
  }, [proformaId, branchId])

  useEffect(() => {
    if (proformaId && branchId) load()
  }, [proformaId, branchId, load])

  async function run(name, args, success, fallback) {
    setWorking(true)
    const { data, error } = await supabase.rpc(name, args)
    setWorking(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || fallback
      console.error(`${name} failed:`, error || data)
      toast.error(message)
      return null
    }
    toast.success(success)
    return data
  }

  const handleSent = async () => {
    const data = await run('mark_proforma_sent', { p_proforma: proformaId }, 'Marked as sent.', 'Could not mark it as sent.')
    if (data) load()
  }

  const handlePrint = async () => {
    if (['saved', 'draft'].includes(proforma.status)) {
      const data = await run('mark_proforma_sent', { p_proforma: proformaId }, 'Marked as sent.', 'Could not mark it as sent.')
      if (data) await load()
    }
    window.print()
  }

  const handleConvert = async () => {
    const data = await run('convert_proforma_to_invoice', { p_proforma: proformaId }, 'Converted. Review the draft invoice and issue it.', 'Could not convert the proforma.')
    setAction(null)
    if (data) router.push(`${salesBase}/invoices/sales-invoices/${data.invoice_id}`)
  }

  const handleCancel = async () => {
    const data = await run('cancel_proforma', { p_proforma: proformaId, p_reason: cancelReason || null }, 'Proforma cancelled.', 'Could not cancel the proforma.')
    if (!data) return
    setAction(null)
    setCancelReason('')
    load()
  }

  if (loading && !proforma) return <p className="px-1 py-3 text-xs text-muted-foreground">Loading proforma...</p>
  if (errorMessage && !proforma) return <p role="alert" className="m-3 border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>
  if (!proforma) return null

  const open = ['draft', 'saved', 'sent'].includes(proforma.status)
  const expired = isProformaExpired(proforma)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{proforma.proforma_number}</h2>
          <ProformaStatusPill proforma={proforma} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={handlePrint}>Print / PDF</Button>
          {open && (
            <>
              <Button asChild variant="outline" className="h-8 text-xs"><Link href={`${base}/${proformaId}/edit`}>Edit</Link></Button>
              {proforma.status !== 'sent' && (
                <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={handleSent}>Mark as sent</Button>
              )}
              <Button type="button" variant="outline" className="h-8 text-xs text-red-600" disabled={working} onClick={() => setAction('cancel')}>Cancel</Button>
              <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working || expired} onClick={() => setAction('convert')}>Convert to invoice</Button>
            </>
          )}
        </div>
      </div>

      {expired && open && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 p-2 text-amber-800 print:hidden">
          This proforma has expired. Edit the valid-until date if the offer still stands.
        </p>
      )}
      {proforma.status === 'cancelled' && (
        <p className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700 print:hidden">
          Cancelled on {formatDate(proforma.cancelled_at)}{proforma.cancel_reason ? `: ${proforma.cancel_reason}` : '.'}
        </p>
      )}
      {proforma.status === 'converted' && (
        <p className="rounded-sm border border-emerald-200 bg-emerald-50 p-2 text-emerald-800 print:hidden">
          Converted on {formatDate(proforma.converted_at)}
          {proforma.order && <> to order <Link href={`${salesBase}/orders/${proforma.order.id}`} className="font-medium underline">{proforma.order.order_number}</Link></>}
          {proforma.invoice && <> and invoice <Link href={`${salesBase}/invoices/sales-invoices/${proforma.invoice.id}`} className="font-medium underline">{proforma.invoice.invoice_number}</Link></>}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-sm border border-border p-3 sm:grid-cols-4">
        <div><p className="text-[10px] text-muted-foreground">Customer</p><p className="font-medium">{proforma.customer?.name || '—'}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Created</p><p className="font-medium">{formatDate(proforma.created_at)}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Valid until</p><p className="font-medium">{formatDate(proforma.valid_until)}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Sent</p><p className="font-medium">{proforma.sent_at ? formatDate(proforma.sent_at) : '—'}</p></div>
        {proforma.notes && <div className="col-span-2 sm:col-span-4"><p className="text-[10px] text-muted-foreground">Note</p><p className="whitespace-pre-wrap">{proforma.notes}</p></div>}
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="bg-muted text-[10px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit price</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">
                  {line.description_snapshot}{line.variant_label_snapshot ? ` - ${line.variant_label_snapshot}` : ''}
                  {line.sku_snapshot && <span className="block text-[10px] text-muted-foreground">{line.sku_snapshot}</span>}
                </td>
                <td className="px-3 py-2 text-right">{Number(line.quantity)}</td>
                <td className="px-3 py-2 text-right">{money(line.unit_price_snapshot)}</td>
                <td className="px-3 py-2 text-right">{money(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-xs space-y-1 rounded-sm border border-border p-3">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(proforma.subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{Number(proforma.discount_total) ? `-${money(proforma.discount_total)}` : money(0)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{money(proforma.vat_total)}</span></div>
        <div className="flex justify-between border-t border-border pt-1 text-sm font-semibold"><span>Total</span><span>{money(proforma.total)}</span></div>
      </div>

      <AlertDialog open={action === 'convert'} onOpenChange={(isOpen) => { if (!isOpen && !working) setAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert {proforma.proforma_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only convert once the customer has approved this pro forma. It creates a draft sales invoice with the same lines and discounts. You can still change the discounts on the draft before issuing it (they replace these, they do not add to them).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Not yet</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); handleConvert() }}>{working ? 'Converting...' : 'Convert'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={action === 'cancel'} onOpenChange={(isOpen) => { if (!isOpen && !working) setAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {proforma.proforma_number}?</AlertDialogTitle>
            <AlertDialogDescription>Nothing was reserved or posted, so this only closes the offer.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Reason (optional)" className="min-h-16 text-xs" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Keep it</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); handleCancel() }}>{working ? 'Cancelling...' : 'Cancel proforma'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
