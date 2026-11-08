'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

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

import supabase from '@/config/supabaseClient'
import { formatDate, formatQty, useStockNames } from '@/components/modules/inventory/inventory-shared'
import {
  EmptyState,
  ErrorNote,
  HOLD_KIND,
  Tone,
  fetchReturnReserved,
  useFlowPaths,
} from '@/components/modules/inventory/receipt-shared'

// Purchases > Receipts > Excess: goods that arrived but are not on the order
// (more than was ordered, or a different product). Purchases placed the order,
// so purchases decides:
//
//   Accept into order  accept_excess_hold()  the order takes the goods (quantity
//                      ordered goes up at the order price) and they go on to
//                      inventory for checking, still in quarantine.
//   Return             starts a return for the pile; inventory hands it back.
//
// Inventory counts and holds these goods but cannot accept them.

export default function ExcessDecisionPage() {
  const { branchId } = useParams()
  const { purchaseReceipts, purchaseReturns } = useFlowPaths()

  const [holds, setHolds] = useState([])
  const [reserved, setReserved] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [quantities, setQuantities] = useState({})
  const [target, setTarget] = useState(null)
  const [note, setNote] = useState('')
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState(null)

  const { variants } = useStockNames(holds.map((hold) => hold.variant))
  const nameOf = (id) => {
    const info = variants[id]
    if (!info) return 'Item'
    return info.label ? `${info.title} · ${info.label}` : info.title
  }

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setLoadError('')

    const { data, error } = await supabase
      .from('purchase_receipt_holds')
      .select(
        `id, kind, status, quantity, note, variant, created_at,
         receipt_line:purchase_receipt_line_items (
           purchase_receipt:purchase_receipts (
             id, receipt_number,
             purchase_order:purchase_orders ( order_number, supplier, vendor:suppliers ( name ) )
           )
         )`
      )
      .eq('branch', branchId)
      .eq('status', 'awaiting_review')
      .in('kind', ['excess', 'wrong_item'])
      .order('created_at', { ascending: true })

    if (error) {
      setLoadError(error.message || 'Could not load excess goods.')
      setHolds([])
    } else {
      setHolds(data || [])
      setReserved(await fetchReturnReserved((data || []).map((hold) => hold.id)))
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const freeOf = (hold) => Math.max(Number(hold.quantity) - (reserved[hold.id] || 0), 0)
  const qtyFor = (hold) => {
    const raw = quantities[hold.id]
    return raw === undefined || raw === '' ? freeOf(hold) : Number(raw)
  }
  const qtyInvalid = (hold) => !(qtyFor(hold) > 0) || qtyFor(hold) > freeOf(hold)

  const accept = async () => {
    if (!target) return
    setWorking(true)
    const { data, error } = await supabase.rpc('accept_excess_hold', {
      p_hold: target.id,
      p_quantity: qtyFor(target),
      p_note: note.trim() || null,
    })
    setWorking(false)

    const response = Array.isArray(data) ? data[0] : data
    if (error || response?.success === false) {
      setResult({ ok: false, text: `${nameOf(target.variant)}: ${error?.message || response?.error || 'Could not be accepted.'}` })
    } else {
      setResult({
        ok: true,
        text: `${formatQty(qtyFor(target))} × ${nameOf(target.variant)} added to the order. Inventory will check it next.`,
      })
    }
    setTarget(null)
    setNote('')
    setQuantities({})
    load()
  }

  const returnLink = (hold) => {
    const order = hold.receipt_line?.purchase_receipt?.purchase_order
    const reason = hold.kind === 'wrong_item' ? 'Wrong item delivered' : 'Excess delivered'
    const params = new URLSearchParams({ hold: hold.id, reason })
    if (order?.supplier) params.set('supplier', order.supplier)
    return `${purchaseReturns}/new?${params.toString()}`
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="max-w-2xl text-xs text-gray-500">
        Goods that arrived but are not on the order. You placed the order, so you decide: add them to it, or send
        them back. Inventory only counts and holds them.
      </p>

      {result && (
        <div
          role="status"
          className={`rounded-sm border p-2.5 text-xs ${
            result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <p>{result.text}</p>
          <button type="button" className="mt-1 underline" onClick={() => setResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading excess goods...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : holds.length === 0 ? (
        <EmptyState>Nothing is waiting for your decision.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Receipt</th>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">Why held</th>
                <th className="px-3 py-2 text-left">Arrived</th>
                <th className="px-3 py-2 text-right">Waiting</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holds.map((hold) => {
                const receipt = hold.receipt_line?.purchase_receipt
                const order = receipt?.purchase_order
                const kind = HOLD_KIND[hold.kind] || { label: hold.kind, tone: 'gray' }
                const free = freeOf(hold)
                return (
                  <tr key={hold.id} className="align-top">
                    <td className="max-w-[220px] px-3 py-2 text-[11px] text-gray-800">
                      {nameOf(hold.variant)}
                      {hold.note && <span className="mt-0.5 block text-[10px] text-gray-500">{hold.note}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {receipt ? (
                        <Link href={`${purchaseReceipts}/${receipt.id}`} className="text-core hover:underline">
                          {receipt.receipt_number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{order?.order_number || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{order?.vendor?.name || '—'}</td>
                    <td className="px-3 py-2">
                      <Tone tone={kind.tone}>{kind.label}</Tone>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formatDate(hold.created_at)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      {formatQty(free)}
                      {free < Number(hold.quantity) && (
                        <span className="block text-[10px] text-gray-500">{formatQty(Number(hold.quantity) - free)} in a return</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        max={free}
                        value={quantities[hold.id] ?? ''}
                        placeholder={String(free)}
                        disabled={free <= 0}
                        onChange={(event) => setQuantities((previous) => ({ ...previous, [hold.id]: event.target.value }))}
                        className="ml-auto h-7 w-20 text-right text-xs"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        className="mr-1.5 h-7 bg-core text-xs text-white hover:bg-core/90"
                        disabled={free <= 0 || qtyInvalid(hold)}
                        onClick={() => setTarget(hold)}
                      >
                        Accept into order
                      </Button>
                      <Link
                        href={returnLink(hold)}
                        className="inline-flex h-7 items-center rounded-md border border-gray-300 px-2.5 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Return
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!target} onOpenChange={(open) => !open && !working && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Add these goods to the order?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {target ? `${formatQty(qtyFor(target))} × ${nameOf(target.variant)}. ` : ''}
              The order now covers them at the order price, so you can bill them. They stay in quarantine until
              inventory checks them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note (optional)"
            className="min-h-16 text-xs"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs" disabled={working}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-7 bg-core text-xs text-white hover:bg-core/90"
              disabled={working}
              onClick={accept}
            >
              Add to order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
