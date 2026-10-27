'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import { PageControls, formatDate, formatQty } from '@/components/modules/inventory/inventory-shared'
import { EmptyState, ErrorNote, Tone, useFlowPaths } from '@/components/modules/inventory/receipt-shared'

// Receipts > Expected: purchase orders that still have goods to come. This is
// the landing tab, the equivalent of Odoo's "expected receipts" and Dynamics'
// open purchase lines. "Receive" opens a new receipt with the order picked.
//
// Outstanding = ordered - delivered. Delivered counts goods already counted
// in (including goods still in quarantine), so nothing is expected twice.

const PAGE_SIZE = 25
const RECEIVABLE = ['open', 'sent', 'partially_received']

const STATUS = {
  open: { label: 'Open', tone: 'gray' },
  sent: { label: 'Sent', tone: 'blue' },
  partially_received: { label: 'Partly received', tone: 'amber' },
}

export default function ExpectedReceiptsPage() {
  const { branchId, receipts: receiptsPath, orders: ordersPath } = useFlowPaths()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!branchId) return
      setLoading(true)
      setLoadError('')

      const { data, error } = await supabase
        .from('purchase_orders')
        .select(
          `id, order_number, status, expected_delivery_date,
           supplier:suppliers ( name ),
           lines:purchase_order_line_items ( id, quantity_ordered, quantity_received, quantity_delivered )`
        )
        .eq('branch', branchId)
        .in('status', RECEIVABLE)
        .order('expected_delivery_date', { ascending: true, nullsFirst: false })

      if (cancelled) return
      if (error) {
        setLoadError(error.message || 'Could not load expected receipts.')
        setOrders([])
      } else {
        setOrders(data || [])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  const rows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return (orders || [])
      .map((order) => {
        let outstanding = 0
        let openLines = 0
        for (const line of order.lines || []) {
          const delivered = Number(line.quantity_delivered ?? line.quantity_received ?? 0)
          const left = Math.max(Number(line.quantity_ordered || 0) - delivered, 0)
          if (left > 0) openLines += 1
          outstanding += left
        }
        const late = !!order.expected_delivery_date && order.expected_delivery_date < today
        return { ...order, outstanding, openLines, late }
      })
      .filter((order) => order.outstanding > 0)
  }, [orders])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [row.order_number, row.supplier?.name].filter(Boolean).join(' ').toLowerCase().includes(needle)
    )
  }, [rows, search])

  useEffect(() => {
    setPage(0)
  }, [search])

  const pageRows = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          Purchase orders with goods still to arrive. Start a receipt from here, or use New receipt for
          anything without an order.
        </p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search order or supplier"
          className="h-7 w-64 text-xs"
        />
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading expected receipts...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : visible.length === 0 ? (
        <EmptyState>{search ? 'No order matches that search.' : 'No goods are expected right now.'}</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-180 text-xs">
              <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Supplier</th>
                  <th className="px-3 py-2 text-left">Expected</th>
                  <th className="px-3 py-2 text-right">Lines open</th>
                  <th className="px-3 py-2 text-right">Units outstanding</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map((row) => {
                  const status = STATUS[row.status] || { label: row.status, tone: 'gray' }
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <Link href={`${ordersPath}/${row.id}`} className="font-medium text-core hover:underline">
                          {row.order_number}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{row.supplier?.name || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {row.expected_delivery_date ? formatDate(row.expected_delivery_date) : '—'}
                        {row.late && <span className="ml-1.5 text-[10px] font-medium text-red-600">Late</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900">{row.openLines}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{formatQty(row.outstanding)}</td>
                      <td className="px-3 py-2">
                        <Tone tone={status.tone}>{status.label}</Tone>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`${receiptsPath}/new?order=${row.id}`}
                          className="rounded-md border border-core px-2.5 py-1 text-[11px] font-medium text-core hover:bg-core hover:text-white"
                        >
                          Receive
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <PageControls page={page} pageSize={PAGE_SIZE} total={visible.length} onPage={setPage} />
        </>
      )}
    </div>
  )
}