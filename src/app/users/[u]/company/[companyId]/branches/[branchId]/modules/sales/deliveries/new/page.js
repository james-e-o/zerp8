'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OrderStatusPill, formatDate } from '@/components/modules/sales/quotation-shared'

// New delivery. Reached from an order (?order=<id>) or without one, in which case the
// open orders are offered. Each line starts at what is still undelivered and is not
// already on another delivery in progress; it can be lowered, never raised.
export default function DeliveryFormPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { u, companyId, branchId } = useParams()
  const orderParam = searchParams.get('order')
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`

  const [orderId, setOrderId] = useState(orderParam || '')
  const [orders, setOrders] = useState([])
  const [order, setOrder] = useState(null)
  const [rows, setRows] = useState([])
  const [plannedDate, setPlannedDate] = useState('')
  const [shipTo, setShipTo] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const fail = (message, error) => {
    if (error) console.error(message, error)
    setErrorMessage(message)
    toast.error(message)
  }

  useEffect(() => {
    if (orderParam || !branchId) return
    let cancelled = false
    async function loadOrders() {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, customer:customers!sales_orders_customer_fkey ( name )')
        .eq('branch', branchId)
        .in('status', ['open', 'partially_fulfilled'])
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) fail(error.message || 'Could not load orders.', error)
      else setOrders(data || [])
      setLoading(false)
    }
    loadOrders()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderParam, branchId])

  useEffect(() => {
    if (!orderId || !branchId) {
      setOrder(null)
      setRows([])
      return
    }
    let cancelled = false
    async function loadOrder() {
      setLoading(true)
      const { data, error } = await supabase
        .from('sales_orders')
        .select(
          `id, order_number, status, requested_delivery_date,
           customer:customers!sales_orders_customer_fkey ( name, address ),
           sales_order_line_items ( id, description_snapshot, variant_label_snapshot, sku_snapshot, quantity_ordered, quantity_delivered, position )`
        )
        .eq('id', orderId)
        .eq('branch', branchId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        fail(error?.message || 'Order not found.', error)
        setLoading(false)
        return
      }

      const lineIds = (data.sales_order_line_items || []).map((line) => line.id)
      const { data: planned, error: plannedError } = lineIds.length
        ? await supabase
            .from('delivery_lines')
            .select('sales_order_line, quantity, delivery:deliveries!inner ( status )')
            .in('sales_order_line', lineIds)
            .in('delivery.status', ['pending', 'picking', 'ready'])
        : { data: [], error: null }
      if (plannedError) console.error('Could not read planned deliveries:', plannedError)
      const plannedMap = {}
      ;(planned || []).forEach((row) => {
        plannedMap[row.sales_order_line] = (plannedMap[row.sales_order_line] || 0) + Number(row.quantity || 0)
      })

      setOrder(data)
      setShipTo(data.customer?.address || '')
      setPlannedDate(data.requested_delivery_date || '')
      setRows(
        [...(data.sales_order_line_items || [])]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((line) => {
            const remaining = Math.max(0, Number(line.quantity_ordered) - Number(line.quantity_delivered) - (plannedMap[line.id] || 0))
            return { ...line, remaining, qty: remaining }
          })
      )
      setLoading(false)
    }
    loadOrder()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, branchId])

  const setQty = (id, value) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, qty: Math.min(row.remaining, Math.max(0, Number(value) || 0)) } : row))
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    const lines = rows.filter((row) => row.qty > 0).map((row) => ({ order_line: row.id, quantity: row.qty }))
    if (!order) {
      toast.error('Choose the order first.')
      return
    }
    if (lines.length === 0) {
      toast.error('Enter a quantity above zero on at least one item.')
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('create_delivery', {
      p_order: order.id,
      p_header: { planned_date: plannedDate || null, ship_to: shipTo, notes },
      p_lines: lines,
    })
    setSaving(false)
    if (error || !data?.success) {
      fail(error?.message || data?.error || 'Could not create the delivery.', error || data)
      return
    }
    toast.success(`Delivery ${data.delivery_number} created. Inventory can now pick it.`)
    router.push(`${salesBase}/deliveries/${data.delivery_id}`)
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-3 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900">New Delivery</h1>
          <p className="text-xs text-gray-500">{order ? `For order ${order.order_number}` : 'Choose an open order'}</p>
        </div>
        <Button type="submit" form="delivery-form" className="h-6 bg-core text-xs text-white" disabled={saving || !order}>
          {saving ? 'Creating...' : 'Create delivery'}
        </Button>
      </div>

      {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}

      {!orderParam && (
        <label className="block max-w-sm font-medium text-gray-800">
          Order
          <Select value={orderId} onValueChange={setOrderId}>
            <SelectTrigger className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm">
              <SelectValue placeholder={orders.length ? 'Select an order' : 'No open orders'} />
            </SelectTrigger>
            <SelectContent>
              {orders.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.order_number}{entry.customer?.name ? ` · ${entry.customer.name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}

      {loading && orderId ? (
        <p className="text-muted-foreground">Loading order...</p>
      ) : order ? (
        <form id="delivery-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-sm border border-border bg-card p-3">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Order</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                <Link href={`${salesBase}/orders/${order.id}`} className="hover:text-core">{order.order_number}</Link>{' '}
                <OrderStatusPill status={order.status} />
              </p>
              <p className="text-muted-foreground">{order.customer?.name}</p>
              <p className="text-muted-foreground">Requested: {formatDate(order.requested_delivery_date)}</p>
            </div>
            <label className="font-medium text-gray-800">
              Planned date
              <Input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <label className="font-medium text-gray-800">
              Deliver to
              <Textarea value={shipTo} onChange={(event) => setShipTo(event.target.value)} rows={2} placeholder="Delivery address" className="mt-1 min-h-12 text-xs" />
            </label>
          </div>

          <div className="overflow-hidden rounded-sm border border-border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Item</th>
                  <th className="px-4 py-2 text-right font-medium">Ordered</th>
                  <th className="px-4 py-2 text-right font-medium">Delivered</th>
                  <th className="px-4 py-2 text-right font-medium">Left to deliver</th>
                  <th className="w-32 px-4 py-2 text-right font-medium">This delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2">
                      <p className="font-medium text-foreground">{row.description_snapshot}</p>
                      {(row.variant_label_snapshot || row.sku_snapshot) && (
                        <p className="text-[10px] text-muted-foreground">{[row.variant_label_snapshot, row.sku_snapshot].filter(Boolean).join(' · ')}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{Number(row.quantity_ordered)}</td>
                    <td className="px-4 py-2 text-right">{Number(row.quantity_delivered)}</td>
                    <td className="px-4 py-2 text-right">{row.remaining}</td>
                    <td className="px-4 py-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        max={row.remaining}
                        value={row.qty}
                        disabled={row.remaining === 0}
                        onChange={(event) => setQty(row.id, event.target.value)}
                        className="ml-auto h-7 w-24 text-right text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Quantities already on another delivery in progress are not offered again. Stock leaves only when Inventory confirms the hand-over.
          </p>
          <label className="block max-w-xl font-medium text-gray-800">
            Notes
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1 min-h-12 text-xs" placeholder="Notes for the warehouse..." />
          </label>
        </form>
      ) : null}
    </div>
  )
}
