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
import SalesInvoiceLineItemsTable, { invoiceLineNet } from '@/components/modules/sales/sales-invoice-line-items-table'
import { toDateInput, useMoney, useSalesSettings } from '@/components/modules/sales/quotation-shared'

// Used by sales-invoices/new/page.js and sales-invoices/[invoiceId]/edit/page.js (two pages, so it stays a component).
// An invoice is always raised on a sales order. The customer, the products and the prices come from the order
// and cannot be changed here. The invoice chooses how many units to bill now (at most what is left, delivered
// or not) and may give a discount per line and/or on the whole invoice (amount or percentage). VAT follows the order
// and is worked out after the discounts.
//
// An invoice made by converting a pro forma opens as a draft with that pro forma's discounts filled in. Change
// them here if you wish: the discounts on the invoice are the final ones (they do not add to the pro forma's).
// Saving (even as a draft) locks the prices of these lines on the order until the invoice is cancelled.
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
  const [rows, setRows] = useState([])
  const [dueDate, setDueDate] = useState('')
  const [terms, setTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [discountType, setDiscountType] = useState('amount')
  const [discountValue, setDiscountValue] = useState('0')
  const [saved, setSaved] = useState(null) // a draft's own lines (quantity and discount), by order line
  const [loading, setLoading] = useState(Boolean(invoiceId))
  const [saving, setSaving] = useState(false)
  const editing = Boolean(invoiceId)

  // Orders that can still be invoiced.
  useEffect(() => {
    if (editing || presetOrder || !branchId) return
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
  }, [branchId, editing, presetOrder])

  useEffect(() => {
    if (!terms && settings?.default_payment_terms && !editing) setTerms(settings.default_payment_terms)
  }, [settings, editing, terms])

  // Editing a draft: its order, its discounts and its saved quantities.
  useEffect(() => {
    if (!invoiceId) return
    let cancelled = false
    async function loadDraft() {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select(`id, sales_order, status, due_date, payment_terms, notes, invoice_number, discount_type, discount_value,
                 lines:sales_invoice_line_items ( sales_order_line_item, quantity, discount_type, discount_value )`)
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
      ;(data.lines || []).forEach((row) => { map[row.sales_order_line_item] = row })
      setSaved(map)
      setOrderId(data.sales_order)
      setDueDate(toDateInput(data.due_date))
      setTerms(data.payment_terms || '')
      setNotes(data.notes || '')
      setDiscountType(data.discount_type || 'amount')
      setDiscountValue(String(Number(data.discount_value || 0)))
      setLoading(false)
    }
    loadDraft()
    return () => { cancelled = true }
  }, [invoiceId, router, salesBase])

  // The chosen order and its lines.
  useEffect(() => {
    if (!orderId) {
      setOrder(null)
      setRows([])
      return
    }
    if (editing && !saved) return
    let cancelled = false
    async function loadOrder() {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`id, order_number, status, apply_vat, vat_rate,
                 customer:customers!sales_orders_customer_fkey ( name ),
                 lines:sales_order_line_items ( id, description_snapshot, variant_label_snapshot, sku_snapshot, quantity_ordered, quantity_delivered,
                                                quantity_invoiced, quantity_cancelled, line_total, position )`)
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
      setRows(
        sorted.map((line) => {
          const ordered = Number(line.quantity_ordered)
          const delivered = Number(line.quantity_delivered)
          const left = Math.max(Math.max(ordered - Number(line.quantity_cancelled), delivered) - Number(line.quantity_invoiced), 0)
          const held = saved?.[line.id]
          return {
            id: line.id,
            description: line.description_snapshot || 'Item',
            detail: [line.variant_label_snapshot, line.sku_snapshot].filter(Boolean).join(' · '),
            ordered,
            delivered,
            invoiced: Number(line.quantity_invoiced),
            left,
            unit: ordered > 0 ? Number(line.line_total || 0) / ordered : 0,
            // A draft being edited starts from what it held; a new invoice starts with everything left.
            qty: String(editing ? Number(held?.quantity || 0) : left),
            discountType: held?.discount_type || 'amount',
            discountValue: String(Number(held?.discount_value || 0)),
          }
        })
      )
    }
    loadOrder()
    return () => { cancelled = true }
  }, [orderId, editing, saved])

  const fillAll = () => setRows((previous) => previous.map((row) => ({ ...row, qty: String(row.left) })))
  const fillDelivered = () => setRows((previous) => previous.map((row) => ({ ...row, qty: String(Math.max(Math.min(row.delivered - row.invoiced, row.left), 0)) })))
  const clearAll = () => setRows((previous) => previous.map((row) => ({ ...row, qty: '0' })))

  // The same arithmetic as the database, for the live summary.
  const totals = useMemo(() => {
    const subtotal = rows.reduce((sum, row) => sum + invoiceLineNet(row), 0)
    const value = Math.max(0, Number(discountValue || 0))
    const discount = discountType === 'percentage' ? Math.round(subtotal * Math.min(100, value)) / 100 : Math.min(subtotal, value)
    const taxable = Math.max(subtotal - discount, 0)
    const vat = order?.apply_vat ? Math.round(taxable * Number(order.vat_rate || 0)) / 100 : 0
    return { subtotal, discount, vat, total: taxable + vat }
  }, [rows, discountType, discountValue, order])

  function firstProblem() {
    if (!order) return 'Choose the order to invoice.'
    const filled = rows.filter((row) => Number(row.qty || 0) > 0)
    if (filled.length === 0) return 'Enter a quantity on at least one line.'
    const over = filled.find((row) => Number(row.qty) > row.left)
    if (over) return `Only ${over.left} of ${over.description} is left to invoice.`
    if (Number(discountValue || 0) < 0 || (discountType === 'percentage' && Number(discountValue || 0) > 100)) return 'Check the discount.'
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
      p_lines: rows
        .filter((row) => Number(row.qty || 0) > 0)
        .map((row) => ({ order_line: row.id, quantity: Number(row.qty), discount_type: row.discountType || 'amount', discount_value: Number(row.discountValue || 0) })),
      p_due_date: dueDate || null,
      p_notes: notes || null,
      p_terms: terms || null,
      p_issue: issue,
      p_discount_type: discountType,
      p_discount_value: Number(discountValue || 0),
    })
    setSaving(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not save the invoice.'
      console.error('save_sales_invoice failed:', error || data)
      toast.error(message)
      return
    }
    toast.success(issue ? `${data.invoice_number} issued.` : `Draft ${data.invoice_number} saved.`)
    ;(data.warnings || []).forEach((warning) => toast.warning(warning, { duration: 10000 }))
    router.push(`${salesBase}/invoices/sales-invoices/${data.invoice_id}`)
  }

  if (loading) return <p className="px-1 py-3 text-xs text-muted-foreground">Opening draft...</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="grid grid-cols-1 gap-3 rounded-sm border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="block text-[10px] text-muted-foreground lg:col-span-2">
          Sales order
          <div className="mt-0.5">
            {editing || presetOrder ? (
              <p className="h-8 py-2 text-xs text-foreground">{order ? `${order.order_number} · ${order.customer?.name || 'Customer'}` : 'Loading...'}</p>
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
        </div>
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
              Choose how many units to invoice now. Products and prices come from{' '}
              <Link href={`${salesBase}/orders/${order.id}`} className="font-medium text-foreground hover:text-core">{order.order_number}</Link>. Saving this invoice locks those prices on the order until it is cancelled.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={fillAll}>Everything left</Button>
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={fillDelivered}>Delivered, not yet invoiced</Button>
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={clearAll}>Clear</Button>
            </div>
          </div>

          <SalesInvoiceLineItemsTable rows={rows} setRows={setRows} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 font-semibold text-gray-800">
                <span>Discount on the whole invoice</span>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger className="h-7 w-20 bg-white px-2 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="amount">Amount</SelectItem><SelectItem value="percentage">Percent</SelectItem></SelectContent>
                </Select>
                <Input type="number" min="0" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} className="h-7 w-20 bg-white px-2 text-[11px]" />
              </div>
              <p className="text-muted-foreground">
                {order.apply_vat ? `VAT ${Number(order.vat_rate).toFixed(1)}% applies (set on the order), worked out after the discounts.` : 'No VAT (set on the order).'}
              </p>
            </div>
            <div className="w-full max-w-xs space-y-1 rounded-sm border border-border p-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (after line discounts)</span><span>{money(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discount on the whole invoice</span><span>{totals.discount ? `-${money(totals.discount)}` : money(0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{money(totals.vat)}</span></div>
              <div className="flex justify-between border-t border-border pt-1 text-sm font-semibold"><span>Total</span><span>{money(totals.total)}</span></div>
              <p className="pt-1 text-[10px] text-muted-foreground">The final amounts are worked out again when you save.</p>
            </div>
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
