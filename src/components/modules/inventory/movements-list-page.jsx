'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import { PageControls, formatMoney, formatQty, useBranchCurrency } from '@/components/modules/inventory/inventory-shared'
import { EmptyState, ErrorNote, Tone, useFlowPaths } from '@/components/modules/inventory/receipt-shared'

// Shared by the All, Inbound, Outbound and Internal tabs of Inventory >
// Movements. Read-only: rows come from list_stock_movements, which reads the
// append-only stock ledger.
//   inbound   stock arrives (receipts, returns in, adjustments up)
//   outbound  stock leaves (deliveries, returns out, adjustments down)
//   internal  stock only changes state inside the branch (quarantine hold
//             and release)
// Unit cost and value are returned only to people with inventory edit access.

const PAGE_SIZE = 50

const COPY = {
  all: { empty: 'No stock has moved yet.', hint: 'Every movement of stock in this branch, newest first.' },
  inbound: { empty: 'Nothing has come in yet.', hint: 'Stock arriving in this branch.' },
  outbound: { empty: 'Nothing has gone out yet.', hint: 'Stock leaving this branch.' },
  internal: { empty: 'No internal movements yet.', hint: 'Stock changing state inside the branch, such as quarantine holds and releases.' },
}

const DIRECTION = {
  inbound: { label: 'Inbound', tone: 'green' },
  outbound: { label: 'Outbound', tone: 'red' },
  internal: { label: 'Internal', tone: 'blue' },
}

const STATUS = {
  available: { label: 'Available', tone: 'green' },
  quarantine: { label: 'Quarantine', tone: 'amber' },
  damaged: { label: 'Damaged', tone: 'red' },
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function MovementsListPage({ view = 'all' }) {
  const { branchId, receipts: receiptsPath, purchaseReturns } = useFlowPaths()
  const currency = useBranchCurrency()

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [view, debounced])

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase.rpc('list_stock_movements', {
      p_branch: branchId,
      p_direction: view,
      p_search: debounced || null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    })
    if (error) {
      setLoadError(error.message)
      setRows([])
      setTotal(0)
    } else {
      setRows(data || [])
      setTotal(Number(data?.[0]?.total_count || 0))
    }
    setLoading(false)
  }, [branchId, view, debounced, page])

  useEffect(() => {
    load()
  }, [load])

  const showCost = rows.some((row) => row.unit_cost !== null && row.unit_cost !== undefined)

  function documentHref(row) {
    if (!row.document_id) return null
    if (row.document_kind === 'receipt') return `${receiptsPath}/${row.document_id}`
    if (row.document_kind === 'return') return `${purchaseReturns}/${row.document_id}`
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{COPY[view]?.hint}</p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search document, product, SKU, warehouse or batch"
          className="h-7 w-80 text-xs"
        />
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-xs text-gray-500">Loading movements...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : rows.length === 0 ? (
        <EmptyState>{debounced ? 'No movement matches that search.' : COPY[view]?.empty}</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Quantity</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Warehouse</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  {showCost && <th className="px-3 py-2 text-right">Unit cost</th>}
                  {showCost && <th className="px-3 py-2 text-right">Value</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const href = documentHref(row)
                  const direction = DIRECTION[row.direction] || DIRECTION.internal
                  const status = STATUS[row.stock_status] || { label: row.stock_status || '—', tone: 'gray' }
                  const quantity = Number(row.quantity || 0)
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatDateTime(row.created_at)}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-gray-900">{row.product_title || 'Product'}</span>
                        {row.variant_label ? <span className="text-gray-600"> · {row.variant_label}</span> : null}
                        <span className="block text-[10px] text-gray-500">
                          {[row.sku, row.batch_number && `Batch ${row.batch_number}`].filter(Boolean).join(' · ')}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Tone tone={direction.tone}>{direction.label}</Tone>
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${quantity < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {quantity > 0 ? '+' : ''}
                        {formatQty(quantity)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {row.source}
                        {row.reference_number &&
                          (href ? (
                            <Link href={href} className="block font-mono text-[10px] text-core hover:underline">
                              {row.reference_number}
                            </Link>
                          ) : (
                            <span className="block font-mono text-[10px] text-gray-500">{row.reference_number}</span>
                          ))}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {row.warehouse_name || '—'}
                        {row.shelf_code ? <span className="block text-[10px] text-gray-500">Shelf {row.shelf_code}</span> : null}
                      </td>
                      <td className="px-3 py-2">
                        <Tone tone={status.tone}>{status.label}</Tone>
                      </td>
                      {showCost && (
                        <td className="px-3 py-2 text-right text-gray-700">
                          {row.unit_cost === null || row.unit_cost === undefined ? '—' : formatMoney(row.unit_cost, currency)}
                        </td>
                      )}
                      {showCost && (
                        <td className="px-3 py-2 text-right text-gray-900">
                          {row.total_cost === null || row.total_cost === undefined
                            ? '—'
                            : formatMoney(row.total_cost, currency)}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <PageControls page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </>
      )}
    </div>
  )
}
