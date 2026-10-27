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
import { formatDate, formatQty } from '@/components/modules/inventory/inventory-shared'
import {
  EmptyState,
  ErrorNote,
  Tone,
  useFlowPaths,
  useInventoryCan,
} from '@/components/modules/inventory/receipt-shared'

// Outgoing > Returns: goods going back to suppliers.
//
// Purchases creates and approves the return; inventory hands the goods over
// and confirms it here. Confirming calls dispatch_purchase_return(), which
// takes the stock out (quarantine or available) at the cost it came in at.
//
//   Waiting to go out   approved returns (and drafts when approval is off)
//   Sent                the last returns that were handed over

const RESOLUTION = {
  credit_note: 'Credit note',
  refund: 'Refund',
  replacement: 'Replacement',
  debit_note: 'Debit note',
  write_off: 'Write-off',
  rejected: 'Rejected',
}

export default function OutgoingReturnsPage() {
  const { branchId } = useParams()
  const { root } = useFlowPaths()
  const canEditStock = useInventoryCan('edit')
  const returnsPath = root.replace('/inventory', '/purchases') + '/returns'

  const [waiting, setWaiting] = useState([])
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [target, setTarget] = useState(null)
  const [note, setNote] = useState('')
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setLoadError('')

    const select = `id, return_number, status, reason, resolution, created_at, approved_at, dispatched_at, dispatch_note,
                    supplier:suppliers ( name ),
                    lines:purchase_return_line_items ( id, quantity )`

    const [waitingResult, sentResult] = await Promise.all([
      supabase
        .from('purchase_returns')
        .select(select)
        .eq('branch', branchId)
        .eq('status', 'approved')
        .order('approved_at', { ascending: true }),
      supabase
        .from('purchase_returns')
        .select(select)
        .eq('branch', branchId)
        .eq('status', 'dispatched')
        .order('dispatched_at', { ascending: false })
        .limit(20),
    ])

    const failure = waitingResult.error || sentResult.error
    if (failure) {
      setLoadError(failure.message || 'Could not load returns.')
      setWaiting([])
      setSent([])
    } else {
      setWaiting(waitingResult.data || [])
      setSent(sentResult.data || [])
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const unitsOf = (row) => (row.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0)

  const dispatch = async () => {
    if (!target) return
    setWorking(true)
    const { data, error } = await supabase.rpc('dispatch_purchase_return', {
      p_return: target.id,
      p_note: note.trim() || null,
    })
    setWorking(false)

    const response = Array.isArray(data) ? data[0] : data
    if (error || response?.success === false) {
      setResult({ ok: false, text: `${target.return_number}: ${error?.message || response?.error || 'Could not be confirmed.'}` })
    } else {
      setResult({ ok: true, text: `${target.return_number} confirmed as handed over. The stock has left.` })
    }
    setTarget(null)
    setNote('')
    load()
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <p className="max-w-2xl text-xs text-gray-500">
        Returns that purchases has approved. Hand the goods to the supplier, then confirm it here so the stock leaves.
        Raising and approving returns is done in Purchases.
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
        <p className="text-xs text-gray-500">Loading returns...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-gray-800">Waiting to go out</h3>
            {waiting.length === 0 ? (
              <EmptyState>No approved returns are waiting.</EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Return</th>
                      <th className="px-3 py-2 text-left">Supplier</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                      <th className="px-3 py-2 text-left">Supplier will give</th>
                      <th className="px-3 py-2 text-right">Units</th>
                      <th className="px-3 py-2 text-left">Approved</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {waiting.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <Link href={`${returnsPath}/${row.id}`} className="font-medium text-core hover:underline">
                            {row.return_number}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{row.supplier?.name || '—'}</td>
                        <td className="max-w-[220px] px-3 py-2 text-gray-700">{row.reason || '—'}</td>
                        <td className="px-3 py-2">
                          <Tone tone="gray">{RESOLUTION[row.resolution] || row.resolution}</Tone>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900">{formatQty(unitsOf(row))}</td>
                        <td className="px-3 py-2 text-gray-700">{formatDate(row.approved_at)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 bg-core text-xs text-white hover:bg-core/90"
                            disabled={!canEditStock}
                            title={canEditStock ? undefined : 'You need inventory edit access to move stock'}
                            onClick={() => setTarget(row)}
                          >
                            Confirm handover
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-gray-800">Sent</h3>
            {sent.length === 0 ? (
              <EmptyState>Nothing has been sent back yet.</EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[640px] text-xs">
                  <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Return</th>
                      <th className="px-3 py-2 text-left">Supplier</th>
                      <th className="px-3 py-2 text-right">Units</th>
                      <th className="px-3 py-2 text-left">Sent</th>
                      <th className="px-3 py-2 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sent.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2">
                          <Link href={`${returnsPath}/${row.id}`} className="font-medium text-core hover:underline">
                            {row.return_number}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{row.supplier?.name || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-900">{formatQty(unitsOf(row))}</td>
                        <td className="px-3 py-2 text-gray-700">{formatDate(row.dispatched_at)}</td>
                        <td className="max-w-[260px] px-3 py-2 text-gray-600">{row.dispatch_note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <AlertDialog open={!!target} onOpenChange={(open) => !open && !working && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Confirm the goods were handed over?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {target ? `${target.return_number} · ${target.supplier?.name || 'Supplier'} · ${formatQty(unitsOf(target))} unit(s). ` : ''}
              The stock leaves the warehouse at the cost it came in at. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Who collected it, vehicle, waybill... (optional)"
            className="min-h-16 text-xs"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs" disabled={working}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-7 bg-core text-xs text-white hover:bg-core/90"
              disabled={working}
              onClick={dispatch}
            >
              Confirm handover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
