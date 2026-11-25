'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate, toDateInput, useMoney } from '@/components/modules/sales/quotation-shared'
import { PAYMENT_METHODS, methodLabel } from '@/components/modules/sales/invoice-shared'

// Customer > Payments. The whole page lives here (nothing else uses it).
// Receive a payment: it is put on the customer's unpaid invoices, oldest due date first (or the split you choose),
// and anything left over becomes an advance. An advance can be used on an invoice (button on the invoice)
// or refunded here.
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export default function Page() {
  const { u, companyId, branchId, customerId } = useParams()
  const money = useMoney()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`

  const [customer, setCustomer] = useState(null)
  const [position, setPosition] = useState({ owed: 0, overdue: 0, advance: 0 })
  const [invoices, setInvoices] = useState([])
  const [receipts, setReceipts] = useState([])
  const [advances, setAdvances] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  const [receiveOpen, setReceiveOpen] = useState(false)
  const [form, setForm] = useState({ amount: '', method: 'bank_transfer', reference: '', paidOn: '', note: '' })
  const [manual, setManual] = useState(false)
  const [split, setSplit] = useState({}) // invoice id -> amount (manual split)
  const [refundOf, setRefundOf] = useState(null)
  const [refundMethod, setRefundMethod] = useState('bank_transfer') // branch default (Sales settings > Returns)
  const [refund, setRefund] = useState({ amount: '', method: 'bank_transfer', reference: '', paidOn: '', note: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [customerRes, positionRes, invoiceRes, receiptRes, advanceRes] = await Promise.all([
      supabase.from('customers').select('id, name, customer_number').eq('id', customerId).maybeSingle(),
      supabase.rpc('customer_payment_position', { p_branch: branchId, p_customer: customerId }),
      supabase
        .from('sales_invoices')
        .select('id, invoice_number, due_date, issued_at, total, credited, paid, status')
        .eq('branch', branchId)
        .eq('customer', customerId)
        .in('status', ['unpaid', 'partially_paid'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('issued_at', { ascending: true }),
      supabase
        .from('customer_receipts')
        .select('id, receipt_number, amount, paid_at, method, reference, advance')
        .eq('branch', branchId)
        .eq('customer', customerId)
        .order('paid_at', { ascending: false })
        .limit(100),
      supabase
        .from('customer_advances')
        .select('id, advance_number, advance_date, amount, applied_amount, refunded_amount, remaining_amount, status')
        .eq('branch', branchId)
        .eq('customer', customerId)
        .order('advance_date', { ascending: false }),
    ])
    for (const [label, res] of [['customer', customerRes], ['position', positionRes], ['invoices', invoiceRes], ['payments', receiptRes], ['advances', advanceRes]]) {
      if (res.error) {
        console.error(`Failed to load ${label}:`, res.error)
        toast.error(res.error.message || `Could not load ${label}.`)
      }
    }
    setCustomer(customerRes.data || null)
    setPosition(positionRes.data || { owed: 0, overdue: 0, advance: 0 })
    setInvoices(invoiceRes.data || [])
    setReceipts(receiptRes.data || [])
    setAdvances(advanceRes.data || [])
    setLoading(false)
  }, [branchId, customerId])

  useEffect(() => {
    if (branchId && customerId) load()
  }, [branchId, customerId, load])

  useEffect(() => {
    if (!branchId) return
    supabase.rpc('get_return_rules', { p_branch: branchId }).then(({ data, error }) => {
      if (error) console.error('Failed to load the refund method:', error)
      else if (data?.success && data.default_refund_method) setRefundMethod(data.default_refund_method)
    })
  }, [branchId])

  const dueOf = (invoice) => Math.max(r2(Number(invoice.total) - Number(invoice.credited || 0) - Number(invoice.paid || 0)), 0)

  // What the automatic split would do with the amount typed (the database does the real one).
  const autoSplit = useMemo(() => {
    let left = r2(form.amount)
    const rows = []
    for (const invoice of invoices) {
      if (left <= 0.005) break
      const take = Math.min(left, dueOf(invoice))
      if (take > 0) {
        rows.push({ invoice, take })
        left = r2(left - take)
      }
    }
    return { rows, advance: Math.max(left, 0) }
  }, [form.amount, invoices])

  const manualTotal = useMemo(() => r2(Object.values(split).reduce((sum, value) => sum + (Number(value) || 0), 0)), [split])

  function openReceive() {
    setForm({ amount: '', method: 'bank_transfer', reference: '', paidOn: toDateInput(new Date()), note: '' })
    setManual(false)
    setSplit({})
    setReceiveOpen(true)
  }

  async function handleReceive() {
    const amount = r2(form.amount)
    if (amount <= 0) {
      toast.error('Enter an amount above zero.')
      return
    }
    let allocations = null
    if (manual) {
      allocations = Object.entries(split)
        .filter(([, value]) => Number(value) > 0)
        .map(([invoice, value]) => ({ sales_invoice: invoice, amount: Number(value) }))
      if (manualTotal > amount + 0.005) {
        toast.error('The split adds up to more than the amount paid.')
        return
      }
      const tooMuch = invoices.find((invoice) => Number(split[invoice.id] || 0) > dueOf(invoice) + 0.005)
      if (tooMuch) {
        toast.error(`${tooMuch.invoice_number} can only take ${money(dueOf(tooMuch))}.`)
        return
      }
    }
    setWorking(true)
    const { data, error } = await supabase.rpc('receive_customer_payment', {
      p_branch: branchId,
      p_customer: customerId,
      p_amount: amount,
      p_method: form.method,
      p_reference: form.reference || null,
      p_paid_at: form.paidOn ? new Date(form.paidOn).toISOString() : null,
      p_note: form.note || null,
      p_allocations: allocations,
    })
    setWorking(false)
    if (error || !data?.success) {
      console.error('receive_customer_payment failed:', error || data)
      toast.error(error?.message || data?.error || 'Could not record the payment.')
      return
    }
    toast.success(
      Number(data.advance) > 0
        ? `${data.receipt_number} recorded. ${money(data.advance)} kept as an advance.`
        : `${data.receipt_number} recorded.`
    )
    setReceiveOpen(false)
    load()
  }

  function openRefund(advance) {
    setRefundOf(advance)
    setRefund({ amount: String(Number(advance.remaining_amount)), method: refundMethod, reference: '', paidOn: toDateInput(new Date()), note: '' })
  }

  async function handleRefund() {
    const amount = r2(refund.amount)
    if (amount <= 0) {
      toast.error('Enter an amount above zero.')
      return
    }
    if (amount > Number(refundOf.remaining_amount) + 0.005) {
      toast.error(`Only ${money(refundOf.remaining_amount)} of this advance is left.`)
      return
    }
    setWorking(true)
    const { data, error } = await supabase.rpc('refund_customer_advance', {
      p_advance: refundOf.id,
      p_amount: amount,
      p_method: refund.method,
      p_reference: refund.reference || null,
      p_refunded_at: refund.paidOn ? new Date(refund.paidOn).toISOString() : null,
      p_note: refund.note || null,
    })
    setWorking(false)
    if (error || !data?.success) {
      console.error('refund_customer_advance failed:', error || data)
      toast.error(error?.message || data?.error || 'Could not record the refund.')
      return
    }
    toast.success('Refund recorded.')
    setRefundOf(null)
    load()
  }

  if (loading && !customer) return <p className="px-1 py-3 text-xs text-muted-foreground">Loading payments...</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{customer?.name || 'Customer'} · Payments</h2>
          <Link href={`${salesBase}/customers/${customerId}`} className="text-muted-foreground hover:text-core">Back to customer</Link>
        </div>
        <Button type="button" className="h-8 bg-core text-xs text-white" onClick={openReceive}>Receive payment</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-sm border border-border p-3"><p className="text-[10px] text-muted-foreground">Owes you</p><p className="text-base font-semibold">{money(position.owed)}</p></div>
        <div className="rounded-sm border border-border p-3"><p className="text-[10px] text-muted-foreground">Overdue</p><p className="text-base font-semibold text-red-600">{money(position.overdue)}</p></div>
        <div className="rounded-sm border border-border p-3"><p className="text-[10px] text-muted-foreground">Advance held</p><p className="text-base font-semibold text-emerald-700">{money(position.advance)}</p></div>
      </div>

      <Section title="Unpaid invoices" empty="Nothing is owed." rows={invoices}>
        <thead className="bg-muted text-[10px] text-muted-foreground">
          <tr><Th>Invoice</Th><Th>Due</Th><Th right>Total</Th><Th right>Balance</Th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className="px-3 py-2"><Link href={`${salesBase}/invoices/sales-invoices/${invoice.id}`} className="font-medium hover:text-core">{invoice.invoice_number}</Link></td>
              <td className="px-3 py-2">{formatDate(invoice.due_date)}</td>
              <td className="px-3 py-2 text-right">{money(invoice.total)}</td>
              <td className="px-3 py-2 text-right font-medium">{money(dueOf(invoice))}</td>
            </tr>
          ))}
        </tbody>
      </Section>

      <Section title="Advances" empty="No advances." rows={advances}>
        <thead className="bg-muted text-[10px] text-muted-foreground">
          <tr><Th>Advance</Th><Th>Date</Th><Th right>Received</Th><Th right>Used</Th><Th right>Refunded</Th><Th right>Left</Th><Th right> </Th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {advances.map((advance) => (
            <tr key={advance.id}>
              <td className="px-3 py-2 font-medium">{advance.advance_number}</td>
              <td className="px-3 py-2">{formatDate(advance.advance_date)}</td>
              <td className="px-3 py-2 text-right">{money(advance.amount)}</td>
              <td className="px-3 py-2 text-right">{money(advance.applied_amount)}</td>
              <td className="px-3 py-2 text-right">{money(advance.refunded_amount)}</td>
              <td className="px-3 py-2 text-right font-medium">{money(advance.remaining_amount)}</td>
              <td className="px-3 py-2 text-right">
                {advance.status === 'open' ? (
                  <Button type="button" variant="outline" className="h-6 text-[10px]" disabled={working} onClick={() => openRefund(advance)}>Refund</Button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Closed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Section>

      <Section title="Payments received" empty="No payments yet." rows={receipts}>
        <thead className="bg-muted text-[10px] text-muted-foreground">
          <tr><Th>Receipt</Th><Th>Date</Th><Th>Method</Th><Th>Reference</Th><Th right>Amount</Th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {receipts.map((receipt) => (
            <tr key={receipt.id}>
              <td className="px-3 py-2 font-medium">{receipt.receipt_number}{receipt.advance ? <span className="ml-2 text-[10px] text-emerald-700">part kept as advance</span> : null}</td>
              <td className="px-3 py-2">{formatDate(receipt.paid_at)}</td>
              <td className="px-3 py-2">{methodLabel(receipt.method)}</td>
              <td className="px-3 py-2">{receipt.reference || '—'}</td>
              <td className="px-3 py-2 text-right">{money(receipt.amount)}</td>
            </tr>
          ))}
        </tbody>
      </Section>

      <Dialog open={receiveOpen} onOpenChange={(open) => { if (!open && !working) setReceiveOpen(false) }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive payment from {customer?.name}</DialogTitle>
            <DialogDescription>It goes to the oldest due invoices first. Anything above what is owed is kept as an advance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[10px] text-muted-foreground">Amount
                <Input type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="mt-0.5 h-8 text-xs" />
              </label>
              <label className="block text-[10px] text-muted-foreground">Date
                <Input type="date" value={form.paidOn} onChange={(event) => setForm({ ...form, paidOn: event.target.value })} className="mt-0.5 h-8 text-xs" />
              </label>
              <div className="block text-[10px] text-muted-foreground">Method
                <Select value={form.method} onValueChange={(value) => setForm({ ...form, method: value })}>
                  <SelectTrigger className="mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((entry) => <SelectItem key={entry.value} value={entry.value} className="text-xs">{entry.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <label className="block text-[10px] text-muted-foreground">Reference
                <Input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} className="mt-0.5 h-8 text-xs" />
              </label>
            </div>
            <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Note (optional)" className="min-h-14 text-xs" />

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={manual} onChange={(event) => setManual(event.target.checked)} />
              I will choose which invoices it pays
            </label>

            {!manual ? (
              <div className="rounded-sm border border-border p-2">
                {autoSplit.rows.length === 0 && r2(form.amount) > 0 && <p className="text-muted-foreground">No unpaid invoices. All of it becomes an advance.</p>}
                {autoSplit.rows.map(({ invoice, take }) => (
                  <div key={invoice.id} className="flex justify-between py-0.5"><span>{invoice.invoice_number}</span><span>{money(take)}</span></div>
                ))}
                {autoSplit.advance > 0 && autoSplit.rows.length > 0 && (
                  <div className="flex justify-between border-t border-border pt-1 font-medium text-emerald-700"><span>Kept as advance</span><span>{money(autoSplit.advance)}</span></div>
                )}
              </div>
            ) : (
              <div className="space-y-1 rounded-sm border border-border p-2">
                {invoices.length === 0 && <p className="text-muted-foreground">No unpaid invoices.</p>}
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between gap-2">
                    <span>{invoice.invoice_number} <span className="text-muted-foreground">(owes {money(dueOf(invoice))})</span></span>
                    <Input type="number" min="0" value={split[invoice.id] ?? ''} onChange={(event) => setSplit({ ...split, [invoice.id]: event.target.value })} className="h-7 w-24 text-right text-xs" />
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-1 font-medium">
                  <span>Kept as advance</span><span>{money(Math.max(r2(form.amount) - manualTotal, 0))}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={handleReceive}>{working ? 'Saving...' : 'Record payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(refundOf)} onOpenChange={(open) => { if (!open && !working) setRefundOf(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refund advance {refundOf?.advance_number}</DialogTitle>
            <DialogDescription>{refundOf ? `${money(refundOf.remaining_amount)} is left. Record the money you gave back.` : ''}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="block text-[10px] text-muted-foreground">Amount
              <Input type="number" min="0" value={refund.amount} onChange={(event) => setRefund({ ...refund, amount: event.target.value })} className="mt-0.5 h-8 text-xs" />
            </label>
            <label className="block text-[10px] text-muted-foreground">Date
              <Input type="date" value={refund.paidOn} onChange={(event) => setRefund({ ...refund, paidOn: event.target.value })} className="mt-0.5 h-8 text-xs" />
            </label>
            <div className="block text-[10px] text-muted-foreground">Method
              <Select value={refund.method} onValueChange={(value) => setRefund({ ...refund, method: value })}>
                <SelectTrigger className="mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((entry) => <SelectItem key={entry.value} value={entry.value} className="text-xs">{entry.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="block text-[10px] text-muted-foreground">Reference
              <Input value={refund.reference} onChange={(event) => setRefund({ ...refund, reference: event.target.value })} className="mt-0.5 h-8 text-xs" />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={() => setRefundOf(null)}>Cancel</Button>
            <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={handleRefund}>{working ? 'Saving...' : 'Record refund'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Th({ children, right }) {
  return <th className={`px-3 py-2 font-medium ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}

function Section({ title, empty, rows, children }) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-semibold text-slate-700">{title}</h3>
      {rows.length === 0 ? (
        <p className="rounded-sm border border-border p-3 text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full min-w-[520px] text-xs">{children}</table>
        </div>
      )}
    </div>
  )
}
