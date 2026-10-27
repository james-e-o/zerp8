'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

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
  DAMAGE_REASONS,
  HOLD_KIND,
  HOLD_STATUS,
  Tone,
  awaitsPurchasesDecision,
  damageReasonLabel,
  fetchBatches,
  isExtraKind,
  useFlowPaths,
  useInventoryCan,
} from '@/components/modules/inventory/receipt-shared'

// Shared by the Quarantine, Excess and Damaged tabs of Inventory > Receipts.
// Rows come from purchase_receipt_holds. Every action is a database function
// that also writes the stock ledger.
//
//   view="all"      everything still in quarantine
//   view="excess"   goods that do not match the order (excess and unexpected
//                   items). Purchases decides about these, so inventory only
//                   sees them here and cannot accept them.
//   view="damaged"  goods inventory marked damaged. Purchases sees the same
//                   list as "needs return"; inventory can still accept them
//                   (found good after all) or write them off.
//
//   Accept        accept_receipt_hold()   quarantine -> available
//   Mark damaged  mark_hold_damaged()     stays in quarantine, flagged
//   Write off     write_off_hold()        removes damaged goods at cost. Goods
//                 that were damaged on arrival wait for purchases first: it either
//                 returns them for credit or says it will not, and only then can
//                 inventory write them off. Goods damaged in storage, expired or
//                 damaged for another reason are inventory's to write off directly.

const COPY = {
  all: {
    hint: 'Goods counted in but not yet available. Inspect them, then accept what is good and mark what is damaged.',
    empty: 'Nothing is waiting in quarantine.',
  },
  excess: {
    hint: 'Goods that do not match the order. Purchases decides whether the order takes them or they go back to the supplier.',
    empty: 'No excess or unexpected goods are waiting.',
  },
  damaged: {
    hint: 'Goods marked damaged. Damage on arrival goes to purchases, who return it or say it will not be returned; you can then write it off. Other damage you write off yourself. You can still accept goods that turn out fine.',
    empty: 'Nothing is marked damaged.',
  },
}

export default function QuarantineQueuePage({ view = 'all' }) {
  const { branchId, receipts: receiptsPath } = useFlowPaths()
  const canEditStock = useInventoryCan('edit')

  const [holds, setHolds] = useState([])
  const [batches, setBatches] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState({})
  const [quantities, setQuantities] = useState({})
  const [action, setAction] = useState(null) // 'accept' | 'damaged' | 'writeoff'
  const [note, setNote] = useState('')
  const [damageReason, setDamageReason] = useState('arrival')
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
             purchase_order:purchase_orders ( order_number, supplier:suppliers ( name ) )
           )
         )`
      )
      .eq('branch', branchId)
      .in('status', ['awaiting_review', 'damaged'])
      .order('created_at', { ascending: false })

    if (error) {
      setLoadError(error.message || 'Could not load quarantined goods.')
      setHolds([])
    } else {
      setHolds(data || [])
      setBatches(await fetchBatches((data || []).map((hold) => hold.batch)))
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setSelected({})
    setQuantities({})
  }, [view])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return holds.filter((hold) => {
      if (view === 'excess' && !isExtraKind(hold.kind)) return false
      if (view === 'damaged' && hold.status !== 'damaged') return false
      if (!needle) return true
      const receipt = hold.receipt_line?.purchase_receipt
      const haystack = [
        nameOf(hold.variant),
        receipt?.receipt_number,
        receipt?.purchase_order?.order_number,
        receipt?.purchase_order?.supplier?.name,
        batches[hold.batch]?.batch_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holds, view, search, variants, batches])

  // Goods that do not match the order are for purchases to decide.
  const isLocked = (hold) => isExtraKind(hold.kind)
  const actionable = visible.filter((hold) => !isLocked(hold))
  const selectedHolds = actionable.filter((hold) => selected[hold.id])

  const qtyFor = (hold) => {
    const raw = quantities[hold.id]
    return raw === undefined || raw === '' ? Number(hold.quantity) : Number(raw)
  }
  const qtyInvalid = (hold) => {
    const quantity = qtyFor(hold)
    return !(quantity > 0) || quantity > Number(hold.quantity)
  }

  const hasInvalid = selectedHolds.some(qtyInvalid)
  const allAwaiting = selectedHolds.length > 0 && selectedHolds.every((hold) => hold.status === 'awaiting_review')
  const allDamaged = selectedHolds.length > 0 && selectedHolds.every((hold) => hold.status === 'damaged')
  // Damage on arrival waits for purchases before inventory may write it off.
  const writeOffBlocked = selectedHolds.some(awaitsPurchasesDecision)
  const allSelected = actionable.length > 0 && actionable.every((hold) => selected[hold.id])

  const toggleAll = () => {
    setSelected(allSelected ? {} : Object.fromEntries(actionable.map((hold) => [hold.id, true])))
  }

  const fn = { accept: 'accept_receipt_hold', damaged: 'mark_hold_damaged', writeoff: 'write_off_hold' }

  const run = async () => {
    setWorking(true)
    const failures = []
    let done = 0

    // One at a time: each call locks, and may split, its row.
    for (const hold of selectedHolds) {
      const args = {
        p_hold: hold.id,
        p_quantity: qtyFor(hold),
        p_note: note.trim() || null,
      }
      // Why the goods are damaged; decides who acts on them next.
      if (action === 'damaged') args.p_reason = damageReason
      const { error } = await supabase.rpc(fn[action], args)
      if (error) failures.push(`${nameOf(hold.variant)}: ${error.message}`)
      else done += 1
    }

    setWorking(false)
    setAction(null)
    setNote('')
    setDamageReason('arrival')
    setSelected({})
    setQuantities({})

    const verb = { accept: 'accepted into available stock', damaged: 'marked damaged', writeoff: 'written off' }[action]
    setResult({
      ok: failures.length === 0,
      lines:
        failures.length === 0
          ? [`${done} line(s) ${verb}.`]
          : [`${done} done, ${failures.length} could not be completed:`, ...failures],
    })
    load()
  }

  const dialog = {
    accept: {
      title: 'Accept into available stock?',
      body: 'The selected goods pass inspection and become available stock.',
      button: 'Accept',
    },
    damaged: {
      title: 'Mark as damaged?',
      body: 'The goods stay in quarantine, flagged as damaged. Damage on arrival appears in purchases\' list of goods to return; other damage is yours to write off.',
      button: 'Mark damaged',
    },
    writeoff: {
      title: 'Write off these goods?',
      body: 'The goods leave stock as a loss at their cost. This cannot be undone.',
      button: 'Write off',
    },
  }[action || 'accept']

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs text-gray-500">{COPY[view]?.hint}</p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search item, receipt, order or batch"
          className="h-7 w-64 text-xs"
        />
      </div>

      {result && (
        <div
          role="status"
          className={`rounded-sm border p-2.5 text-xs ${
            result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {result.lines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
          <button type="button" className="mt-1 underline" onClick={() => setResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {selectedHolds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-gray-200 bg-gray-50 p-2">
          <span className="text-xs text-gray-600">{selectedHolds.length} selected</span>
          <Button
            type="button"
            size="sm"
            className="h-7 bg-core text-xs text-white hover:bg-core/90"
            disabled={!canEditStock || hasInvalid || working}
            onClick={() => setAction('accept')}
          >
            Accept
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!canEditStock || hasInvalid || working || !allAwaiting}
            onClick={() => setAction('damaged')}
          >
            Mark damaged
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!canEditStock || hasInvalid || working || !allDamaged || writeOffBlocked}
            onClick={() => setAction('writeoff')}
            title={
              writeOffBlocked
                ? 'Damage on arrival waits for purchases to return it or say it will not be returned'
                : 'Only goods already marked damaged can be written off'
            }
          >
            Write off
          </Button>
          {!canEditStock && (
            <span className="text-[11px] text-gray-500">You need inventory edit access to change stock.</span>
          )}
          {hasInvalid && (
            <span className="text-[11px] text-red-600">A quantity is zero or more than what is held.</span>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading quarantined goods...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : visible.length === 0 ? (
        <EmptyState>{search ? 'Nothing matches that search.' : COPY[view]?.empty}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
              <tr>
                <th className="w-8 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={actionable.length === 0}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Batch</th>
                <th className="px-3 py-2 text-left">Receipt</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">Why held</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Held</th>
                <th className="px-3 py-2 text-right">Quantity to act on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((hold) => {
                const receipt = hold.receipt_line?.purchase_receipt
                const batch = batches[hold.batch]
                const locked = isLocked(hold)
                const kind = HOLD_KIND[hold.kind] || { label: hold.kind, tone: 'gray' }
                const status = HOLD_STATUS[hold.status] || { label: hold.status, tone: 'gray' }
                return (
                  <tr key={hold.id} className={selected[hold.id] ? 'bg-core_light/40' : ''}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!selected[hold.id]}
                        disabled={locked}
                        onChange={() => setSelected((previous) => ({ ...previous, [hold.id]: !previous[hold.id] }))}
                        aria-label="Select line"
                        title={locked ? 'Purchases decides about goods that do not match the order' : undefined}
                      />
                    </td>
                    <td className="max-w-[240px] px-3 py-2">
                      <p className="text-[11px] leading-tight text-gray-800">{nameOf(hold.variant)}</p>
                      {hold.note && <p className="mt-0.5 text-[10px] text-gray-500">{hold.note}</p>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {batch ? (
                        <>
                          {batch.batch_number}
                          <span className="block text-[10px] text-gray-500">
                            {batch.expiry_date ? `Exp ${formatDate(batch.expiry_date)}` : 'No expiry'}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {receipt ? (
                        <Link href={`${receiptsPath}/${receipt.id}`} className="text-core hover:underline">
                          {receipt.receipt_number}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {receipt?.purchase_order?.order_number && (
                        <span className="block text-[10px] text-gray-500">{receipt.purchase_order.order_number}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{receipt?.purchase_order?.supplier?.name || '—'}</td>
                    <td className="px-3 py-2">
                      <Tone tone={kind.tone}>{kind.label}</Tone>
                    </td>
                    <td className="px-3 py-2">
                      {locked ? (
                        <Tone tone="amber">Purchases to decide</Tone>
                      ) : (
                        <Tone tone={status.tone}>{status.label}</Tone>
                      )}
                      {hold.status === 'damaged' && (
                        <span className="mt-0.5 block text-[10px] text-gray-500">
                          {damageReasonLabel(hold.damage_reason)}
                          {hold.return_decision === 'write_off' && ' · will not be returned'}
                          {awaitsPurchasesDecision(hold) && ' · purchases to decide'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">{formatQty(hold.quantity)}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        max={hold.quantity}
                        value={quantities[hold.id] ?? ''}
                        placeholder={String(hold.quantity)}
                        disabled={!selected[hold.id]}
                        onChange={(event) =>
                          setQuantities((previous) => ({ ...previous, [hold.id]: event.target.value }))
                        }
                        className="ml-auto h-7 w-20 text-right text-xs"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!action} onOpenChange={(open) => !open && !working && setAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">{dialog.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">{dialog.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-700">
            {selectedHolds.map((hold) => (
              <li key={hold.id}>
                {formatQty(qtyFor(hold))} × {nameOf(hold.variant)}
              </li>
            ))}
          </ul>
          {action === 'damaged' && (
            <label className="block text-[10px] text-gray-500">
              Why is it damaged?
              <select
                value={damageReason}
                onChange={(event) => setDamageReason(event.target.value)}
                className="mt-0.5 h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {DAMAGE_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={action === 'accept' ? 'Note (optional)' : 'Reason (optional)'}
            className="min-h-16 text-xs"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs" disabled={working}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-7 bg-core text-xs text-white hover:bg-core/90"
              disabled={working}
              onClick={run}
            >
              {dialog.button}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}