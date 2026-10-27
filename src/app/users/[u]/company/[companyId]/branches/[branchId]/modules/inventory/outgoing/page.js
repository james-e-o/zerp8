'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

import supabase from '@/config/supabaseClient'
import { formatDate, formatQty, useStockNames } from '@/components/modules/inventory/inventory-shared'
import { EmptyState, ErrorNote } from '@/components/modules/inventory/receipt-shared'

// Outgoing > Pending: stock that is reserved for customers and has not gone
// out yet. Sales and POS create the reservation; inventory picks it.
//
// Rows come from inventory_reservations with reason 'sales_order', grouped by
// the document that holds them. The reservation table only knows the
// document's id, so the document is shown by a short reference until Sales
// exposes its numbers.

export default function PendingOutgoingPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const { branchId: branch } = useParams()

  const { variants, warehouses } = useStockNames(
    rows.map((row) => row.variant),
    rows.map((row) => row.warehouse)
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!branch) return
      setLoading(true)
      setLoadError('')
      const { data, error } = await supabase
        .from('inventory_reservations')
        .select('id, variant, warehouse, quantity, reference_id, created_at')
        .eq('branch', branch)
        .eq('reason', 'sales_order')
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (error) {
        setLoadError(error.message || 'Could not load reserved stock.')
        setRows([])
      } else {
        setRows(data || [])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [branch])

  const documents = useMemo(() => {
    const grouped = new Map()
    for (const row of rows) {
      const entry = grouped.get(row.reference_id) || { id: row.reference_id, lines: [], units: 0, since: row.created_at }
      entry.lines.push(row)
      entry.units += Number(row.quantity || 0)
      grouped.set(row.reference_id, entry)
    }
    return [...grouped.values()]
  }, [rows])

  const nameOf = (id) => {
    const info = variants[id]
    if (!info) return 'Item'
    return info.label ? `${info.title} · ${info.label}` : info.title
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-xs text-gray-500">
        Stock reserved for customer orders that has not gone out yet. Picking starts from here.
      </p>

      {loading ? (
        <p className="text-xs text-gray-500">Loading reserved stock...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : documents.length === 0 ? (
        <EmptyState>Nothing is waiting to go out.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-left">Items</th>
                <th className="px-3 py-2 text-right">Units reserved</th>
                <th className="px-3 py-2 text-left">Reserved since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((document) => (
                <tr key={document.id} className="align-top">
                  <td className="px-3 py-2 font-medium text-gray-800">{String(document.id).slice(0, 8)}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {document.lines.map((line) => (
                      <p key={line.id} className="text-[11px] leading-tight">
                        {formatQty(line.quantity)} × {nameOf(line.variant)}
                        <span className="text-[10px] text-gray-500"> · {warehouses[line.warehouse] || 'Warehouse'}</span>
                      </p>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatQty(document.units)}</td>
                  <td className="px-3 py-2 text-gray-700">{formatDate(document.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
