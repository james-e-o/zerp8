'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import { PageControls, formatQty } from '@/components/modules/inventory/inventory-shared'
import { EmptyState, ErrorNote, Tone } from '@/components/modules/inventory/receipt-shared'
import { formatDateTime } from '@/components/modules/inventory/adjustment-shared'
import { DIRECTION, STATUS, useTransferPaths } from '@/components/modules/inventory/transfer-shared'

// Shared by the All, Drafts, Awaiting approval, In transit, Incoming and
// Received tabs of Inventory > Transfers. Each tab's page.js passes `view`.
// A draft opens in the editor (new?draft=...); a submitted transfer opens its
// own page.

const PAGE_SIZE = 50

const COPY = {
  all: { hint: 'Drafts and every transfer sent from this branch, plus transfers on their way to it.', empty: 'No transfers yet.' },
  drafts: { hint: 'Started here and not yet submitted. Nothing has moved.', empty: 'No drafts.' },
  pending: { hint: 'Submitted and waiting for approval, or approved and waiting to be sent.', empty: 'Nothing is waiting for approval.' },
  in_transit: { hint: 'Sent from this branch and not yet accepted by the receiving warehouse.', empty: 'Nothing of yours is in transit.' },
  incoming: { hint: 'On its way to a warehouse of this branch. Open the warehouse, or the transfer, to confirm what arrived.', empty: 'Nothing is on its way here.' },
  received: { hint: 'Finished. Each one is in Movements on both sides.', empty: 'No transfer has been received yet.' },
}

export default function TransfersListPage({ view = 'all' }) {
  const router = useRouter()
  const { branchId, transfers } = useTransferPaths()

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
    const { data, error } = await supabase.rpc('list_inventory_transfers', {
      p_branch: branchId,
      p_view: view,
      p_search: debounced || null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    })
    if (error) {
      setLoadError(error.message)
      toast.error(error.message)
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

  function open(row) {
    router.push(row.kind === 'draft' ? `${transfers}/new?draft=${row.id}` : `${transfers}/${row.id}`)
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{COPY[view]?.hint}</p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by number"
          className="h-7 w-64 text-xs"
        />
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-xs text-gray-500">Loading transfers...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : rows.length === 0 ? (
        <EmptyState>{debounced ? 'No transfer matches that search.' : COPY[view]?.empty}</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Number</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">From</th>
                  <th className="px-3 py-2 text-left">To</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Lines</th>
                  <th className="px-3 py-2 text-right">Units</th>
                  <th className="px-3 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const status = STATUS[row.display_status] || STATUS.draft
                  const direction = DIRECTION[row.direction] || DIRECTION.internal
                  return (
                    <tr key={`${row.kind}-${row.id}`} onClick={() => open(row)} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-[11px] text-gray-800">{row.transfer_number || 'Draft'}</td>
                      <td className="px-3 py-2">
                        <Tone tone={direction.tone}>{direction.label}</Tone>
                      </td>
                      <td className="px-3 py-2">
                        {row.from_warehouse_name || '—'}
                        {row.direction === 'in' && row.other_branch_name ? (
                          <span className="block text-[10px] text-gray-500">{row.other_branch_name}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {row.to_warehouse_name || '—'}
                        {row.direction === 'out' && row.other_branch_name ? (
                          <span className="block text-[10px] text-gray-500">{row.other_branch_name}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <Tone tone={status.tone}>{status.label}</Tone>
                      </td>
                      <td className="px-3 py-2 text-right">{Number(row.line_count)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(row.total_quantity)}</td>
                      <td className="px-3 py-2 text-gray-600">{formatDateTime(row.sent_at || row.created_at)}</td>
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
