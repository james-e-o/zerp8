'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import { PageControls, formatDate, formatQty } from '@/components/modules/inventory/inventory-shared'
import {
  EmptyState,
  ErrorNote,
  Tone,
  receiptState,
  sourceLabel,
  useFlowPaths,
} from '@/components/modules/inventory/receipt-shared'

// Shared by the All, Drafts and Done tabs of Inventory > Receipts.
//   view="all"    every receipt
//   view="draft"  counts that were saved but not posted
//   view="done"   posted receipts with nothing left in quarantine
//
// Rows come from purchase_receipts (its `source` column is read when the
// receipts-to-inventory migration has added it; until then every receipt is
// shown as a purchase-order receipt).

const PAGE_SIZE = 25

const COPY = {
  all: { empty: 'No receipts yet.', hint: 'Every receipt this branch has counted in.' },
  draft: { empty: 'No drafts. A receipt you save before posting waits here.', hint: 'Counts saved but not posted.' },
  done: { empty: 'Nothing is completed yet.', hint: 'Posted receipts with nothing left in quarantine.' },
}

export default function ReceiptsListPage({ view = 'all' }) {
  const { branchId, receipts: receiptsPath } = useFlowPaths()

  const [rows, setRows] = useState([])
  const [holdsByReceipt, setHoldsByReceipt] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setLoadError('')

    let result = await supabase
      .from('purchase_receipts')
      .select(
        `*,
         order_ref:purchase_orders!purchase_order ( order_number, supplier:suppliers ( name ) ),
         lines:purchase_receipt_line_items ( id, quantity )`
      )
      .eq('branch', branchId)
      .order('created_at', { ascending: false })
      .limit(300)

    // Receipts without an order (gifts, opening stock) need the plain read if
    // the joined one is refused for any reason.
    if (result.error) {
      result = await supabase
        .from('purchase_receipts')
        .select('*, lines:purchase_receipt_line_items ( id, quantity )')
        .eq('branch', branchId)
        .order('created_at', { ascending: false })
        .limit(300)
    }

    if (result.error) {
      setLoadError(result.error.message || 'Could not load receipts.')
      setRows([])
      setLoading(false)
      return
    }

    // Quarantine piles that still need a decision, grouped by receipt.
    const { data: holdRows, error: holdError } = await supabase
      .from('purchase_receipt_holds')
      .select(
        'id, kind, status, quantity, receipt_line:purchase_receipt_line_items ( purchase_receipt )'
      )
      .eq('branch', branchId)
      .in('status', ['awaiting_review', 'damaged'])

    if (holdError) console.error('Could not read quarantine status:', holdError)

    const grouped = {}
    for (const hold of holdRows || []) {
      const receiptId = hold.receipt_line?.purchase_receipt
      if (!receiptId) continue
      ;(grouped[receiptId] ||= []).push(hold)
    }

    setHoldsByReceipt(grouped)
    setRows(result.data || [])
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(0)
  }, [view, search])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      const open = holdsByReceipt[row.id] || []
      if (view === 'draft' && row.status !== 'draft') return false
      if (view === 'done' && !(row.status === 'posted' && open.length === 0)) return false
      if (!needle) return true
      const haystack = [
        row.receipt_number,
        row.delivery_note,
        row.order_ref?.order_number,
        row.order_ref?.supplier?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [rows, holdsByReceipt, view, search])

  const pageRows = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{COPY[view]?.hint}</p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search receipt, order, supplier or delivery note"
          className="h-7 w-72 text-xs"
        />
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading receipts...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : visible.length === 0 ? (
        <EmptyState>{search ? 'No receipt matches that search.' : COPY[view]?.empty}</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Receipt</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Supplier</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Units</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map((row) => {
                  const state = receiptState(row, holdsByReceipt[row.id] || [])
                  const units = (row.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0)
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <Link
                          href={`${receiptsPath}/${row.id}`}
                          className="font-medium text-core hover:underline"
                        >
                          {row.receipt_number}
                        </Link>
                        {row.delivery_note && (
                          <span className="block text-[10px] text-gray-500">Note {row.delivery_note}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{sourceLabel(row)}</td>
                      <td className="px-3 py-2 text-gray-700">{row.order_ref?.order_number || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{row.order_ref?.supplier?.name || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{formatDate(row.received_at || row.created_at)}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{formatQty(units)}</td>
                      <td className="px-3 py-2">
                        <Tone tone={state.tone}>{state.label}</Tone>
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
