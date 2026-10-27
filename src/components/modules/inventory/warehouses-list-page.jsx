'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import { formatQty, useInventoryPaths } from '@/components/modules/inventory/inventory-shared'
import { EmptyState, ErrorNote } from '@/components/modules/inventory/receipt-shared'
import { DefaultBadge, WarehouseStatus } from '@/components/modules/inventory/warehouse-shared'

// Shared by the All, Active and Archived tabs of Inventory > Warehouses.
//   view="all"       every warehouse of the branch
//   view="active"    warehouses in use
//   view="archived"  warehouses that were retired (kept for history)

const COPY = {
  all: { empty: 'No warehouses yet. Add one to start receiving stock.', hint: 'Every warehouse of this branch.' },
  active: { empty: 'No active warehouses.', hint: 'Warehouses that can receive and hold stock.' },
  archived: { empty: 'Nothing is archived.', hint: 'Retired warehouses stay here so past stock records still make sense.' },
}

export default function WarehousesListPage({ view = 'all' }) {
  const { branchId, warehouses: warehousesPath } = useInventoryPaths()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase.rpc('list_branch_warehouses', { p_branch: branchId })
    if (error) {
      setLoadError(error.message)
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (view === 'active' && row.archived_at) return false
      if (view === 'archived' && !row.archived_at) return false
      if (!needle) return true
      return `${row.name} ${row.code}`.toLowerCase().includes(needle)
    })
  }, [rows, view, search])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{COPY[view]?.hint}</p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or code"
          className="h-7 w-64 text-xs"
        />
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading warehouses...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : visible.length === 0 ? (
        <EmptyState>{search ? 'No warehouse matches that search.' : COPY[view]?.empty}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Warehouse</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-right">Shelves</th>
                <th className="px-3 py-2 text-right">Stocked variants</th>
                <th className="px-3 py-2 text-right">Units on hand</th>
                <th className="px-3 py-2 text-right">In quarantine</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link href={`${warehousesPath}/${row.id}`} className="font-medium text-core hover:underline">
                      {row.name}
                    </Link>
                    {row.is_default && (
                      <span className="ml-2 align-middle">
                        <DefaultBadge />
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-700">{row.code}</td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatQty(row.shelf_count)}</td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatQty(row.stocked_variants)}</td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatQty(row.units_on_hand)}</td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatQty(row.units_in_quarantine)}</td>
                  <td className="px-3 py-2">
                    <WarehouseStatus warehouse={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
