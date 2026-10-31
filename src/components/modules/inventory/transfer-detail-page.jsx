'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import { formatQty, useStockNames } from '@/components/modules/inventory/inventory-shared'
import { ErrorNote, Tone, fetchBatches } from '@/components/modules/inventory/receipt-shared'
import { formatDateTime } from '@/components/modules/inventory/adjustment-shared'
import { STATUS, describeRate, useTransferPaths } from '@/components/modules/inventory/transfer-shared'
import TransferReceivePanel from '@/components/modules/inventory/transfer-receive-panel'

// Inventory > Transfers > one submitted transfer. Drafts are edited on the
// New transfer page, not here.
//
// pending     submitted; waiting for approval (or approved, waiting to be sent).
//             It can be withdrawn back to a draft, or cancelled.
// in_transit  sent. The stock has left the sending warehouse and is in no
//             warehouse. The receiving warehouse accepts it (here, or on its
//             own Transfers tab). Management can still cancel it, which puts
//             the stock back where it came from.
// received    done. Anything that did not arrive is shown as a shortfall.
// cancelled   history.
//
// Every result on this page, good or bad, is also shown as a toast.

export default function TransferDetailPage() {
  const { transferId } = useParams()
  const router = useRouter()
  const { transfers } = useTransferPaths()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [voteNote, setVoteNote] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [batches, setBatches] = useState({})

  const load = useCallback(async () => {
    if (!transferId) return
    setLoadError('')
    const { data: payload, error } = await supabase.rpc('get_inventory_transfer', { p_transfer: transferId })
    if (error || !payload) {
      const message = error?.message || 'Transfer not found.'
      setLoadError(message)
      toast.error(message)
      setLoading(false)
      return
    }
    setData(payload)
    setLoading(false)
  }, [transferId])

  useEffect(() => {
    load()
  }, [load])

  const t = data?.transfer
  const approval = data?.approval
  const lines = data?.lines || []
  const variantIds = useMemo(() => lines.map((line) => line.variant), [lines])
  const { variants } = useStockNames(variantIds, [])

  useEffect(() => {
    let cancelled = false
    const ids = [...new Set(lines.map((line) => line.batch).filter(Boolean))]
    if (ids.length) {
      fetchBatches(ids).then((found) => {
        if (!cancelled) setBatches(found)
      })
    }
    return () => {
      cancelled = true
    }
  }, [lines])

  async function runAction(promise, done) {
    setBusy(true)
    const { data: result, error } = await promise
    if (error) toast.error(error.message)
    else if (result && result.success === false) toast.error(result.error || 'That did not work.')
    else if (done) toast.success(done)
    await load()
    setBusy(false)
    return { error, result }
  }

  const vote = (decision) =>
    runAction(
      supabase.rpc('cast_approval_vote', { p_request_id: approval.request_id, p_decision: decision, p_note: voteNote || null }),
      decision === 'approved' ? 'Your approval is recorded.' : 'Rejected.'
    ).then(() => setVoteNote(''))
  const send = () => runAction(supabase.rpc('post_inventory_transfer', { p_transfer: transferId }), 'Sent. The stock has left the warehouse and is now in transit.')

  async function withdraw() {
    const { error, result } = await runAction(supabase.rpc('withdraw_inventory_transfer', { p_transfer: transferId }), 'Withdrawn. It is a draft again.')
    if (!error && result?.success && result.draft_id) router.push(`${transfers}/new?draft=${result.draft_id}`)
  }

  async function cancel() {
    if (t.status === 'in_transit' && !cancelReason.trim()) {
      toast.error('Say why this transfer in transit is being cancelled.')
      return
    }
    await runAction(
      supabase.rpc('cancel_inventory_transfer', { p_transfer: transferId, p_reason: cancelReason || null }),
      t.status === 'in_transit' ? 'Cancelled. The stock is back in the sending warehouse.' : 'Cancelled.'
    )
    setShowCancel(false)
  }

  if (loading) return <p className="p-6 text-xs text-gray-500">Loading...</p>
  if (loadError) return <div className="p-6"><ErrorNote>{loadError}</ErrorNote></div>

  const requestStatus = approval?.request_status
  const displayStatus =
    t.status === 'pending' ? (requestStatus === 'approved' ? 'approved' : requestStatus === 'rejected' ? 'rejected' : 'pending') : t.status
  const status = STATUS[displayStatus] || STATUS.pending
  const rejection = (approval?.votes || []).find((entry) => entry.decision === 'rejected')
  const receiving = t.status === 'in_transit' && approval?.can_receive
  const rateText = describeRate(t.from_currency, t.to_currency, t.exchange_rate)

  return (
    <div className="max-w-6xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={transfers} className="text-[11px] text-gray-500 hover:underline">
            &larr; Transfers
          </Link>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="font-mono">{t.transfer_number}</span>
            <Tone tone={status.tone}>{status.label}</Tone>
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            {data.from_warehouse_name} <span className="text-gray-400">({data.from_branch_name})</span> &rarr; {data.to_warehouse_name}{' '}
            <span className="text-gray-400">({data.to_branch_name})</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Submitted {formatDateTime(t.submitted_at || t.created_at)}
            {approval?.submitted_by_name ? ` by ${approval.submitted_by_name}` : ''}
            {t.sent_at ? ` · sent ${formatDateTime(t.sent_at)}` : ''}
            {t.received_at ? ` · received ${formatDateTime(t.received_at)}${data.received_by_name ? ` by ${data.received_by_name}` : ''}` : ''}
          </p>
          {rateText && <p className="mt-1 text-xs text-gray-500">{rateText}</p>}
          {t.note && <p className="mt-1 text-xs text-gray-700">{t.note}</p>}
          {t.receive_note && <p className="mt-1 text-xs text-gray-700">Receiving note: {t.receive_note}</p>}
          {t.status === 'cancelled' && (
            <p className="mt-1 text-xs text-gray-600">
              Cancelled {formatDateTime(t.cancelled_at)}
              {t.cancel_reason ? `: ${t.cancel_reason}` : ''}
            </p>
          )}
        </div>
        {approval?.can_cancel && !showCancel && (
          <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => setShowCancel(true)} disabled={busy}>
            Cancel this transfer
          </Button>
        )}
      </div>

      {showCancel && (
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          {t.status === 'in_transit' && (
            <p className="text-xs text-gray-600">
              The stock has already left. Cancelling puts it back in {data.from_warehouse_name} at the cost it left at.
            </p>
          )}
          <Input
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder={t.status === 'in_transit' ? 'Why? (required)' : 'Why? (optional)'}
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => setShowCancel(false)} disabled={busy}>
              Keep it
            </Button>
            <Button type="button" className="h-7 bg-red-600 text-xs text-white hover:bg-red-700" onClick={cancel} disabled={busy}>
              Yes, cancel it
            </Button>
          </div>
        </div>
      )}

      {t.status === 'pending' && approval && (
        <section className="space-y-3 rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-800">Approval</h3>
          <p className="text-xs text-gray-600">
            {requestStatus === 'approved'
              ? 'Approved. Nothing has left the warehouse yet; send it to put the stock in transit.'
              : requestStatus === 'rejected'
                ? 'Rejected. Withdraw it to correct it as a draft, or cancel it.'
                : `${approval.approvals} of ${approval.approvals_required} approval${approval.approvals_required === 1 ? '' : 's'} so far. Stock does not move until it is approved and sent.`}
          </p>
          {(approval.votes || []).map((entry, index) => (
            <p key={index} className="text-[11px] text-gray-600">
              {entry.name} {entry.decision === 'approved' ? 'approved' : 'rejected'} on {formatDateTime(entry.at)}
              {entry.note ? `: ${entry.note}` : ''}
            </p>
          ))}
          {rejection && !rejection.note && <p className="text-[11px] text-gray-500">No reason was given.</p>}

          {approval.can_vote && (
            <div className="space-y-2">
              <Input value={voteNote} onChange={(event) => setVoteNote(event.target.value)} placeholder="Note (optional)" className="h-8 text-xs" />
              <div className="flex gap-2">
                <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/80" onClick={() => vote('approved')} disabled={busy}>
                  Approve
                </Button>
                <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => vote('rejected')} disabled={busy}>
                  Reject
                </Button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {approval.can_post && (
              <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/80" onClick={send} disabled={busy}>
                Send now
              </Button>
            )}
            {approval.can_withdraw && (
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={withdraw} disabled={busy}>
                Withdraw and edit
              </Button>
            )}
          </div>
        </section>
      )}

      {t.status === 'in_transit' && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
          {receiving
            ? 'This stock is on its way to this warehouse. Check what arrived and accept it below. It enters the warehouse only when you accept.'
            : `Sent ${formatDateTime(t.sent_at)}. The stock is in no warehouse until ${data.to_warehouse_name} accepts it.`}
        </section>
      )}

      {receiving ? (
        <TransferReceivePanel data={data} onDone={load} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Batch</th>
                <th className="px-3 py-2 text-right">Sent</th>
                {t.status === 'received' && <th className="px-3 py-2 text-right">Received</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line) => {
                const item = variants[line.variant]
                const short = t.status === 'received' && Number(line.quantity_received) < Number(line.quantity)
                return (
                  <tr key={line.id}>
                    <td className="px-3 py-2">
                      <p className="text-gray-900">{item?.title || '—'}</p>
                      <p className="font-mono text-[11px] text-gray-500">
                        {item?.sku || 'No SKU'}
                        {item?.label ? ` · ${item.label}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{line.batch ? batches[line.batch]?.batch_number || '—' : '—'}</td>
                    <td className="px-3 py-2 text-right">{formatQty(line.quantity)}</td>
                    {t.status === 'received' && (
                      <td className={`px-3 py-2 text-right ${short ? 'font-medium text-red-700' : ''}`}>
                        {formatQty(line.quantity_received)}
                        {short ? <span className="block text-[10px]">short {formatQty(Number(line.quantity) - Number(line.quantity_received))}</span> : null}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
