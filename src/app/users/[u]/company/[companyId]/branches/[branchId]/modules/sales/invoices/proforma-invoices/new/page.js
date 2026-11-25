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
import ProformaLineItemsTable, { proformaLineNet } from '@/components/modules/sales/proforma-line-items-table'
import { toDateInput, useMoney, useSalesSettings } from '@/components/modules/sales/quotation-shared'

// Used by proforma-invoices/new/page.js and proforma-invoices/[proformaId]/edit/page.js (two pages, so it stays a component).
//
// A pro forma is made FROM a sales order: /proforma-invoices/new?order=<id> (the order page has a button),
// or pick an open order here. The customer, the products and the prices all come from the order and cannot
// be changed here. A pro forma only says how many units of each line to quote now, and adds a discount
// (per line and/or on the whole pro forma, as an amount or a percentage). VAT follows the order.
// To change a product or a price, change the sales order (cancel the pro forma first if it uses that line).
const NONE = '__none__'

export default function ProformaForm({ proformaId = null }) {
  const router = useRouter()
  const search = useSearchParams()
  const { u, companyId, branchId } = useParams()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const base = `${salesBase}/invoices/proforma-invoices`
  const money = useMoney()
  const { settings, loaded: settingsLoaded } = useSalesSettings(branchId)
  const presetOrder = search.get('order') || ''

  const [orders, setOrders] = useState([])
  const [orderId, setOrderId] = useState(presetOrder)
  const [order, setOrder] = useState(null)
  const [rows, setRows] = useState([])
  const [number, setNumber] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [discountType, setDiscountType] = useState('amount')
  const [discountValue, setDiscountValue] = useState('0')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(null) // what an edited pro forma already holds
  const [loading, setLoading] = useState(Boolean(proformaId))
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const editing = Boolean(proformaId)

  const fail = (message, error) => {
    if (error) console.error(message, error)
    setErrorMessage(message)
    toast.error(message)
  }

  // Orders a pro forma can be made for.
  useEffect(() => {
    if (editing || presetOrder || !branchId) return
    supabase
      .from('sales_orders')
      .select('id, order_number, customer:customers!sales_orders_customer_fkey ( name )')
      .eq('branch', branchId)
      .in('status', ['open', 'partially_fulfilled'])
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return fail(error.message || 'Could not load orders.', error)
        setOrders(data || [])
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, editing, presetOrder])

  // A new pro forma is valid for the branch's default number of days (if set).
  useEffect(() => {
    if (editing || !settingsLoaded || validUntil) return
    const days = Number(settings.quotation_valid_days)
    if (days > 0) {
      const date = new Date()
      date.setDate(date.getDate() + days)
      setValidUntil(toDateInput(date))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, settings.quotation_valid_days, editing])

  // Editing: load the pro forma.
  useEffect(() => {
    if (!proformaId) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select(`id, proforma_number, status, sales_order, valid_until, discount_type, discount_value, notes,
                 lines:proforma_invoice_line_items ( sales_order_line_item, quantity, discount_type, discount_value )`)
        .eq('id', proformaId)
        .eq('branch', branchId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        fail(error?.message || 'Could not load this pro forma.', error)
      } else if (!['draft', 'saved', 'sent'].includes(data.status)) {
        toast.error(`A ${data.status} pro forma is closed and cannot be edited.`)
        router.replace(`${base}/${proformaId}`)
        return
      } else if (!data.sales_order) {
        toast.error('This pro forma was not made from an order. Cancel it and make a new one from the order.')
        router.replace(`${base}/${proformaId}`)
        return
      } else {
        const map = {}
        ;(data.lines || []).forEach((row) => { map[row.sales_order_line_item] = row })
        setSaved(map)
        setNumber(data.proforma_number)
        setOrderId(data.sales_order)
        setValidUntil(toDateInput(data.valid_until))
        setDiscountType(data.discount_type || 'amount')
        setDiscountValue(String(Number(data.discount_value || 0)))
        setNotes(data.notes || '')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proformaId, branchId])

  // The chosen order and its lines.
  useEffect(() => {
    if (!orderId || (editing && !saved)) {
      if (!orderId) {
        setOrder(null)
        setRows([])
      }
      return
    }
    let cancelled = false
    async function loadOrder() {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`id, order_number, status, apply_vat, vat_rate,
                 customer:customers!sales_orders_customer_fkey ( name ),
                 lines:sales_order_line_items ( id, description_snapshot, variant_label_snapshot, sku_snapshot, quantity_ordered,
                                                quantity_invoiced, quantity_cancelled, unit_price_snapshot, position )`)
        .eq('id', orderId)
        .eq('branch', branchId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) return fail(error?.message || 'Order not found.', error)
      setOrder(data)
      const sorted = [...(data.lines || [])].sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      setRows(
        sorted.map((line) => {
          const left = Math.max(Number(line.quantity_ordered) - Number(line.quantity_cancelled) - Number(line.quantity_invoiced), 0)
          const held = saved?.[line.id]
          return {
            id: line.id,
            description: line.description_snapshot || 'Item',
            detail: [line.variant_label_snapshot, line.sku_snapshot].filter(Boolean).join(' · '),
            ordered: Number(line.quantity_ordered),
            billed: Number(line.quantity_invoiced),
            left,
            price: Number(line.unit_price_snapshot || 0),
            // A new pro forma starts with everything that is left; an edited one with what it already holds.
            qty: String(editing ? Number(held?.quantity || 0) : left),
            discountType: held?.discount_type || 'amount',
            discountValue: String(Number(held?.discount_value || 0)),
          }
        })
      )
    }
    loadOrder()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, branchId, saved])

  const totals = useMemo(() => {
    const subtotal = rows.reduce((sum, row) => sum + proformaLineNet(row), 0)
    const value = Math.max(0, Number(discountValue || 0))
    const discount = discountType === 'percentage' ? Math.round(subtotal * Math.min(100, value)) / 100 : Math.min(subtotal, value)
    const taxable = Math.max(subtotal - discount, 0)
    const vat = order?.apply_vat ? Math.round(taxable * Number(order.vat_rate || 0)) / 100 : 0
    return { subtotal, discount, vat, total: taxable + vat }
  }, [rows, discountType, discountValue, order])

  const firstProblem = () => {
    if (!order) return 'Choose the order first.'
    const filled = rows.filter((row) => Number(row.qty || 0) > 0)
    if (filled.length === 0) return 'Enter a quantity on at least one line.'
    const over = filled.find((row) => Number(row.qty) > row.left)
    if (over) return `Only ${over.left} of ${over.description} is left to bill.`
    if (Number(discountValue || 0) < 0 || (discountType === 'percentage' && Number(discountValue || 0) > 100)) return 'Check the discount.'
    return ''
  }

  const save = async () => {
    setErrorMessage('')
    const problem = firstProblem()
    if (problem) return fail(problem)
    setSaving(true)
    const { data, error } = await supabase.rpc('save_proforma_from_order', {
      p_order: orderId,
      p_proforma: proformaId,
      p_header: { valid_until: validUntil || null, notes, discount_type: discountType, discount_value: Number(discountValue || 0) },
      p_lines: rows
        .filter((row) => Number(row.qty || 0) > 0)
        .map((row) => ({ order_line: row.id, quantity: Number(row.qty), discount_type: row.discountType || 'amount', discount_value: Number(row.discountValue || 0) })),
    })
    setSaving(false)
    if (error || !data?.success) return fail(error?.message || data?.error || 'Could not save the pro forma.', error || data)
    toast.success(editing ? `Pro forma ${data.proforma_number} updated.` : `Pro forma ${data.proforma_number} saved.`)
    ;(data.warnings || []).forEach((warning) => toast.warning(warning, { duration: 10000 }))
    router.push(`${base}/${data.proforma_id}`)
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading pro forma...</p>

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-3 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900">{editing ? 'Edit Pro forma' : 'New Pro forma'}</h1>
          <p className="text-xs text-gray-500">{number || 'Number is given when it is saved'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" className="h-6 text-xs" disabled={saving} onClick={() => router.back()}>Cancel</Button>
          <Button type="button" className="h-6 bg-core text-xs text-white" disabled={saving} onClick={save}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Save'}</Button>
        </div>
      </div>

      {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-700">{errorMessage}</p>}

      <form onSubmit={(event) => event.preventDefault()} className="flex min-h-0 grow flex-col justify-between gap-2 overflow-hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="text-xs font-medium text-gray-800">
            Sales order
            <div className="mt-1">
              {editing || presetOrder ? (
                <p className="py-2 text-sm text-foreground">
                  {order ? (
                    <>
                      <Link href={`${salesBase}/orders/${order.id}`} className="hover:text-core">{order.order_number}</Link> · {order.customer?.name || 'Customer'}
                    </>
                  ) : 'Loading...'}
                </p>
              ) : (
                <Select value={orderId || NONE} onValueChange={(value) => setOrderId(value === NONE ? '' : value)}>
                  <SelectTrigger className="h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm"><SelectValue placeholder="Choose an order" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Choose an order</SelectItem>
                    {orders.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.order_number} · {entry.customer?.name || 'Customer'}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <label className="text-xs font-medium text-gray-800">
            Valid until
            <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <p className="self-end rounded-sm bg-muted/50 p-2 text-[11px] text-muted-foreground">
            Products and prices come from the sales order and cannot be changed here. Saving locks the prices of these lines on the order until this pro forma is cancelled or converted.
          </p>
        </div>

        <div className="flex min-h-0 grow flex-col overflow-hidden">
          {order ? <ProformaLineItemsTable rows={rows} setRows={setRows} /> : <p className="text-xs text-gray-500">Choose an order to see its lines.</p>}
        </div>

        <div className="sales-document-summary flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-800">
              <span>Discount on the whole pro forma</span>
              <Select value={discountType} onValueChange={setDiscountType}>
                <SelectTrigger className="h-7 w-20 bg-white px-2 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="amount">Amount</SelectItem><SelectItem value="percentage">Percent</SelectItem></SelectContent>
              </Select>
              <Input type="number" min="0" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} className="h-7 w-20 bg-white px-2 text-[11px]" />
            </div>
            {order && (
              <p className="text-[11px] text-gray-600">
                {order.apply_vat ? `VAT ${Number(order.vat_rate).toFixed(1)}% applies (set on the order).` : 'No VAT (set on the order).'}
              </p>
            )}
            <label className="block text-[11px] font-medium text-gray-700">
              Notes
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes for this pro forma..." rows={2} className="mt-1 field-sizing-fixed min-h-12 resize-y bg-white px-2 py-1 text-[11px] leading-4" />
            </label>
          </div>
          <div className="w-full max-w-xs shrink-0 space-y-1 sm:ml-auto">
            <Row label="Subtotal (after line discounts)" value={money(totals.subtotal)} />
            <Row label="Discount on the whole pro forma" value={`-${money(totals.discount)}`} />
            {order?.apply_vat && <Row label={`VAT (${Number(order.vat_rate).toFixed(1)}%)`} value={`+${money(totals.vat)}`} />}
            <div className="my-1 border-t border-dashed border-gray-300" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Total</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">{money(totals.total)}</span>
            </div>
            <p className="text-[10px] text-gray-500">The final amounts are worked out again when you save.</p>
          </div>
        </div>
      </form>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-[11px] text-gray-500">
      <span>{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  )
}
