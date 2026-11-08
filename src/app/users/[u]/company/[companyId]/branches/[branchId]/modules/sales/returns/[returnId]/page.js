'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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
import { ReturnStatusPill } from '@/components/modules/sales/return-shared'

// Sales return detail. The whole page lives here (nothing else uses it).
// Requested -> Approve -> goods come back through Inventory > Receipts > New receipt > Sales return
// -> Issue credit note (when the customer was billed for goods they no longer keep) -> Refund on the invoice.
export default function Page() {
  const { u, companyId, branchId, returnId } = useParams()
  const money = useMoney()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const receiptsNew = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/receipts/new`

  const [ret, setRet] = useState(null)
  const [lines, setLines] = useState([])
  const [creditNotes, setCreditNotes] = useState([])
  const [creditUnits, setCreditUnits] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [working, setWorking] = useState(false)
  const [action, setAction] = useState(null) // 'cancel' | 'credit'
  const [cancelReason, setCancelReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('sales_returns')
      .select(
        `id, return_number, status, reason, note, created_at, approved_at, received_at, cancelled_at, cancel_reason, sales_order,
         customer:customers!sales_returns_customer_fkey ( id, name ),
         order:sales_orders!sales_returns_sales_order_fkey ( id, order_number ),
         delivery:deliveries!returns_delivery_fkey ( id, delivery_number )`
      )
      .eq('id', returnId)
      .eq('branch', branchId)
      .maybeSingle()
    if (error || !data) {
      const message = error?.message || 'Return not found.'
      console.error('Failed to load return:', error)
      setErrorMessage(message)
      toast.error(message)
      setLoading(false)
      return
    }
    setRet(data)
    const [{ data: lineRows, error: lineError }, { data: creditRows, error: creditError }] = await Promise.all([
      supabase.from('sales_return_line_items').select('id, description_snapshot, quantity, quantity_received, restockable').eq('sales_return', returnId),
      supabase.from('credit_notes').select('id, credit_note_number, total, created_at').eq('sales_return', returnId).order('created_at'),
    ])
    if (lineError || creditError) {
      console.error('Failed to load return details:', lineError || creditError)
      toast.error((lineError || creditError).message)
    }
    setLines(lineRows || [])
    setCreditNotes(creditRows || [])
    if (data.sales_order && ['partially_received', 'received'].includes(data.status)) {
      const { data: money_, error: moneyError } = await supabase.rpc('sales_order_money', { p_order: data.sales_order })
      if (moneyError || money_?.success === false) {
        console.error('Failed to read order money:', moneyError || money_)
        setCreditUnits(0)
      } else {
        setCreditUnits(Number(money_?.credit_units_due || 0))
      }
    } else {
      setCreditUnits(0)
    }
    setLoading(false)
  }, [returnId, branchId])

  useEffect(() => {
    if (returnId && branchId) load()
  }, [returnId, branchId, load])

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

  const handleApprove = async () => {
    const data = await run('approve_sales_return', { p_return: returnId }, 'Return approved. The goods can now be received.', 'Could not approve the return.')
    if (data) load()
  }

  const handleCancel = async () => {
    const data = await run('cancel_sales_return', { p_return: returnId, p_reason: cancelReason || null }, 'Return cancelled.', 'Could not cancel the return.')
    if (!data) return
    setAction(null)
    setCancelReason('')
    load()
  }

  const handleCredit = async () => {
    const data = await run('issue_credit_notes', { p_order: ret.sales_order, p_return: returnId, p_note: null }, 'Credit note issued.', 'Could not issue the credit note.')
    setAction(null)
    if (data) load()
  }

  if (loading && !ret) return <p className="px-1 py-3 text-xs text-muted-foreground">Loading return...</p>
  if (errorMessage && !ret) return <p role="alert" className="m-3 border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>
  if (!ret) return null

  const waitingForGoods = ['approved', 'partially_received'].includes(ret.status)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{ret.return_number}</h2>
          <ReturnStatusPill status={ret.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {['requested', 'approved'].includes(ret.status) && (
            <Button type="button" variant="outline" className="h-8 text-xs text-red-600" disabled={working} onClick={() => setAction('cancel')}>Cancel return</Button>
          )}
          {ret.status === 'requested' && (
            <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={handleApprove}>Approve</Button>
          )}
          {waitingForGoods && (
            <Button asChild className="h-8 bg-core text-xs text-white"><Link href={receiptsNew}>Receive the goods</Link></Button>
          )}
          {creditUnits > 0 && (
            <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={() => setAction('credit')}>Issue credit note</Button>
          )}
        </div>
      </div>

      {ret.status === 'requested' && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 p-2 text-amber-800">Waiting for approval. Nothing moves until it is approved and the goods are received.</p>
      )}
      {waitingForGoods && (
        <p className="rounded-sm border border-blue-200 bg-blue-50 p-2 text-blue-800">
          Approved. When the goods arrive, Inventory receives them in Receipts, New receipt, source Sales return. Stock and the order's returned quantities change then.
        </p>
      )}
      {creditUnits > 0 && (
        <p className="rounded-sm border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">
          The customer was invoiced for {creditUnits} unit(s) they no longer keep. Issue a credit note; if they have already paid, refund them from the invoice afterwards.
        </p>
      )}
      {ret.status === 'cancelled' && (
        <p className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">Cancelled on {formatDate(ret.cancelled_at)}{ret.cancel_reason ? `: ${ret.cancel_reason}` : '.'}</p>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-sm border border-border p-3 sm:grid-cols-4">
        <div><p className="text-[10px] text-muted-foreground">Customer</p><p className="font-medium">{ret.customer?.name || '—'}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Order</p><p className="font-medium">{ret.order ? <Link href={`${salesBase}/orders/${ret.order.id}`} className="hover:text-core">{ret.order.order_number}</Link> : '—'}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Delivery</p><p className="font-medium">{ret.delivery ? <Link href={`${salesBase}/deliveries/${ret.delivery.id}`} className="hover:text-core">{ret.delivery.delivery_number}</Link> : '—'}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Raised</p><p className="font-medium">{formatDate(ret.created_at)}</p></div>
        {ret.reason && <div className="col-span-2"><p className="text-[10px] text-muted-foreground">Reason</p><p>{ret.reason}</p></div>}
        {ret.note && <div className="col-span-2"><p className="text-[10px] text-muted-foreground">Note</p><p className="whitespace-pre-wrap">{ret.note}</p></div>}
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="bg-muted text-[10px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Returning</th>
              <th className="px-3 py-2 text-right font-medium">Received</th>
              <th className="px-3 py-2 text-center font-medium">Can be resold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">{line.description_snapshot}</td>
                <td className="px-3 py-2 text-right">{Number(line.quantity)}</td>
                <td className="px-3 py-2 text-right">{Number(line.quantity_received)}</td>
                <td className="px-3 py-2 text-center">{line.restockable ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
                  <td className="px-4 py-2 text-right font-medium">{money(note.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={action === 'cancel'} onOpenChange={(open) => { if (!open && !working) setAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {ret.return_number}?</AlertDialogTitle>
            <AlertDialogDescription>Nothing has come back yet, so this only closes the request.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Reason (optional)" className="min-h-16 text-xs" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Keep it</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); handleCancel() }}>{working ? 'Cancelling...' : 'Cancel return'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={action === 'credit'} onOpenChange={(open) => { if (!open && !working) setAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue a credit note?</AlertDialogTitle>
            <AlertDialogDescription>
              One credit note is made per invoice for the {creditUnits} unit(s) the customer no longer keeps, with its share of discount and VAT. The invoice balance drops, and any amount already paid beyond it can then be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Not yet</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); handleCredit() }}>{working ? 'Issuing...' : 'Issue credit note'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
