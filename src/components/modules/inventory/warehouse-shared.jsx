'use client'

import { useCallback, useEffect, useState } from 'react'

import supabase from '@/config/supabaseClient'
import { Tone } from '@/components/modules/inventory/receipt-shared'

// Shared by the Warehouses pages (list, new, and a warehouse's own pages).
// Needs inventory-shared.jsx and receipt-shared.jsx (useInventoryCan, Tone,
// EmptyState, ErrorNote) and warehouses-and-shelves-migration.sql.

// Calls a warehouse function that answers { success, error?, ... }.
export async function runWarehouseRpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) return { success: false, error: error.message }
  if (data && data.success === false) return { success: false, error: data.error || 'That did not work.' }
  return { success: true, data }
}

export function WarehouseStatus({ warehouse }) {
  if (warehouse?.archived_at) return <Tone tone="gray">Archived</Tone>
  return <Tone tone="green">Active</Tone>
}

export function DefaultBadge() {
  return <Tone tone="blue">Default</Tone>
}

// One warehouse row with its counts, read through list_branch_warehouses so
// the counts always match the list page.
export function useWarehouse(branchId, warehouseId) {
  const [warehouse, setWarehouse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const reload = useCallback(async () => {
    if (!branchId || !warehouseId) return
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase.rpc('list_branch_warehouses', { p_branch: branchId })
    if (error) {
      setLoadError(error.message)
      setWarehouse(null)
    } else {
      const found = (data || []).find((row) => row.id === warehouseId) || null
      setWarehouse(found)
      if (!found) setLoadError('This warehouse was not found for this branch.')
    }
    setLoading(false)
  }, [branchId, warehouseId])

  useEffect(() => {
    reload()
  }, [reload])

  return { warehouse, loading, loadError, reload }
}

// What a warehouse holds, from the movement ledger (shelf is null for stock
// with no shelf).
export function useWarehouseStock(warehouseId) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const reload = useCallback(async () => {
    if (!warehouseId) return
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase.rpc('get_warehouse_shelf_stock', { p_warehouse: warehouseId })
    if (error) {
      setLoadError(error.message)
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }, [warehouseId])

  useEffect(() => {
    reload()
  }, [reload])

  return { rows, loading, loadError, reload }
}
