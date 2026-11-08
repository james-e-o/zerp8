'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/components/modules/sales/quotation-shared'

// New return. The whole form lives here (nothing else uses it).
// A return is raised against a DELIVERED delivery: only goods that went out can come back. Each
// line can take back at most what was delivered minus what is already on another live return.
// "Can be resold" is ticked when the goods are in good condition; it is what the warehouse sees
// when the goods come in. The stock and the order's returned quantities change only when the goods
// are received (Inventory > Receipts > New receipt > Sales return).
function NewReturn() {
  const router = useRouter()
  const search = useSearchParams()
  const { u, companyId, branchId } = useParams()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`

  const [deliveries, setDeliveries] = useState([])
  const [deliveryId, setDeliveryId] = useState(search.get('delivery') || '')
  const [lines, setLines] = useState([]) // { id, name, delivered, open, qty, resell }
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!branchId) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('deliveries')
        .select(
          `id, delivery_number, delivered_at,
           order:sales_orders!deliveries_sales_order_fkey ( order_number ),
           customer:customers!deliveries_customer_fkey ( name )`
        )
        .eq('branch', branchId)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false })
        .limit(200)
      if (cancelled) return
      if (error) {
        console.error('Failed to load deliveries:', error)
        toast.error(error.message || 'Could not load deliveries.')
      } else {
        setDeliveries(data || [])
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [branchId])

  useEffect(() => {
    if (!deliveryId) {
      setLines([])
      return
    }
    let cancelled = false
    async function loadLines() {
      const { data: rows, error } = await supabase
        .from('delivery_lines')
        .select('id, description_snapshot, variant_label_snapshot, quantity_delivered, position')
        .eq('delivery', deliveryId)
        .order('position')
      if (cancelled) return
      if (error) {
        console.error('Failed to load delivery lines:', error)
        toast.error(error.message || 'Could not load the delivery items.')
        return
      }
      const ids = (rows || []).map((row) => row.id)
      let taken = {}
      if (ids.length) {
        const { data: existing, error: existingError } = await supabase
          .from('sales_return_line_items')
          .select('delivery_line, quantity, sales_return:sales_returns!return_line_items_return_record_fkey ( status )')
          .in('delivery_line', ids)
        if (cancelled) return
        if (existingError) {
          console.error('Failed to load earlier returns:', existingError)
          toast.error(existingError.message || 'Could not check earlier returns.')
        }
        ;(existing || []).forEach((row) => {
          if (row.sales_return?.status === 'cancelled') return
          taken[row.delivery_line] = (taken[row.delivery_line] || 0) + Number(row.quantity)
        })
      }
      setLines(
        (rows || []).map((row) => {
          const delivered = Number(row.quantity_delivered)
          return {
            id: row.id,
            name: [row.description_snapshot, row.variant_label_snapshot].filter(Boolean).join(' - ') || 'Item',
            delivered,
            open: Math.max(delivered - (taken[row.id] || 0), 0),
            qty: '',
            resell: true,
          }
        })
      )
    }
    loadLines()
    return () => { cancelled = true }
  }, [deliveryId])

  const setLine = (id, patch) => setLines((previous) => previous.map((line) => (line.id === id ? { ...line, ...patch } : line)))

  async function save() {
    if (!deliveryId) {
      toast.error('Choose the delivery the goods came from.')
      return
    }
    const filled = lines.filter((line) => Number(line.qty || 0) > 0)
    if (filled.length === 0) {
      toast.error('Enter a quantity on at least one item.')
      return
    }
    const over = filled.find((line) => Number(line.qty) > line.open)
    if (over) {
      toast.error(`${over.name} can only take back ${over.open} more.`)
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('create_sales_return', {
      p_branch: branchId,
      p_delivery: deliveryId,
      p_lines: filled.map((line) => ({ delivery_line: line.id, quantity: Number(line.qty), restockable: line.resell })),
      p_reason: reason || null,
      p_note: note || null,
    })
    setSaving(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not raise the return.'
      console.error('create_sales_return failed:', error || data)
      toast.error(message)
      return
    }
    toast.success(`Return ${data.return_number} raised.`)
    router.push(`${salesBase}/returns/${data.return_id}`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="grid grid-cols-1 gap-3 rounded-sm border border-border p-3 sm:grid-cols-2">
        <label className="block text-[10px] text-muted-foreground">
          Delivery the goods came from
          <select
            value={deliveryId}
            onChange={(event) => setDeliveryId(event.target.value)}
            disabled={loading}
            className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            <option value="">{loading ? 'Loading...' : deliveries.length === 0 ? 'No delivered delivery' : 'Choose a delivery'}</option>
            {deliveries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.delivery_number} · {entry.order?.order_number || 'No order'} · {entry.customer?.name || 'Customer'} · {formatDate(entry.delivered_at)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] text-muted-foreground">
          Reason
          <Input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-0.5 h-8 text-xs" placeholder="Wrong item, faulty, changed mind..." />
        </label>
        <label className="block text-[10px] text-muted-foreground sm:col-span-2">
          Note
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-0.5 min-h-14 text-xs" placeholder="Optional" />
        </label>
      </div>

      {deliveryId && (
        <div className="overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full min-w-[620px] text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Delivered</th>
                <th className="px-3 py-2 text-right font-medium">Can still come back</th>
                <th className="px-3 py-2 text-right font-medium">Return now</th>
                <th className="px-3 py-2 text-center font-medium">Can be resold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">{line.name}</td>
                  <td className="px-3 py-2 text-right">{line.delivered}</td>
                  <td className="px-3 py-2 text-right">{line.open}</td>
                  <td className="px-3 py-2 text-right">
                    <Input type="number" min="0" max={line.open} disabled={line.open === 0} value={line.qty} onChange={(event) => setLine(line.id, { qty: event.target.value })} className="ml-auto h-7 w-20 text-right text-xs" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={line.resell} onChange={(event) => setLine(line.id, { resell: event.target.checked })} className="size-3.5 rounded border-gray-300 text-core" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t border-border bg-background px-1 py-2">
        <Button type="button" variant="outline" className="h-8 text-xs" disabled={saving} onClick={() => router.back()}>Cancel</Button>
        <Button type="button" className="h-8 bg-core text-xs text-white" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Raise return'}</Button>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-4 text-xs text-muted-foreground">Loading...</p>}>
      <NewReturn />
    </Suspense>
  )
}
