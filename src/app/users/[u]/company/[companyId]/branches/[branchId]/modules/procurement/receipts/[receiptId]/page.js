'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

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
import {
  formatDate,
  formatMoney,
  formatQty,
  useBranchCurrency,
  useStockNames,
} from '@/components/modules/inventory/inventory-shared'
import {
  ErrorNote,
  HOLD_KIND,
  HOLD_STATUS,
  Tone,
  chunk,
  fetchReturnReserved,
  isExtraKind,
  receiptState,
  sourceLabel,
  useFlowPaths,
} from '@/components/modules/inventory/receipt-shared'

// Purchases > Receipts > [receipt]: one receipt as inventory counted it, and
// what has happened to each line since (accepted, in quarantine, damaged,
// returned). The receipt itself is read-only. Purchases acts from here on two
// things: goods that are not on the order (accept them into the order, or send
// them back) and damaged goods (Returns > To return). Accepting needs the
// purchase order edit permission; the database enforces it.

export default function PurchasesReceiptDetailPage() {
  const { receiptId } = useParams()
  const { branchId, purchaseReceipts: receiptsPath, purchaseReturns: returnsPath, orders: ordersPath } = useFlowPaths()
  const currency = useBranchCurrency()

  const [receipt, setReceipt] = useState(null)
  const [warehouseName, setWarehouseName] = useState('')
  const [lines, setLines] = useState([])
  const [holdsByLine, setHoldsByLine] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reserved, setReserved] = useState({})
  const [quantities, setQuantities] = useState({})
  const [target, setTarget] = useState(null)
  const [note, setNote] = useState('')
  const [working, setWorking] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

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
            `*, order_ref:purchase_orders!purchase_order ( id, order_number, supplier:suppliers ( id, name ) )`
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

        const pendingIds = Object.values(grouped)
          .flat()
          .filter((hold) => isExtraKind(hold.hold_type) && hold.status === 'awaiting_review')
          .map((hold) => hold.id)
        const reservedNow = pendingIds.length ? await fetchReturnReserved(pendingIds) : {}

        if (cancelled) return
        setReserved(reservedNow)
        setReceipt(head.data)
        setWarehouseName(warehouse)
        setLines(lineRows || [])
        setHoldsByLine(grouped)
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load receipt:', error)
        toast.error(error.message || 'Could not load this receipt.')
        setErrorMessage(error.message || 'Could not load this receipt.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [receiptId, branchId, reloadKey])

  const pendingExtra = Object.values(holdsByLine)
    .flat()
    .filter((hold) => isExtraKind(hold.hold_type) && hold.status === 'awaiting_review')
  const freeOf = (hold) => Math.max(Number(hold.quantity) - (reserved[hold.id] || 0), 0)
  const qtyFor = (hold) => {
    const raw = quantities[hold.id]
    return raw === undefined || raw === '' ? freeOf(hold) : Number(raw)
  }
  const qtyInvalid = (hold) => !(qtyFor(hold) > 0) || qtyFor(hold) > freeOf(hold)
  const labelOf = (id) => {
    const info = nameOf(id)
    return info.label ? `${info.title} · ${info.label}` : info.title
  }

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
      console.error('Could not accept goods into the order:', error || response)
      toast.error(`${labelOf(target.variant)}: ${error?.message || response?.error || 'Could not be accepted.'}`)
    } else {
      toast.success(`${formatQty(qtyFor(target))} × ${labelOf(target.variant)} added to the order. Inventory will check it next.`)
      setReloadKey((key) => key + 1)
    }
    setTarget(null)
    setNote('')
    setQuantities({})
  }

  const returnLink = (hold) => {
    const reason = hold.hold_type === 'wrong_item' ? 'Wrong item delivered' : 'Excess delivered'
    const params = new URLSearchParams({ hold: hold.id, reason })
    if (order?.supplier?.id) params.set('supplier', order.supplier.id)
    return `${returnsPath}/new?${params.toString()}`
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
  const needsExcess = allHolds
    .filter((hold) => isExtraKind(hold.hold_type) && hold.status === 'awaiting_review')
    .reduce((sum, hold) => sum + Number(hold.quantity || 0), 0)
  const needsReturn = allHolds
    .filter((hold) => hold.status === 'damaged' && (hold.damage_reason || 'arrival') === 'arrival' && hold.return_decision !== 'write_off')
    .reduce((sum, hold) => sum + Number(hold.quantity || 0), 0)

  return (
    <div className="flex flex-col gap-4 p-4">
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
      </div>

      {(needsExcess > 0 || needsReturn > 0) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {needsExcess > 0 && (
            <span>
              {formatQty(needsExcess)} unit(s) not on the order.{' '}
              <span className="font-medium">Decide below, or in </span>
              <Link href={`${receiptsPath}/excess`} className="font-medium underline">
                Excess
              </Link>
            </span>
          )}
          {needsReturn > 0 && (
            <span>
              {formatQty(needsReturn)} unit(s) damaged on arrival.{' '}
              <Link href={`${returnsPath}/to-return`} className="font-medium underline">
                Decide in To return
              </Link>
            </span>
          )}
        </div>
      )}

      {pendingExtra.length > 0 && (
        <div className="rounded-lg border border-amber-200">
          <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Not on the order. Add to the order, or send back.
          </p>
          <table className="w-full min-w-[640px] text-xs">
            <tbody className="divide-y divide-gray-100">
              {pendingExtra.map((hold) => {
                const free = freeOf(hold)
                const kind = HOLD_KIND[hold.hold_type] || { label: hold.hold_type, tone: 'gray' }
                return (
                  <tr key={hold.id} className="align-middle">
                    <td className="px-3 py-2 text-[11px] text-gray-800">
                      {labelOf(hold.variant)}
                      {hold.note && <span className="block text-[10px] text-gray-500">{hold.note}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Tone tone={kind.tone}>{kind.label}</Tone>
                    </td>
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
              {target ? `${formatQty(qtyFor(target))} × ${labelOf(target.variant)}. ` : ''}
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