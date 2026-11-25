'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import supabase from '@/config/supabaseClient'
import {
  formatDate,
  formatMoney,
  formatQty,
  useBranchCurrency,
  useStockNames,
} from '@/components/modules/inventory/inventory-shared'
import {
  DAMAGE_REASONS,
  ErrorNote,
  HOLD_KIND,
  HOLD_STATUS,
  Tone,
  awaitsPurchasesDecision,
  chunk,
  damageReasonLabel,
  fetchBatches,
  fetchReturnReserved,
  isExtraKind,
  receiptState,
  sourceLabel,
  useFlowPaths,
} from '@/components/modules/inventory/receipt-shared'

// Receipts > [receipt]: one receipt, what was counted, and what has happened
// to each line since (accepted, in quarantine, damaged, returned).
//
// What can be done here depends on where the goods stand. Each pile of held
// goods shows its own buttons, and each button opens a small dialog that asks
// only what that action needs (how many, why, a note):
//
//   Awaiting check, matches the order   Accept into stock | Mark damaged | Return to supplier
//   Awaiting check, not on the order    Add to the order | Return to supplier
//                                       (once added it is an ordinary pile to accept)
//   Damaged on arrival                  Accept (found good) | Will not be returned | Return to supplier
//                                       (write-off opens after "will not be returned")
//   Damaged in storage / expired        Accept (found good) | Write off
//   Accepted, written off, returned     history, nothing to do
//   Done (nothing held)                 read-only
//
// Accept, mark damaged, write off and "will not be returned" need inventory
// edit. Adding excess to the order, returning to supplier and billing are
// Purchases actions, so they are links into Purchases. The quarantine tabs still
// work for bulk changes. Every result is also shown as a toast.

const ACTION_COPY = {
  accept: {
    title: 'Accept into available stock',
    body: 'These goods pass the check and become available stock.',
    button: 'Accept',
    done: 'Accepted into available stock.',
    fn: 'accept_receipt_hold',
    quantity: true,
  },
  damaged: {
    title: 'Mark as damaged',
    body: 'The goods stay in quarantine, flagged as damaged. Damage on arrival can then be returned to the supplier; other damage is written off.',
    button: 'Mark damaged',
    done: 'Marked damaged.',
    fn: 'mark_hold_damaged',
    quantity: true,
    reason: true,
  },
  writeoff: {
    title: 'Write off these goods',
    body: 'The goods leave stock as a loss at their cost. This cannot be undone.',
    button: 'Write off',
    done: 'Written off.',
    fn: 'write_off_hold',
    quantity: true,
  },
  addtoorder: {
    title: 'Add to the purchase order',
    body: 'The order is raised to cover these goods. They then become an ordinary pile waiting for a check, and can be accepted into stock.',
    button: 'Add to order',
    done: 'Added to the order. Accept them into stock when they pass the check.',
    fn: 'accept_excess_hold',
    quantity: true,
  },
  wontreturn: {
    title: 'These will not be returned',
    body: 'The supplier will not take them back or give credit. They can then be written off as a loss.',
    button: 'Confirm',
    done: 'Marked as not returned. They can now be written off.',
    fn: 'decline_hold_return',
    quantity: false,
  },
}

// The buttons a pile gets, in order. 'return' is a link, the rest open a dialog.
function actionsFor(hold) {
  if (hold.status === 'awaiting_review') {
    return isExtraKind(hold.hold_type) ? ['addtoorder', 'return'] : ['accept', 'damaged', 'return']
  }
  if (hold.status === 'damaged') {
    const list = isExtraKind(hold.hold_type) ? [] : ['accept']
    return awaitsPurchasesDecision(hold) ? [...list, 'wontreturn', 'return'] : [...list, 'writeoff']
  }
  return []
}

const ACTION_LABEL = {
  accept: 'Accept',
  damaged: 'Mark damaged',
  writeoff: 'Write off',
  addtoorder: 'Add to order',
  wontreturn: 'Will not be returned',
  return: 'Return to supplier',
}

// What this receipt's state means, in one sentence.
function guidance(state, hasOpen) {
  if (!hasOpen) return ''
  if (state.label === 'Excess pending') {
    return 'Some goods are not on the order. Add them to the order, or return them to the supplier.'
  }
  if (state.label === 'Damaged held') {
    return 'Some goods are marked damaged. Return them to the supplier, say they will not be returned, or write them off.'
  }
  return 'Some goods are counted in but are not stock yet. Check them, then accept what is good and mark what is damaged.'
}

export default function ReceiptDetailPage() {
  const { receiptId } = useParams()
  const { branchId, receipts: receiptsPath, orders: ordersPath, purchaseReturns, purchaseReceipts, bills: billsPath } = useFlowPaths()
  const currency = useBranchCurrency()

  const [receipt, setReceipt] = useState(null)
  const [warehouseName, setWarehouseName] = useState('')
  const [lines, setLines] = useState([])
  const [holdsByLine, setHoldsByLine] = useState({})
  const [reserved, setReserved] = useState({})
  const [batchNames, setBatchNames] = useState({})
  const [unbilled, setUnbilled] = useState([])
  const [reloadKey, setReloadKey] = useState(0)
  const [dialog, setDialog] = useState(null) // { action, hold }
  const [dialogQty, setDialogQty] = useState('')
  const [dialogNote, setDialogNote] = useState('')
  const [dialogReason, setDialogReason] = useState('arrival')
  const [working, setWorking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const { variants } = useStockNames(lines.map((line) => line.variant))
  const nameOf = (id) => {
    const info = variants[id]
    if (!info) return { title: 'Item', label: '', sku: '' }
    return info
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!receiptId || !branchId) return
      setLoading(true)
      setErrorMessage('')

      try {
        let head = await supabase
          .from('purchase_receipts')
          .select(
            `*, order_ref:purchase_orders!purchase_order ( id, order_number, supplier:suppliers ( name ) )`
          )
          .eq('id', receiptId)
          .eq('branch', branchId)
          .maybeSingle()

        if (head.error) {
          head = await supabase
            .from('purchase_receipts')
            .select('*')
            .eq('id', receiptId)
            .eq('branch', branchId)
            .maybeSingle()
        }
        if (head.error) throw head.error
        if (!head.data) throw new Error('Receipt not found.')

        const { data: lineRows, error: lineError } = await supabase
          .from('purchase_receipt_line_items')
          .select(
            `*, batch_row:inventory_batches!batch ( batch_number, supplier_batch_reference, expiry_date )`
          )
          .eq('purchase_receipt', receiptId)
          .order('id')
        if (lineError) throw lineError

        const grouped = {}
        for (const part of chunk((lineRows || []).map((row) => row.id))) {
          const { data: holdRows, error: holdError } = await supabase
            .from('quarantine_holds')
            .select('*')
            .in('purchase_receipt_line_item', part)
          if (holdError) {
            console.error('Could not read quarantine status:', holdError)
            continue
          }
          for (const hold of holdRows || []) {
            ;(grouped[hold.purchase_receipt_line_item] ||= []).push(hold)
          }
        }

        let warehouse = ''
        const warehouseId = head.data.warehouse
        if (warehouseId) {
          const { data: warehouseRow } = await supabase
            .from('warehouses')
            .select('*')
            .eq('id', warehouseId)
            .maybeSingle()
          warehouse = warehouseRow?.name || warehouseRow?.label || warehouseRow?.code || ''
        }

        const allHoldIds = Object.values(grouped).flat().map((hold) => hold.id)
        const reservedByHold = await fetchReturnReserved(allHoldIds)

        // Goods counted in on this order whose bill has not been entered yet.
        let unbilledRows = []
        if (head.data.purchase_order && head.data.status !== 'draft') {
          const variantIds = [...new Set((lineRows || []).map((row) => row.variant))]
          const { data: orderLines, error: orderLineError } = await supabase
            .from('purchase_order_line_items')
            .select('id, variant, quantity_ordered, quantity_received, quantity_delivered, quantity_billed, unit_cost_snapshot')
            .eq('purchase_order', head.data.purchase_order)
            .in('variant', variantIds.length ? variantIds : ['00000000-0000-0000-0000-000000000000'])
          if (orderLineError) {
            console.error('Could not read billing status:', orderLineError)
          } else {
            unbilledRows = (orderLines || [])
              .map((line) => {
                const counted = Number(line.quantity_delivered ?? line.quantity_received ?? 0)
                const billed = Number(line.quantity_billed || 0)
                return { ...line, counted, billed, unbilled: Math.max(counted - billed, 0) }
              })
              .filter((line) => line.unbilled > 0)
          }
        }

        const batchIds = [...new Set(Object.values(grouped).flat().map((hold) => hold.batch).filter(Boolean))]
        const names = batchIds.length ? await fetchBatches(batchIds) : {}

        if (cancelled) return
        setReserved(reservedByHold)
        setUnbilled(unbilledRows)
        setBatchNames(names)
        setReceipt(head.data)
        setWarehouseName(warehouse)
        setLines(lineRows || [])
        setHoldsByLine(grouped)
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load receipt:', error)
        setErrorMessage(error.message || 'Could not load this receipt.')
        toast.error(error.message || 'Could not load this receipt.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [receiptId, branchId, reloadKey])

  const freeQty = (hold) => Math.max(Number(hold.quantity || 0) - Number(reserved[hold.id] || 0), 0)

  function openDialog(action, hold) {
    setDialog({ action, hold })
    setDialogQty(String(freeQty(hold)))
    setDialogNote('')
    setDialogReason('arrival')
  }

  async function runDialog() {
    const { action, hold } = dialog
    const copy = ACTION_COPY[action]
    const quantity = Number(dialogQty)
    if (copy.quantity && (!(quantity > 0) || quantity > freeQty(hold))) {
      toast.error(`Enter a quantity above zero and no more than ${formatQty(freeQty(hold))}.`)
      return
    }
    setWorking(true)
    const args = { p_hold: hold.id, p_note: dialogNote.trim() || null }
    if (copy.quantity) args.p_quantity = quantity
    if (copy.reason) args.p_reason = dialogReason
    const { data, error } = await supabase.rpc(copy.fn, args)
    setWorking(false)
    if (error) {
      toast.error(error.message)
      return
    }
    if (data && data.success === false) {
      toast.error(data.error || 'That did not work.')
      return
    }
    toast.success(copy.done)
    setDialog(null)
    setReloadKey((key) => key + 1)
  }

  if (loading) return <p className="p-4 text-xs text-gray-500">Loading receipt...</p>
  if (errorMessage || !receipt) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <ErrorNote>{errorMessage || 'Receipt not found.'}</ErrorNote>
        <Link href={receiptsPath} className="text-xs text-core hover:underline">
          Back to receipts
        </Link>
      </div>
    )
  }

  const allHolds = Object.values(holdsByLine).flat()
  const openHolds = allHolds.filter((hold) => hold.status === 'awaiting_review' || hold.status === 'damaged')
  const state = receiptState(receipt, openHolds)
  const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
  const value = lines.reduce(
    (sum, line) => sum + (line.unit_cost_snapshot == null ? 0 : Number(line.quantity || 0) * Number(line.unit_cost_snapshot)),
    0
  )
  const order = receipt.order_ref
  const heldPiles = allHolds.filter((hold) => hold.status === 'awaiting_review' || hold.status === 'damaged')
  const history = allHolds.filter((hold) => !(hold.status === 'awaiting_review' || hold.status === 'damaged'))
  const hint = guidance(state, heldPiles.length > 0)
  const dialogCopy = dialog ? ACTION_COPY[dialog.action] : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={receiptsPath}
            className="mb-1 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="size-3" /> Receipts
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-gray-800">{receipt.receipt_number}</h2>
            <Tone tone={state.tone}>{state.label}</Tone>
          </div>
        </div>
        {receipt.status === 'draft' && (
          <Link
            href={`${receiptsPath}/new?draft=${receipt.id}`}
            className="h-7 rounded-md bg-core px-4 py-1.5 text-sm font-medium text-white hover:bg-core/90"
          >
            Continue counting
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-gray-200 p-3 text-xs sm:grid-cols-4">
        <Field label="Source">{sourceLabel(receipt)}</Field>
        <Field label="Purchase order">
          {order?.id ? (
            <Link href={`${ordersPath}/${order.id}`} className="text-core hover:underline">
              {order.order_number}
            </Link>
          ) : (
            '—'
          )}
        </Field>
        <Field label="Supplier">{order?.supplier?.name || '—'}</Field>
        <Field label="Warehouse">{warehouseName || '—'}</Field>
        <Field label="Counted on">{formatDate(receipt.received_at || receipt.created_at)}</Field>
        <Field label="Delivery note">{receipt.delivery_note || '—'}</Field>
        <Field label="Units">{formatQty(units)}</Field>
        <Field label="Value at order price">{value > 0 ? formatMoney(value, currency) : '—'}</Field>
      </dl>

      {receipt.notes && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">{receipt.notes}</p>
      )}

      {heldPiles.length > 0 && (
        <section className="receipt-decision-panel space-y-2 rounded-lg border border-amber-200 p-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-800">Needs a decision</h3>
            {hint && <p className="mt-0.5 text-[11px] text-gray-600">{hint}</p>}
          </div>
          <div className="receipt-held-items divide-y divide-amber-100 rounded-md border border-amber-100 bg-white">
            {heldPiles.map((hold) => {
              const line = lines.find((row) => row.id === hold.purchase_receipt_line_item)
              const info = nameOf(line?.variant || hold.variant)
              const kind = HOLD_KIND[hold.hold_type] || { label: hold.hold_type, tone: 'gray' }
              const status = HOLD_STATUS[hold.status] || { label: hold.status, tone: 'gray' }
              const free = freeQty(hold)
              const inReturn = Number(reserved[hold.id] || 0)
              return (
                <div key={hold.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-900">
                      {info.title}
                      {info.label ? ` · ${info.label}` : ''}
                      {info.sku ? <span className="ml-1 font-mono text-[10px] text-gray-500">{info.sku}</span> : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
                      <Tone tone={hold.status === 'awaiting_review' && isExtraKind(hold.hold_type) ? 'amber' : status.tone}>{status.label}</Tone>
                      {hold.hold_type !== 'normal' && <Tone tone={kind.tone}>{kind.label}</Tone>}
                      <span>{formatQty(hold.quantity)} held</span>
                      {hold.batch && batchNames[hold.batch]?.batch_number ? <span>Batch {batchNames[hold.batch].batch_number}</span> : null}
                      {hold.status === 'damaged' && <span>{damageReasonLabel(hold.damage_reason)}</span>}
                      {hold.return_decision === 'write_off' && <span>will not be returned</span>}
                      {inReturn > 0 && <span className="text-amber-700">{formatQty(inReturn)} already in a return</span>}
                    </p>
                    {hold.note && <p className="mt-0.5 text-[10px] text-gray-500">{hold.note}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {actionsFor(hold).map((action) =>
                      action === 'return' || action === 'addtoorder' ? (
                        <Link
                          key={action}
                          href={action === 'return' ? `${purchaseReturns}/new` : `${purchaseReceipts}/excess`}
                          className="inline-flex h-7 items-center rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-800 hover:bg-gray-50"
                        >
                          {ACTION_LABEL[action]}
                        </Link>
                      ) : (
                        <Button
                          key={action}
                          type="button"
                          variant={action === 'accept' || action === 'addtoorder' ? 'default' : 'outline'}
                          className={`h-7 text-xs ${action === 'accept' || action === 'addtoorder' ? 'bg-core text-white hover:bg-core/90' : ''}`}
                          disabled={free <= 0 && ACTION_COPY[action].quantity}
                          onClick={() => openDialog(action, hold)}
                        >
                          {ACTION_LABEL[action]}
                        </Button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-500">
            Adding excess goods to the order and returning goods to the supplier are Purchases actions, so those buttons open Purchases. Several piles at once can still be done from the Quarantine and Damaged tabs.
          </p>
        </section>
      )}

      {unbilled.length > 0 && (
        <section className="space-y-2 rounded-lg border border-gray-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold text-gray-800">Not billed yet</h3>
              <p className="mt-0.5 text-[11px] text-gray-600">
                Counted in on this order but the supplier's bill has not been entered. Until it is, these are valued at the order price.
              </p>
            </div>
            <Link
              href={`${billsPath}/new`}
              className="inline-flex h-7 items-center rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-800 hover:bg-gray-50"
            >
              Enter the bill (Purchases)
            </Link>
          </div>
          <ul className="divide-y divide-gray-100 text-xs">
            {unbilled.map((row) => {
              const info = nameOf(row.variant)
              return (
                <li key={row.id} className="flex justify-between gap-3 py-1.5">
                  <span className="text-gray-800">
                    {info.title}
                    {info.label ? ` · ${info.label}` : ''}
                  </span>
                  <span className="text-gray-600">
                    {formatQty(row.unbilled)} not billed (counted {formatQty(row.counted)}, billed {formatQty(row.billed)})
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {receipt.status !== 'draft' && heldPiles.length === 0 && history.length > 0 && (
        <p className="text-[11px] text-gray-500">Nothing is held. Everything counted in has been decided; the table below shows what happened.</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[860px] text-xs">
          <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-left">Batch</th>
              <th className="px-3 py-2 text-right">Counted</th>
              <th className="px-3 py-2 text-right">Matches order</th>
              <th className="px-3 py-2 text-right">Not on order</th>
              <th className="px-3 py-2 text-right">Unit cost</th>
              <th className="px-3 py-2 text-left">What happened to it</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line) => {
              const info = nameOf(line.variant)
              const batch = line.batch_row
              const holds = holdsByLine[line.id] || []
              const totals = new Map()
              for (const hold of holds) {
                const key = `${hold.hold_type}:${hold.status}`
                totals.set(key, (totals.get(key) || 0) + Number(hold.quantity || 0))
              }
              return (
                <tr key={line.id}>
                  <td className="max-w-[240px] px-3 py-2">
                    <p className="text-[11px] leading-tight text-gray-800">
                      {info.title}
                      {info.label ? ` · ${info.label}` : ''}
                    </p>
                    {info.sku && <p className="text-[10px] text-gray-500">{info.sku}</p>}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {batch ? (
                      <>
                        {batch.batch_number}
                        <span className="block text-[10px] text-gray-500">
                          {batch.supplier_batch_reference ? `Lot ${batch.supplier_batch_reference} · ` : ''}
                          {batch.expiry_date ? `Exp ${formatDate(batch.expiry_date)}` : 'No expiry'}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatQty(line.quantity)}</td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {formatQty(line.quantity_accepted ?? line.quantity)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {Number(line.excess_quantity || 0) > 0 ? formatQty(line.excess_quantity) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {line.unit_cost_snapshot == null ? '—' : formatMoney(line.unit_cost_snapshot, currency)}
                  </td>
                  <td className="px-3 py-2">
                    {totals.size === 0 ? (
                      <span className="text-gray-500">{receipt.status === 'draft' ? 'Not posted yet' : 'Straight to stock'}</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {[...totals.entries()].map(([key, quantity]) => {
                          const [kind, status] = key.split(':')
                          const statusInfo = HOLD_STATUS[status] || { label: status, tone: 'gray' }
                          const extra = isExtraKind(kind)
                          return (
                            <Tone key={key} tone={extra && status === 'awaiting_review' ? 'amber' : statusInfo.tone}>
                              {formatQty(quantity)} {extra ? (HOLD_KIND[kind]?.label || kind).toLowerCase() + ', ' : ''}
                              {statusInfo.label.toLowerCase()}
                            </Tone>
                          )
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(dialog)} onOpenChange={(open) => (!open && !working ? setDialog(null) : undefined)}>
        <DialogContent className="max-w-md">
          {dialog && dialogCopy && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm">{dialogCopy.title}</DialogTitle>
                <DialogDescription className="text-xs">{dialogCopy.body}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-xs">
                <p className="text-gray-700">
                  {nameOf(lines.find((row) => row.id === dialog.hold.purchase_receipt_line_item)?.variant || dialog.hold.variant).title}
                  {' · '}
                  {formatQty(freeQty(dialog.hold))} available to act on
                </p>
                {dialogCopy.quantity && (
                  <label className="block font-medium text-gray-700">
                    How many
                    <Input
                      type="number"
                      min={0}
                      max={freeQty(dialog.hold)}
                      step="any"
                      value={dialogQty}
                      onChange={(event) => setDialogQty(event.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </label>
                )}
                {dialogCopy.reason && (
                  <label className="block font-medium text-gray-700">
                    What happened to them
                    <select
                      value={dialogReason}
                      onChange={(event) => setDialogReason(event.target.value)}
                      className="mt-1 h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                    >
                      {DAMAGE_REASONS.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block font-medium text-gray-700">
                  Note (optional)
                  <Textarea value={dialogNote} onChange={(event) => setDialogNote(event.target.value)} rows={2} className="mt-1 text-xs" />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => setDialog(null)} disabled={working}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className={`h-7 text-xs text-white ${dialog.action === 'writeoff' ? 'bg-red-600 hover:bg-red-700' : 'bg-core hover:bg-core/90'}`}
                  onClick={runDialog}
                  disabled={working}
                >
                  {working ? 'Working...' : dialogCopy.button}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-800">{children}</dd>
    </div>
  )
}
