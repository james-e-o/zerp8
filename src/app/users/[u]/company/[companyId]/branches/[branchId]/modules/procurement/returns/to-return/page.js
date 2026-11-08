'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

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

import supabase from '@/config/supabaseClient'
import { formatDate, formatQty, useStockNames } from '@/components/modules/inventory/inventory-shared'
import {
  EmptyState,
  ErrorNote,
  awaitsPurchasesDecision,
  fetchReturnReserved,
  useFlowPaths,
} from '@/components/modules/inventory/receipt-shared'

// Purchases > Returns > To return: goods inventory found damaged on arrival.
// Damage is a fact about the goods, not an instruction. What happens next is
// purchases' call, because the supplier is the one who may owe credit:
//
//   Create return    opens a new return with the pile filled in; the pile is
//                    held for that return until inventory hands it back.
//   Won't return     decline_hold_return() - the supplier will not take it
//                    back. Inventory can then write the goods off.
//
// Goods damaged in storage, expired, or damaged for another reason never
// appear here: no supplier is involved, so inventory writes them off.

export default function ToReturnPage() {
  const { branchId } = useParams()
  const { purchaseReceipts, purchaseReturns } = useFlowPaths()

  const [holds, setHolds] = useState([])
  const [reserved, setReserved] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
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
        `*,
         receipt_line:purchase_receipt_line_items (
           purchase_receipt:purchase_receipts (
             id, receipt_number,
             purchase_order:purchase_orders ( order_number, supplier, vendor:suppliers ( name ) )
           )
         )`
      )
      .eq('branch', branchId)
      .eq('status', 'damaged')
      .order('created_at', { ascending: true })

    if (error) {
      setLoadError(error.message || 'Could not load damaged goods.')
      setHolds([])
    } else {
      const mine = (data || []).filter(awaitsPurchasesDecision)
      setHolds(mine)
      setReserved(await fetchReturnReserved(mine.map((hold) => hold.id)))
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const freeOf = (hold) => Math.max(Number(hold.quantity) - (reserved[hold.id] || 0), 0)
  // A pile already in a return has been dealt with; it shows up on that return.
  const rows = holds.filter((hold) => freeOf(hold) > 0)

  const returnLink = (hold) => {
    const order = hold.receipt_line?.purchase_receipt?.purchase_order
    const params = new URLSearchParams({ hold: hold.id, reason: 'Damaged on arrival' })
    if (order?.supplier) params.set('supplier', order.supplier)
    return `${purchaseReturns}/new?${params.toString()}`
  }

  const decline = async () => {
    if (!target) return
    setWorking(true)
    const { data, error } = await supabase.rpc('decline_hold_return', {
      p_hold: target.id,
      p_note: note.trim() || null,
    })
    setWorking(false)

    const response = Array.isArray(data) ? data[0] : data
    if (error || response?.success === false) {
      setResult({ ok: false, text: `${nameOf(target.variant)}: ${error?.message || response?.error || 'Could not be saved.'}` })
    } else {
      setResult({ ok: true, text: `${nameOf(target.variant)} will not be returned. Inventory can write it off.` })
    }
    setTarget(null)
    setNote('')
    load()
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="max-w-2xl text-xs text-gray-500">
        Goods that arrived damaged. Raise a return if the supplier should take them back, or say they will not be
        returned and inventory will write them off.
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
        <p className="text-xs text-gray-500">Loading damaged goods...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : rows.length === 0 ? (
        <EmptyState>No damaged goods are waiting for a return.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[860px] text-xs">
            <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Receipt</th>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">What inventory found</th>
                <th className="px-3 py-2 text-left">Found</th>
                <th className="px-3 py-2 text-right">Damaged</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((hold) => {
                const receipt = hold.receipt_line?.purchase_receipt
                const order = receipt?.purchase_order
                const free = freeOf(hold)
                return (
                  <tr key={hold.id} className="align-top">
                    <td className="max-w-[220px] px-3 py-2 text-[11px] text-gray-800">{nameOf(hold.variant)}</td>
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
                    <td className="max-w-[240px] px-3 py-2 text-gray-600">{hold.note || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{formatDate(hold.decided_at || hold.created_at)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      {formatQty(free)}
                      {free < Number(hold.quantity) && (
                        <span className="block text-[10px] text-gray-500">{formatQty(Number(hold.quantity) - free)} in a return</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Link
                        href={returnLink(hold)}
                        className="mr-1.5 inline-flex h-7 items-center rounded-md bg-core px-2.5 text-xs font-medium text-white hover:bg-core/90"
                      >
                        Create return
                      </Link>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTarget(hold)}>
                        Won&apos;t return
                      </Button>
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
            <AlertDialogTitle className="text-base">Will this not be returned?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {target ? `${nameOf(target.variant)}. ` : ''}
              The supplier will not take these back, so no credit is expected. Inventory can then write the goods
              off as a loss.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why not? (optional, e.g. the supplier refused the claim)"
            className="min-h-16 text-xs"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs" disabled={working}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-7 bg-core text-xs text-white hover:bg-core/90"
              disabled={working}
              onClick={decline}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
