'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import {
  PageControls,
  formatMoney,
  formatQty,
  useBranchCurrency,
  useInventoryPaths,
  useStockNames,
} from '@/components/modules/inventory/inventory-shared'

// What the stock on hand is worth, per product and warehouse. Quantity here
// is everything owned, including goods still in quarantine.

const PAGE_SIZE = 50
const METHOD_LABELS = { weighted_average: 'Weighted average', fifo: 'First in, first out (FIFO)' }

export default function StockValuationPage() {
  const router = useRouter()
  const currency = useBranchCurrency()
  const { branchId, stock: stockBase } = useInventoryPaths()

  const [rows, setRows] = useState([])
  const [method, setMethod] = useState(null)
  const [locked, setLocked] = useState(false)
  const [provisional, setProvisional] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      const [{ data, error }, { data: settings }, { count }] = await Promise.all([
        supabase.from('inventory_valuation').select('*').eq('branch', branchId).limit(5000),
        supabase.rpc('get_effective_inventory_settings', { p_branch: branchId }),
        supabase
          .from('inventory_cost_layers')
          .select('id', { count: 'exact', head: true })
          .eq('branch', branchId)
          .eq('is_provisional', true)
          .gt('remaining_quantity', 0),
      ])
      if (cancelled) return

      const settingsRow = Array.isArray(settings) ? settings[0] : settings
      setMethod(settingsRow?.costing_method || null)
      setLocked(settingsRow?.costing_locked === true)
      setProvisional(count || 0)

      if (error) {
        console.error('Failed to load valuation:', error)
        setErrorMessage(error.message || 'Could not load the valuation.')
        setRows([])
      } else {
        // One line per variant, added up across the branch's warehouses.
        const byVariant = new Map()
        for (const row of data || []) {
          if (!(Number(row.quantity) > 0 || Number(row.total_value) > 0)) continue
          const entry = byVariant.get(row.variant) || {
            variant: row.variant,
            quantity: 0,
            total_value: 0,
            warehouse_ids: [],
          }
          entry.quantity += Number(row.quantity || 0)
          entry.total_value += Number(row.total_value || 0)
          entry.warehouse_ids.push(row.warehouse)
          byVariant.set(row.variant, entry)
        }
        setRows(
          [...byVariant.values()].map((entry) => ({
            ...entry,
            average_cost: entry.quantity > 0 ? entry.total_value / entry.quantity : 0,
          }))
        )
      }
      setLoading(false)
    }

    if (branchId) load()
    return () => {
      cancelled = true
    }
  }, [branchId])

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
      .sort((a, b) => Number(b.total_value) - Number(a.total_value))
  }, [rows, search, variants])

  useEffect(() => {
    setPage(0)
  }, [search])

  const totalValue = visible.reduce((sum, row) => sum + Number(row.total_value || 0), 0)
  const paged = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-3 p-4 text-xs">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Valuation</h2>
          <p className="mt-1 text-muted-foreground">
            {loading ? 'Loading...' : `${visible.length.toLocaleString()} product${visible.length === 1 ? '' : 's'} valued. Largest value first.`}
          </p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search product, variant or SKU"
          className="h-8 w-60 text-xs"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-muted-foreground">Total stock value</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatMoney(totalValue, currency)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-muted-foreground">Costing method</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{METHOD_LABELS[method] || '—'}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {locked ? 'Locked, because stock has already moved.' : 'Can still be changed in Settings.'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-muted-foreground">Valued at estimate</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {provisional.toLocaleString()} opening layer{provisional === 1 ? '' : 's'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Stock that existed before costing started is valued at your cost estimate until it is used up.
          </p>
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
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Average cost</th>
              <th className="px-4 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {rows.length === 0
                    ? 'Nothing to value yet, or you do not have access to cost figures (they need inventory edit or purchases view).'
                    : 'No stock matches your search.'}
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
                  <td className="px-4 py-3 text-sm text-foreground">{item?.title || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-[11px] text-gray-800">{item?.sku || 'No SKU'}</p>
                    {item?.label && <p className="text-[11px] text-muted-foreground">{item.label}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {row.warehouse_ids.length > 1
                      ? `${row.warehouse_ids.length} warehouses`
                      : warehouses[row.warehouse_ids[0]] || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{formatQty(row.quantity)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(row.average_cost, currency)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(row.total_value, currency)}</td>
                </tr>
              )
            })}
          </tbody>
          {visible.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50 text-sm font-semibold">
                <td className="px-4 py-3" colSpan={5}>
                  Total
                </td>
                <td className="px-4 py-3 text-right">{formatMoney(totalValue, currency)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <PageControls page={page} pageSize={PAGE_SIZE} total={visible.length} onPage={setPage} />
    </div>
  )
}
