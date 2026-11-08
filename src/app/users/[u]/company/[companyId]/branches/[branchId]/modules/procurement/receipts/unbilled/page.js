'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import {
  PageControls,
  formatMoney,
  formatQty,
  useBranchCurrency,
  useStockNames,
} from '@/components/modules/inventory/inventory-shared'
import { EmptyState, ErrorNote, useFlowPaths } from '@/components/modules/inventory/receipt-shared'

// Purchases > Receipts > Unbilled: goods inventory has counted in that the
// supplier has not billed yet ("received, not invoiced"). This is purchases'
// own list: each line clears when its bill is posted. Until then the cost is
// the order price; the bill sets the final cost.

const PAGE_SIZE = 25

export default function PurchasesUnbilledPage() {
  const { branchId, orders: ordersPath, bills: billsPath } = useFlowPaths()
  const currency = useBranchCurrency()

  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const { variants } = useStockNames(lines.map((line) => line.variant))
  const nameOf = (id) => {
    const info = variants[id]
    if (!info) return 'Item'
    return info.label ? `${info.title} · ${info.label}` : info.title
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!branchId) return
      setLoading(true)
      setLoadError('')

      const { data, error } = await supabase
        .from('purchase_order_line_items')
        .select(
          `id, variant, quantity_ordered, quantity_received, quantity_delivered, quantity_billed, unit_cost_snapshot,
           order:purchase_orders!inner ( id, order_number, branch, status, supplier:suppliers ( name ) )`
        )
        .eq('order.branch', branchId)
        .neq('order.status', 'cancelled')

      if (cancelled) return
      if (error) {
        setLoadError(error.message || 'Could not load unbilled receipts.')
        setLines([])
      } else {
        setLines(data || [])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  const rows = useMemo(
    () =>
      (lines || [])
        .map((line) => {
          const counted = Number(line.quantity_delivered ?? line.quantity_received ?? 0)
          const billed = Number(line.quantity_billed || 0)
          const unbilled = Math.max(counted - billed, 0)
          const unit = line.unit_cost_snapshot == null ? null : Number(line.unit_cost_snapshot)
          return { ...line, counted, billed, unbilled, value: unit == null ? null : unbilled * unit }
        })
        .filter((line) => line.unbilled > 0),
    [lines]
  )

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [row.order?.order_number, row.order?.supplier?.name, nameOf(row.variant)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, variants])

  useEffect(() => {
    setPage(0)
  }, [search])

  const total = visible.reduce((sum, row) => sum + (row.value || 0), 0)
  const pageRows = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs text-gray-500">
          Goods inventory has counted in that the supplier has not billed yet. Post each supplier bill to clear a
          line; the bill sets the final cost.
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, supplier or item"
            className="h-7 w-64 text-xs"
          />
          <Link
            href={`${billsPath}/new`}
            className="h-7 whitespace-nowrap rounded-md bg-core px-3 py-1.5 text-xs font-medium text-white hover:bg-core/90"
          >
            New bill
          </Link>
        </div>
      </div>

      {!loading && !loadError && visible.length > 0 && (
        <p className="text-xs text-gray-700">
          Received, not invoiced: <span className="font-semibold">{formatMoney(total, currency)}</span> across{' '}
          {visible.length} line(s)
        </p>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading unbilled goods...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : visible.length === 0 ? (
        <EmptyState>{search ? 'Nothing matches that search.' : 'Everything received has been billed.'}</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Supplier</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Counted in</th>
                  <th className="px-3 py-2 text-right">Billed</th>
                  <th className="px-3 py-2 text-right">Unbilled</th>
                  <th className="px-3 py-2 text-right">Value at order price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={`${ordersPath}/${row.order?.id}`} className="font-medium text-core hover:underline">
                        {row.order?.order_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{row.order?.supplier?.name || '—'}</td>
                    <td className="max-w-[260px] px-3 py-2 text-[11px] text-gray-800">{nameOf(row.variant)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{formatQty(row.counted)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{formatQty(row.billed)}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">{formatQty(row.unbilled)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      {row.value == null ? '—' : formatMoney(row.value, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PageControls page={page} pageSize={PAGE_SIZE} total={visible.length} onPage={setPage} />
        </>
      )}
    </div>
  )
}
