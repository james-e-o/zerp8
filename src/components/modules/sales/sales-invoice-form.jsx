'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, toDateInput, useMoney, useSalesSettings } from '@/components/modules/sales/quotation-shared'

// Used by sales-invoices/new/page.js and sales-invoices/[invoiceId]/edit/page.js (two pages, so it stays a component).
// New invoice / edit a draft. An invoice is always raised on a sales order, in whole or in parts:
// pick the lines and how many units to invoice now. The most a line can take is what is left
// (ordered - cancelled - already invoiced), delivered or not. Amounts follow the order (line net,
// the order's discount, VAT at the order's rate); the database works them out again on save.
//
// Save draft keeps it editable. Issue invoice posts it: it counts against the order and can then
// only be reversed by a credit note.
const NONE = '__none__'
const INVOICEABLE = ['open', 'partially_fulfilled', 'fulfilled', 'cancelled_partial']

export default function SalesInvoiceForm({ invoiceId = null }) {
  const router = useRouter()
  const search = useSearchParams()
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const { settings } = useSalesSettings(branchId)
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const presetOrder = search.get('order') || ''

  const [orders, setOrders] = useState([])
  const [orderId, setOrderId] = useState(presetOrder)
  const [order, setOrder] = useState(null)
  const [lines, setLines] = useState([]) // { id, description, ordered, delivered, invoiced, cancelled, left, net, qty }
  const [dueDate, setDueDate] = useState('')
  const [terms, setTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(Boolean(invoiceId))
  const [saving, setSaving] = useState(false)

  // Orders that can still be invoiced.
  useEffect(() => {
    if (invoiceId || !branchId) return
    supabase
      .from('sales_orders')
      .select('id, order_number, status, customer:customers!sales_orders_customer_fkey ( name )')
      .eq('branch', branchId)
      .in('status', INVOICEABLE)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load orders:', error)
          toast.error(error.message || 'Could not load orders.')
          return
        }
        setOrders(data || [])
      })
  }, [branchId, invoiceId])

  useEffect(() => {
    if (!terms && settings?.default_payment_terms && !invoiceId) setTerms(settings.default_payment_terms)
  }, [settings, invoiceId, terms])

  // Editing a draft: find its order and its saved quantities.
  const [savedQty, setSavedQty] = useState({})
  useEffect(() => {
    if (!invoiceId) return
    let cancelled = false
    async function loadDraft() {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('id, sales_order, status, due_date, payment_terms, notes, invoice_number, lines:sales_invoice_line_items ( sales_order_line_item, quantity )')
        .eq('id', invoiceId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        console.error('Failed to load invoice:', error)
        toast.error(error?.message || 'Invoice not found.')
        setLoading(false)
        return
      }
      if (data.status !== 'draft') {
        toast.error('Only a draft invoice can be edited.')
        router.replace(`${salesBase}/invoices/sales-invoices/${invoiceId}`)
        return
      }
      const map = {}
      ;(data.lines || []).forEach((row) => { map[row.sales_order_line_item] = Number(row.quantity) })
      setSavedQty(map)
      setOrderId(data.sales_order)
      setDueDate(toDateInput(data.due_date))
      setTerms(data.payment_terms || '')
      setNotes(data.notes || '')
      setLoading(false)
    }
    loadDraft()
    return () => { cancelled = true }
  }, [invoiceId, router, salesBase])

  // The chosen order and its lines.
  useEffect(() => {
    if (!orderId) {
      setOrder(null)
      setLines([])
      return
    }
    let cancelled = false
    async function loadOrder() {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(
          `id, order_number, status, discount_type, discount_value, apply_vat, vat_rate,
           customer:customers!sales_orders_customer_fkey ( name ),
           lines:sales_order_line_items ( id, description_snapshot, variant_label_snapshot, quantity_ordered, quantity_delivered,
                                          quantity_invoiced, quantity_cancelled, line_total, position )`
        )
        .eq('id', orderId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        console.error('Failed to load order:', error)
        toast.error(error?.message || 'Order not found.')
        return
      }
      setOrder(data)
      const sorted = [...(data.lines || [])].sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      setLines(
        sorted.map((line) => {
          const ordered = Number(line.quantity_ordered)
          const left = Math.max(ordered - Number(line.quantity_cancelled) - Number(line.quantity_invoiced), 0)
          return {
            id: line.id,
            description: [line.description_snapshot, line.variant_label_snapshot].filter(Boolean).join(' - ') || 'Item',
            ordered,
            delivered: Number(line.quantity_delivered),
            invoiced: Number(line.quantity_invoiced),
            cancelled: Number(line.quantity_cancelled),
            left,
            net: Number(line.line_total || 0),
            // A draft being edited starts from what it held; a new invoice starts with everything left.
            qty: String(invoiceId ? (savedQty[line.id] ?? 0) : left),
          }
        })
      )
    }
    loadOrder()
    return () => { cancelled = true }
  }, [orderId, invoiceId, savedQty])

  const setQty = (id, value) => setLines((previous) => previous.map((line) => (line.id === id ? { ...line, qty: value } : line)))
  const fillAll = () => setLines((previous) => previous.map((line) => ({ ...line, qty: String(line.left) })))
  const fillDelivered = () =>
    setLines((previous) => previous.map((line) => ({ ...line, qty: String(Math.max(Math.min(line.delivered - line.invoiced, line.left), 0)) })))
  const clearAll = () => setLines((previous) => previous.map((line) => ({ ...line, qty: '0' })))

  // The same arithmetic as the database, for the live summary.
  const totals = useMemo(() => {
    if (!order) return { subtotal: 0, discount: 0, vat: 0, total: 0 }
    const orderNet = lines.reduce((sum, line) => sum + line.net, 0)
    const subtotal = lines.reduce((sum, line) => sum + (line.ordered > 0 ? Math.round((line.net / line.ordered) * Number(line.qty || 0) * 100) / 100 : 0), 0)
    let discount = 0
    if (orderNet > 0) {
      const full =
        order.discount_type === 'percentage'
          ? (orderNet * Math.min(100, Math.max(0, Number(order.discount_value || 0)))) / 100
          : Math.min(orderNet, Math.max(0, Number(order.discount_value || 0)))
      discount = Math.round(((full * subtotal) / orderNet) * 100) / 100
    }
    const vat = order.apply_vat ? Math.round(Math.max(subtotal - discount, 0) * Number(order.vat_rate || 0)) / 100 : 0
    return { subtotal, discount, vat, total: Math.max(subtotal - discount, 0) + vat }
  }, [order, lines])

  function firstProblem() {
    if (!order) return 'Choose the order to invoice.'
    const filled = lines.filter((line) => Number(line.qty || 0) > 0)
    if (filled.length === 0) return 'Enter a quantity on at least one line.'
    const over = filled.find((line) => Number(line.qty) > line.left)
    if (over) return `Only ${over.left} of ${over.description} is left to invoice.`
    return ''
  }

  async function save(issue) {
    const problem = firstProblem()
    if (problem) {
      toast.error(problem)
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('save_sales_invoice', {
      p_order: orderId,
      p_invoice: invoiceId,
      p_lines: lines.filter((line) => Number(line.qty || 0) > 0).map((line) => ({ order_line: line.id, quantity: Number(line.qty) })),
      p_due_date: dueDate || null,
      p_notes: notes || null,
      p_terms: terms || null,
      p_issue: issue,
    })
    setSaving(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not save the invoice.'
      console.error('save_sales_invoice failed:', error || data)
      toast.error(message)
      return
    }
    toast.success(issue ? `${data.invoice_number} issued.` : `Draft ${data.invoice_number} saved.`)
    router.push(`${salesBase}/invoices/sales-invoices/${data.invoice_id}`)
  }

  if (loading) return <p className="px-1 py-3 text-xs text-muted-foreground">Opening draft...</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="grid grid-cols-1 gap-3 rounded-sm border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-[10px] text-muted-foreground lg:col-span-2">
          Sales order
          <div className="mt-0.5">
            {invoiceId || presetOrder ? (
              <p className="h-8 py-2 text-xs text-foreground">
                {order ? `${order.order_number} · ${order.customer?.name || 'Customer'}` : 'Loading...'}
              </p>
            ) : (
              <Select value={orderId || NONE} onValueChange={(value) => setOrderId(value === NONE ? '' : value)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose an order" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} className="text-xs">Choose an order</SelectItem>
                  {orders.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id} className="text-xs">{entry.order_number} · {entry.customer?.name || 'Customer'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </label>
        <label className="block text-[10px] text-muted-foreground">
          Due date
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-0.5 h-8 text-xs" />
        </label>
        <label className="block text-[10px] text-muted-foreground">
          Payment terms
          <Input value={terms} onChange={(event) => setTerms(event.target.value)} className="mt-0.5 h-8 text-xs" />
        </label>
        <label className="block text-[10px] text-muted-foreground sm:col-span-2 lg:col-span-4">
          Note
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-0.5 min-h-14 text-xs" placeholder="Optional. Shown on the invoice." />
        </label>
      </div>

      {order && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground">
              Choose how many units to invoice now. <Link href={`${salesBase}/orders/${order.id}`} className="font-medium text-foreground hover:text-core">{order.order_number}</Link>
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={fillAll}>Everything left</Button>
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={fillDelivered}>Delivered, not yet invoiced</Button>
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={clearAll}>Clear</Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-sm border border-border bg-card">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-muted text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Ordered</th>
                  <th className="px-3 py-2 text-right font-medium">Delivered</th>
                  <th className="px-3 py-2 text-right font-medium">Invoiced</th>
                  <th className="px-3 py-2 text-right font-medium">Left to invoice</th>
                  <th className="px-3 py-2 text-right font-medium">Invoice now</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2">{line.description}</td>
                    <td className="px-3 py-2 text-right">{line.ordered}</td>
                    <td className="px-3 py-2 text-right">{line.delivered}</td>
                    <td className="px-3 py-2 text-right">{line.invoiced || '—'}</td>
                    <td className="px-3 py-2 text-right">{line.left}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        max={line.left}
                        disabled={line.left === 0}
                        value={line.qty}
                        onChange={(event) => setQty(line.id, event.target.value)}
                        className="ml-auto h-7 w-20 text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {money(line.ordered > 0 ? Math.round((line.net / line.ordered) * Number(line.qty || 0) * 100) / 100 : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1 rounded-sm border border-border p-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{totals.discount ? `-${money(totals.discount)}` : money(0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{money(totals.vat)}</span></div>
            <div className="flex justify-between border-t border-border pt-1 text-sm font-semibold"><span>Total</span><span>{money(totals.total)}</span></div>
            <p className="pt-1 text-[10px] text-muted-foreground">The final amounts are worked out again when you save.</p>
          </div>
        </>
      )}

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t border-border bg-background px-1 py-2">
        <Button type="button" variant="outline" className="h-8 text-xs" disabled={saving} onClick={() => router.back()}>Cancel</Button>
        <Button type="button" variant="outline" className="h-8 text-xs" disabled={saving} onClick={() => save(false)}>Save draft</Button>
        <Button type="button" className="h-8 bg-core text-xs text-white" disabled={saving} onClick={() => save(true)}>
          {saving ? 'Saving...' : 'Issue invoice'}
        </Button>
      </div>
    </div>
  )
}
