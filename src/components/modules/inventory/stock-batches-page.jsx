'use client'

import { useEffect, useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import {
  PageControls,
  Pill,
  formatDate,
  formatQty,
  useInventoryPaths,
  useStockNames,
} from '@/components/modules/inventory/inventory-shared'

// Stock by batch: where each lot is, how much is left, and when it expires.
// Sorted with the earliest expiry first (the order to sell or use them in).

const PAGE_SIZE = 50

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'soon', label: 'Expiring soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'blocked', label: 'Blocked' },
]

function batchState(row, alertDays) {
  if (row.is_blocked) return { key: 'blocked', label: 'Blocked', style: 'border-red-200 bg-red-50 text-red-700' }
  if (row.is_expired) return { key: 'expired', label: 'Expired', style: 'border-red-200 bg-red-50 text-red-700' }
  if (row.days_to_expiry != null && row.days_to_expiry <= alertDays) {
    return {
      key: 'soon',
      label: `Expires in ${row.days_to_expiry} day${row.days_to_expiry === 1 ? '' : 's'}`,
      style: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }
  return { key: 'ok', label: 'OK', style: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
}

export default function StockBatchesPage() {
  const { branchId } = useInventoryPaths()

  const [rows, setRows] = useState([])
  const [suppliers, setSuppliers] = useState({})
  const [alertDays, setAlertDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showEmpty, setShowEmpty] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      const [{ data, error }, { data: settings }] = await Promise.all([
        supabase.from('inventory_batch_stock_view').select('*').eq('branch', branchId).limit(5000),
        supabase.rpc('get_effective_inventory_settings', { p_branch: branchId }),
      ])
      if (cancelled) return

      const settingsRow = Array.isArray(settings) ? settings[0] : settings
      if (settingsRow?.expiry_alert_days != null) setAlertDays(Number(settingsRow.expiry_alert_days))

      if (error) {
        console.error('Failed to load batches:', error)
        setErrorMessage(error.message || 'Could not load batches.')
        setRows([])
        setLoading(false)
        return
      }

      const supplierIds = [...new Set((data || []).map((row) => row.supplier).filter(Boolean))]
      if (supplierIds.length > 0) {
        const { data: supplierRows } = await supabase.from('suppliers').select('id, name').in('id', supplierIds)
        if (!cancelled) setSuppliers(Object.fromEntries((supplierRows || []).map((row) => [row.id, row.name])))
      }

      setRows(data || [])
      setLoading(false)
    }

    if (branchId) load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  const { variants, warehouses } = useStockNames(
    rows.map((row) => row.variant),
    rows.map((row) => row.warehouse)
  )

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows
      .filter((row) => showEmpty || Number(row.quantity_on_hand) + Number(row.quantity_quarantine) > 0)
      .filter((row) => filter === 'all' || batchState(row, alertDays).key === filter)
      .filter((row) => {
        if (!needle) return true
        const item = variants[row.variant]
        return `${item?.title || ''} ${item?.sku || ''} ${row.batch_number || ''} ${row.supplier_batch_reference || ''}`
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => {
        if (!a.expiry_date && !b.expiry_date) return (a.batch_number || '').localeCompare(b.batch_number || '')
        if (!a.expiry_date) return 1
        if (!b.expiry_date) return -1
        return a.expiry_date.localeCompare(b.expiry_date)
      })
  }, [rows, search, filter, showEmpty, alertDays, variants])

  useEffect(() => {
    setPage(0)
  }, [search, filter, showEmpty])

  const paged = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-3 p-4 text-xs">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Batches</h2>
          <p className="mt-1 text-muted-foreground">
            {loading ? 'Loading...' : `${visible.length.toLocaleString()} batch${visible.length === 1 ? '' : 'es'}. Earliest expiry first.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, batch or lot"
            className="h-8 w-60 text-xs"
          />
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={showEmpty} onChange={(event) => setShowEmpty(event.target.checked)} />
            Show empty batches
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setFilter(entry.value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === entry.value ? 'border-core bg-core text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {entry.label}
          </button>
        ))}
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
              <th className="px-4 py-3 text-left">Batch</th>
              <th className="px-4 py-3 text-left">Supplier lot</th>
              <th className="px-4 py-3 text-left">Warehouse</th>
              <th className="px-4 py-3 text-right">On hand</th>
              <th className="px-4 py-3 text-right">In quarantine</th>
              <th className="px-4 py-3 text-left">Expiry</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  {rows.length === 0
                    ? 'No batches yet. Batches are created when you receive a product that is tracked by batch.'
                    : 'No batches match.'}
                </td>
              </tr>
            )}
            {paged.map((row) => {
              const item = variants[row.variant]
              const state = batchState(row, alertDays)
              return (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="text-sm text-foreground">{item?.title || '—'}</p>
                    {item?.label && <p className="text-[11px] text-muted-foreground">{item.label}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px]">{row.batch_number}</td>
                  <td className="px-4 py-3">
                    {row.supplier_batch_reference || <span className="text-muted-foreground">—</span>}
                    {row.supplier && suppliers[row.supplier] && (
                      <p className="text-[11px] text-muted-foreground">{suppliers[row.supplier]}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{warehouses[row.warehouse] || '—'}</td>
                  <td className="px-4 py-3 text-right">{formatQty(row.quantity_on_hand)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {Number(row.quantity_quarantine) > 0 ? formatQty(row.quantity_quarantine) : '—'}
                  </td>
                  <td className="px-4 py-3">{formatDate(row.expiry_date)}</td>
                  <td className="px-4 py-3">
                    <Pill className={state.style}>{state.label}</Pill>
                    {row.is_blocked && row.blocked_reason && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{row.blocked_reason}</p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <PageControls page={page} pageSize={PAGE_SIZE} total={visible.length} onPage={setPage} />
    </div>
  )
}
