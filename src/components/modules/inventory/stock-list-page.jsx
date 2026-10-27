'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import {
  PageControls,
  StockStateBadge,
  formatQty,
  useInventoryPaths,
  useStockNames,
} from '@/components/modules/inventory/inventory-shared'

// One list for four Stock tabs: All, Low, Out and Reserved. Each tab's
// page.js passes `view`.
//
// One row per variant for the branch, added up across its warehouses. Where
// the stock sits (and each warehouse's reorder level) is on the product's
// detail page, one click away.

const PAGE_SIZE = 50

const COPY = {
  all: {
    title: 'All Stock',
    empty: 'No stock yet. A product appears here once this branch receives it or sets a reorder level for it.',
  },
  low: {
    title: 'Low Stock',
    empty: 'Nothing is at or below its reorder level.',
  },
  out: {
    title: 'Out of Stock',
    empty: 'Nothing is out of stock.',
  },
  reserved: {
    title: 'Reserved Stock',
    empty: 'No stock is reserved right now.',
  },
}

export default function StockListPage({ view = 'all' }) {
  const router = useRouter()
  const { branchId, stock: stockBase } = useInventoryPaths()
  const copy = COPY[view] || COPY.all

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      let query = supabase
        .from('inventory_branch_stock_view')
        .select('*')
        .eq('branch', branchId)
        .limit(5000)

      if (view === 'low') query = query.eq('stock_state', 'low')
      if (view === 'out') query = query.eq('stock_state', 'out')
      if (view === 'reserved') query = query.gt('quantity_reserved', 0)

      const { data, error } = await query
      if (cancelled) return

      if (error) {
        console.error('Failed to load stock:', error)
        setErrorMessage(error.message || 'Could not load stock.')
        setRows([])
      } else {
        setRows(data || [])
      }
      setLoading(false)
    }

    if (branchId) load()
    return () => {
      cancelled = true
    }
  }, [branchId, view])

  const { variants, warehouses } = useStockNames(
    rows.map((row) => row.variant),
    rows.flatMap((row) => row.warehouse_ids || [])
  )

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows
      .filter((row) => {
        if (!needle) return true
        const item = variants[row.variant]
        return `${item?.title || ''} ${item?.label || ''} ${item?.sku || ''}`.toLowerCase().includes(needle)
      })
      .sort((a, b) =>
        (variants[a.variant]?.title || '').localeCompare(variants[b.variant]?.title || '')
      )
  }, [rows, search, variants])

  useEffect(() => {
    setPage(0)
  }, [search, view])

  const paged = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const showSuggested = view === 'low' || view === 'out'

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm tracking-tight font-semibold text-foreground">{copy.title}</h2>
          <p className="mt-1 text-muted-foreground">
            {loading ? 'Loading...' : `${visible.length.toLocaleString()} stock record${visible.length === 1 ? '' : 's'}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, variant or SKU"
            className="h-8 w-60 text-xs"
          />
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="text-xs font-medium text-gray-600">
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">SKU / Variant</th>
              <th className="px-4 py-3 text-left">Where</th>
              <th className="px-4 py-3 text-right">On hand</th>
              <th className="px-4 py-3 text-right">Reserved</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3 text-right" title="Received goods still waiting for inventory to check them. Not sellable.">
                In quarantine
              </th>
              {showSuggested && <th className="px-4 py-3 text-right">Suggested order</th>}
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan={showSuggested ? 9 : 8} className="px-4 py-10 text-center text-muted-foreground">
                  {search ? 'No stock matches your search.' : copy.empty}
                </td>
              </tr>
            )}
            {paged.map((row) => {
              const item = variants[row.variant]
              return (
                <tr
                  key={row.variant}
                  onClick={() => router.push(`${stockBase}/${row.variant}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm text-foreground">{item?.title || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-[11px] text-gray-800">{item?.sku || 'No SKU'}</p>
                    {item?.label && <p className="text-[11px] text-muted-foreground">{item.label}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {Number(row.warehouse_count) > 1
                      ? `${row.warehouse_count} warehouses`
                      : warehouses[(row.warehouse_ids || [])[0]] || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{formatQty(row.quantity_on_hand)}</td>
                  <td className="px-4 py-3 text-right">{formatQty(row.quantity_reserved)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatQty(row.quantity_available)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {Number(row.quantity_quarantine) > 0 ? formatQty(row.quantity_quarantine) : '—'}
                  </td>
                  {showSuggested && (
                    <td className="px-4 py-3 text-right">
                      {row.suggested_order_quantity != null ? formatQty(row.suggested_order_quantity) : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <StockStateBadge state={row.stock_state} />
                    {row.stock_state === 'low' && Number(row.warehouse_count) > 1 && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Low in {row.low_warehouses} of {row.warehouse_count} warehouses
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <PageControls page={page} pageSize={PAGE_SIZE} total={visible.length} onPage={setPage} />

      {view === 'reserved' && (
        <p className="text-[11px] text-muted-foreground">
          Reserved quantities are held back from available stock. Reservations are created by sales orders and
          transfers, which are not built yet, so this list stays empty until then.
        </p>
      )}
    </div>
  )
}
