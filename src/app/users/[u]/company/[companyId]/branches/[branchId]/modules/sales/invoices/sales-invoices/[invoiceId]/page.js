'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { formatDate, toDateInput, useMoney } from '@/components/modules/sales/quotation-shared'
import { InvoiceStatusPill, PAYMENT_METHODS, balanceOf, methodLabel } from '@/components/modules/sales/invoice-shared'

// Sales invoice detail. This is the whole page (nothing else uses it). Draft: edit, issue or cancel. Issued: record payments.
// An issued invoice can be cancelled (whole invoice, with a reason) only while nothing has been paid, credited or refunded on it;
// after that it is only reduced by credit notes (issued from the order or a sales return). When the customer
// has paid more than they now owe, Refund pays it back.
export default function Page() {
  const router = useRouter()
  const { u, companyId, branchId, invoiceId } = useParams()
  const money = useMoney()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`

  const [invoice, setInvoice] = useState(null)
  const [lines, setLines] = useState([])
  const [payments, setPayments] = useState([])
  const [refunds, setRefunds] = useState([])
  const [creditNotes, setCreditNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [working, setWorking] = useState(false)
  const [action, setAction] = useState(null) // 'issue' | 'cancel' | 'pay'
  const [cancelReason, setCancelReason] = useState('')
  const [refundMethod, setRefundMethod] = useState('bank_transfer') // branch default (Sales settings > Returns)
  const [advanceLeft, setAdvanceLeft] = useState(0) // the customer's open advances, usable on this invoice
  const [pay, setPay] = useState({ amount: '', method: 'bank_transfer', reference: '', paidOn: '', note: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('sales_invoices')
      .select(
        `id, invoice_number, status, issued_at, due_date, subtotal, discount_total, vat_total, total, credited, paid, notes, payment_terms,
         cancelled_at, cancel_reason, created_at,
         customer:customers!sales_invoices_customer_fkey ( id, name, customer_number ),
         order:sales_orders!sales_invoices_sales_order_fkey ( id, order_number )`
      )
      .eq('id', invoiceId)
      .maybeSingle()
    if (error || !data) {
      const message = error?.message || 'Invoice not found.'
      console.error('Failed to load invoice:', error)
      setErrorMessage(message)
      toast.error(message)
      setLoading(false)
      return
    }
    setInvoice(data)

    const [{ data: lineRows, error: lineError }, { data: paymentRows, error: paymentError }, { data: refundRows, error: refundError }, { data: creditRows, error: creditError }] = await Promise.all([
      supabase.from('sales_invoice_line_items').select('id, description_snapshot, quantity, unit_price_snapshot, line_total, discount_type, discount_value, position').eq('sales_invoice', invoiceId).order('position'),
      supabase.from('payments').select('id, amount, method, reference, paid_at, note').eq('sales_invoice', invoiceId).order('paid_at', { ascending: false }),
      supabase.from('sales_refunds').select('id, amount, method, reference, refunded_at, note').eq('sales_invoice', invoiceId).order('refunded_at', { ascending: false }),
      supabase.from('credit_notes').select('id, credit_note_number, total, status, created_at').eq('sales_invoice', invoiceId).order('created_at', { ascending: false }),
    ])
    const loadError = lineError || paymentError || refundError || creditError
    if (loadError) {
      console.error('Failed to load invoice details:', loadError)
      toast.error(loadError.message)
    }
    setLines(lineRows || [])
    setPayments(paymentRows || [])
    setRefunds(refundRows || [])
    setCreditNotes(creditRows || [])
    if (['unpaid', 'partially_paid'].includes(data.status) && data.customer?.id) {
      const { data: position, error: positionError } = await supabase.rpc('customer_payment_position', { p_branch: branchId, p_customer: data.customer.id })
      if (positionError) console.error('Failed to load the customer advance:', positionError)
      setAdvanceLeft(Number(position?.advance || 0))
    } else {
      setAdvanceLeft(0)
    }
    setLoading(false)
  }, [invoiceId, branchId])

  useEffect(() => {
    if (invoiceId) load()
  }, [invoiceId, load])

  useEffect(() => {
    if (!branchId) return
    supabase.rpc('get_return_rules', { p_branch: branchId }).then(({ data, error }) => {
      if (error) console.error('Failed to load the refund method:', error)
      else if (data?.success && data.default_refund_method) setRefundMethod(data.default_refund_method)
    })
  }, [branchId])

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

  const handleIssue = async () => {
    const data = await run('issue_sales_invoice', { p_invoice: invoiceId }, 'Invoice issued.', 'Could not issue the invoice.')
    setAction(null)
    if (data) load()
  }

  const handleCancel = async () => {
    const isDraft = invoice.status === 'draft'
    if (!isDraft && !cancelReason.trim()) {
      toast.error('Give a reason for cancelling this invoice.')
      return
    }
    const data = await run('cancel_sales_invoice', { p_invoice: invoiceId, p_reason: cancelReason || null }, isDraft ? 'Draft invoice cancelled.' : 'Invoice cancelled. Its quantities can be invoiced again.', 'Could not cancel the invoice.')
    if (!data) return
    setAction(null)
    setCancelReason('')
    load()
  }

  const refundable = invoice ? Math.max(0, Math.round((Number(invoice.paid) - (Number(invoice.total) - Number(invoice.credited || 0))) * 100) / 100) : 0

  const handleUseAdvance = async () => {
    const data = await run('apply_customer_advance_to_invoice', { p_invoice: invoiceId }, 'Advance applied to this invoice.', 'Could not use the advance.')
    setAction(null)
    if (data) load()
  }

  const openRefund = () => {
    setPay({ amount: String(refundable), method: refundMethod, reference: '', paidOn: toDateInput(new Date()), note: '' })
    setAction('refund')
  }

  const handleRefund = async () => {
    const amount = Number(pay.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount above zero.')
      return
    }
    if (amount > refundable) {
      toast.error(`At most ${money(refundable)} can be refunded on this invoice.`)
      return
    }
    const data = await run(
      'record_sales_refund',
      {
        p_invoice: invoiceId,
        p_amount: amount,
        p_method: pay.method,
        p_reference: pay.reference || null,
        p_refunded_at: pay.paidOn ? new Date(pay.paidOn).toISOString() : null,
        p_note: pay.note || null,
      },
      'Refund recorded.',
      'Could not record the refund.'
    )
    if (!data) return
    setAction(null)
    load()
  }

  const openPay = () => {
    setPay({ amount: String(balanceOf(invoice)), method: 'bank_transfer', reference: '', paidOn: toDateInput(new Date()), note: '' })
    setAction('pay')
  }

  const handlePay = async () => {
    const amount = Number(pay.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount above zero.')
      return
    }
    if (amount > balanceOf(invoice)) {
      toast.error(`The balance on this invoice is ${money(balanceOf(invoice))}.`)
      return
    }
    const data = await run(
      'record_sales_payment',
      {
        p_invoice: invoiceId,
        p_amount: amount,
        p_method: pay.method,
        p_reference: pay.reference || null,
        p_paid_at: pay.paidOn ? new Date(pay.paidOn).toISOString() : null,
        p_note: pay.note || null,
      },
      'Payment recorded.',
      'Could not record the payment.'
    )
    if (!data) return
    setAction(null)
    load()
  }

  if (loading && !invoice) return <p className="px-1 py-3 text-xs text-muted-foreground">Loading invoice...</p>
  if (errorMessage && !invoice) return <p role="alert" className="m-3 border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>
  if (!invoice) return null

  const balance = balanceOf(invoice)
  const canPay = ['unpaid', 'partially_paid'].includes(invoice.status)
  // A posted invoice can be cancelled only while no money or credit has touched it.
  const canCancelPosted =
    invoice.status === 'unpaid' && payments.length === 0 && refunds.length === 0 && creditNotes.length === 0 && Number(invoice.credited || 0) === 0 && Number(invoice.paid || 0) === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{invoice.invoice_number}</h2>
          <InvoiceStatusPill invoice={invoice} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => window.print()}>Print / PDF</Button>
          {invoice.status === 'draft' && (
            <>
              <Button asChild variant="outline" className="h-8 text-xs"><Link href={`${salesBase}/invoices/sales-invoices/${invoiceId}/edit`}>Edit</Link></Button>
              <Button type="button" variant="outline" className="h-8 text-xs text-red-600" disabled={working} onClick={() => setAction('cancel')}>Cancel draft</Button>
              <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={() => setAction('issue')}>Issue invoice</Button>
            </>
          )}
          {canCancelPosted && (
            <Button type="button" variant="outline" className="h-8 text-xs text-red-600" disabled={working} onClick={() => setAction('cancel')}>Cancel invoice</Button>
          )}
          {refundable > 0 && <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={openRefund}>Refund {money(refundable)}</Button>}
          {canPay && advanceLeft > 0 && (
            <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={() => setAction('advance')}>Use advance ({money(advanceLeft)})</Button>
          )}
          {canPay && <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={openPay}>Record payment</Button>}
        </div>
      </div>

      {invoice.status === 'cancelled' && (
        <p className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700 print:hidden">
          Cancelled on {formatDate(invoice.cancelled_at)}{invoice.cancel_reason ? `: ${invoice.cancel_reason}` : '.'}
        </p>
      )}
      {invoice.status === 'draft' && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 p-2 text-amber-800 print:hidden">
          This is a draft. It does not count against the order until it is issued.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-sm border border-border p-3 sm:grid-cols-4">
        <div><p className="text-[10px] text-muted-foreground">Customer</p><p className="font-medium">{invoice.customer?.name || '—'}</p></div>
        <div>
          <p className="text-[10px] text-muted-foreground">Sales order</p>
          <p className="font-medium">{invoice.order ? <Link href={`${salesBase}/orders/${invoice.order.id}`} className="hover:text-core">{invoice.order.order_number}</Link> : '—'}</p>
        </div>
        <div><p className="text-[10px] text-muted-foreground">Issued</p><p className="font-medium">{invoice.status === 'draft' ? '—' : formatDate(invoice.issued_at)}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Due</p><p className="font-medium">{formatDate(invoice.due_date)}</p></div>
        {invoice.payment_terms && <div className="col-span-2"><p className="text-[10px] text-muted-foreground">Payment terms</p><p className="font-medium">{invoice.payment_terms}</p></div>}
        {invoice.notes && <div className="col-span-2 sm:col-span-4"><p className="text-[10px] text-muted-foreground">Note</p><p>{invoice.notes}</p></div>}
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-muted text-[10px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit price</th>
              <th className="px-3 py-2 text-right font-medium">Discount</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">{line.description_snapshot}</td>
                <td className="px-3 py-2 text-right">{Number(line.quantity)}</td>
                <td className="px-3 py-2 text-right">{money(line.unit_price_snapshot)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{Number(line.discount_value) > 0 ? (line.discount_type === 'percentage' ? `${Number(line.discount_value)}%` : money(line.discount_value)) : '—'}</td>
                <td className="px-3 py-2 text-right">{money(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-xs space-y-1 rounded-sm border border-border p-3">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(invoice.subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Discount on the whole invoice</span><span>{Number(invoice.discount_total) ? `-${money(invoice.discount_total)}` : money(0)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{money(invoice.vat_total)}</span></div>
        <div className="flex justify-between border-t border-border pt-1 text-sm font-semibold"><span>Total</span><span>{money(invoice.total)}</span></div>
        {!['draft', 'cancelled'].includes(invoice.status) && (
          <>
            {Number(invoice.credited) > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Credited</span><span>-{money(invoice.credited)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{money(invoice.paid)}</span></div>
            <div className="flex justify-between font-semibold"><span>Balance</span><span>{money(balance)}</span></div>
          </>
        )}
      </div>

      {creditNotes.length > 0 && (
        <div className="rounded-sm border border-border bg-card">
          <h3 className="border-b border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground">Credit notes</h3>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {creditNotes.map((note) => (
                <tr key={note.id}>
                  <td className="px-4 py-2"><Link href={`${salesBase}/invoices/credit-notes/${note.id}`} className="font-medium hover:text-core">{note.credit_note_number}</Link></td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(note.created_at)}</td>
                  <td className="px-4 py-2 text-right font-medium">-{money(note.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {refunds.length > 0 && (
        <div className="rounded-sm border border-border bg-card">
          <h3 className="border-b border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground">Refunds</h3>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {refunds.map((refund) => (
                <tr key={refund.id}>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(refund.refunded_at)}</td>
                  <td className="px-4 py-2">{methodLabel(refund.method)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{refund.reference || '—'}{refund.note ? ` · ${refund.note}` : ''}</td>
                  <td className="px-4 py-2 text-right font-medium">-{money(refund.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payments.length > 0 && (
        <div className="rounded-sm border border-border bg-card">
          <h3 className="border-b border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground">Payments</h3>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(payment.paid_at)}</td>
                  <td className="px-4 py-2">{methodLabel(payment.method)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{payment.reference || '—'}{payment.note ? ` · ${payment.note}` : ''}</td>
                  <td className="px-4 py-2 text-right font-medium">{money(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={action === 'advance'} onOpenChange={(isOpen) => { if (!isOpen && !working) setAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use {invoice.customer?.name || 'the customer'}&apos;s advance?</AlertDialogTitle>
            <AlertDialogDescription>
              {money(advanceLeft)} of advance is available. It is applied to this invoice, oldest advance first, up to the balance of {money(balance)}. It shows as a payment on the invoice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Not now</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); handleUseAdvance() }}>{working ? 'Applying...' : 'Use advance'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={action === 'issue'} onOpenChange={(open) => { if (!open && !working) setAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue {invoice.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              It will count against the order's invoiced quantities and can no longer be edited. Until a payment is recorded it can still be cancelled; after that, a mistake is corrected with a credit note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Not yet</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); handleIssue() }}>{working ? 'Issuing...' : 'Issue invoice'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={action === 'cancel'} onOpenChange={(open) => { if (!open && !working) setAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{invoice.status === 'draft' ? `Cancel draft ${invoice.invoice_number}?` : `Cancel invoice ${invoice.invoice_number}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {invoice.status === 'draft'
                ? 'Nothing has been posted, so this simply discards the draft.'
                : 'The whole invoice is cancelled and its quantities can be invoiced again. This is possible only because nothing has been paid on it. It cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder={invoice.status === 'draft' ? 'Reason (optional)' : 'Reason (required)'} className="min-h-16 text-xs" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>{invoice.status === 'draft' ? 'Keep draft' : 'Keep invoice'}</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); handleCancel() }}>{working ? 'Cancelling...' : invoice.status === 'draft' ? 'Cancel draft' : 'Cancel invoice'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={action === 'pay'} onOpenChange={(open) => { if (!open && !working) setAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record a payment</AlertDialogTitle>
            <AlertDialogDescription>Balance on {invoice.invoice_number}: {money(balance)}. A payment cannot be more than the balance.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[10px] text-muted-foreground">
              Amount
              <Input type="number" min="0" step="any" value={pay.amount} onChange={(event) => setPay({ ...pay, amount: event.target.value })} className="mt-0.5 h-8 text-xs" />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Paid on
              <Input type="date" value={pay.paidOn} onChange={(event) => setPay({ ...pay, paidOn: event.target.value })} className="mt-0.5 h-8 text-xs" />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Method
              <select value={pay.method} onChange={(event) => setPay({ ...pay, method: event.target.value })} className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                {PAYMENT_METHODS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </select>
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Reference
              <Input value={pay.reference} onChange={(event) => setPay({ ...pay, reference: event.target.value })} className="mt-0.5 h-8 text-xs" placeholder="Transfer or receipt no." />
            </label>
            <label className="col-span-2 block text-[10px] text-muted-foreground">
              Note
              <Input value={pay.note} onChange={(event) => setPay({ ...pay, note: event.target.value })} className="mt-0.5 h-8 text-xs" placeholder="Optional" />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Close</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); handlePay() }}>{working ? 'Saving...' : 'Record payment'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={action === 'refund'} onOpenChange={(open) => { if (!open && !working) setAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund the customer</AlertDialogTitle>
            <AlertDialogDescription>The customer has paid {money(refundable)} more than they now owe on {invoice.invoice_number}. A refund cannot be more than that.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[10px] text-muted-foreground">
              Amount
              <Input type="number" min="0" step="any" value={pay.amount} onChange={(event) => setPay({ ...pay, amount: event.target.value })} className="mt-0.5 h-8 text-xs" />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Refunded on
              <Input type="date" value={pay.paidOn} onChange={(event) => setPay({ ...pay, paidOn: event.target.value })} className="mt-0.5 h-8 text-xs" />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Method
              <select value={pay.method} onChange={(event) => setPay({ ...pay, method: event.target.value })} className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                {PAYMENT_METHODS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </select>
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Reference
              <Input value={pay.reference} onChange={(event) => setPay({ ...pay, reference: event.target.value })} className="mt-0.5 h-8 text-xs" placeholder="Transfer or receipt no." />
            </label>
            <label className="col-span-2 block text-[10px] text-muted-foreground">
              Note
              <Input value={pay.note} onChange={(event) => setPay({ ...pay, note: event.target.value })} className="mt-0.5 h-8 text-xs" placeholder="Optional" />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Close</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); handleRefund() }}>{working ? 'Saving...' : 'Record refund'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
