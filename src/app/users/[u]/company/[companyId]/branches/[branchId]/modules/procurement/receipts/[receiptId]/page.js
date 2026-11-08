'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

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
  isExtraKind,
  receiptState,
  sourceLabel,
  useFlowPaths,
} from '@/components/modules/inventory/receipt-shared'

// Purchases > Receipts > [receipt]: one receipt as inventory counted it, and
// what has happened to each line since (accepted, in quarantine, damaged,
// returned). Read-only. Purchases acts on two things from here: excess goods
// (Receipts > Excess) and damaged goods (Returns > To return).

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
            .from('purchase_receipt_holds')
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

        if (cancelled) return
        setReceipt(head.data)
        setWarehouseName(warehouse)
        setLines(lineRows || [])
        setHoldsByLine(grouped)
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load receipt:', error)
        setErrorMessage(error.message || 'Could not load this receipt.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [receiptId, branchId])

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
    .filter((hold) => isExtraKind(hold.kind) && hold.status === 'awaiting_review')
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
              <Link href={`${receiptsPath}/excess`} className="font-medium underline">
                Decide in Excess
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
                const key = `${hold.kind}:${hold.status}`
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
