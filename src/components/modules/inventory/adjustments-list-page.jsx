'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import { PageControls } from '@/components/modules/inventory/inventory-shared'
import { EmptyState, ErrorNote, Tone } from '@/components/modules/inventory/receipt-shared'
import {
  KIND,
  STATUS,
  outgoingTypeLabel,
  formatDateTime,
  signed,
  useAdjustmentPaths,
} from '@/components/modules/inventory/adjustment-shared'

// Shared by the All, Counting, Pending and Posted tabs of Inventory >
// Adjustments, and by Inventory > Outgoing > Write-offs & gifts (scope "outgoing").
// Each page.js passes `view` and `scope`.

const PAGE_SIZE = 50

const COPY = {
  all: { hint: 'Every count and adjustment for this branch, newest first.', empty: 'No adjustments yet.' },
  counting: { hint: 'Open counts and adjustments, and any that were rejected and need fixing.', empty: 'Nothing is being counted right now.' },
  pending: { hint: 'Submitted and waiting for approval, or approved and waiting to be posted.', empty: 'Nothing is waiting for approval.' },
  posted: { hint: 'Posted. Each one changed stock and is in Movements.', empty: 'Nothing has been posted yet.' },
}

export default function AdjustmentsListPage({ view = 'all', scope = 'adjustments' }) {
  const router = useRouter()
  const { branchId, adjustments, writeOffs } = useAdjustmentPaths()
  const isOutgoing = scope === 'outgoing'
  const detailBase = isOutgoing ? writeOffs : adjustments

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
    const { data, error } = await supabase.rpc('list_inventory_adjustments', {
      p_branch: branchId,
      p_view: view,
      p_search: debounced || null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
      p_scope: scope,
    })
    if (error) {
      console.error('Failed to load adjustments:', error)
      toast.error(error.message)
      setLoadError(error.message)
      setRows([])
      setTotal(0)
    } else {
      setRows(data || [])
      setTotal(Number(data?.[0]?.total_count || 0))
    }
    setLoading(false)
  }, [branchId, view, debounced, page, scope])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col gap-3 p-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{isOutgoing ? 'Write-offs, samples and gifts: stock leaving without a sale or a return to a supplier.' : COPY[view]?.hint}</p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by number"
          className="h-7 w-64 text-xs"
        />
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-xs text-gray-500">Loading adjustments...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : rows.length === 0 ? (
        <EmptyState>{debounced ? 'No document matches that search.' : isOutgoing ? 'No write-offs, samples or gifts yet.' : COPY[view]?.empty}</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Number</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Warehouse</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Lines</th>
                  <th className="px-3 py-2 text-right">Net change</th>
                  <th className="px-3 py-2 text-left">Started by</th>
                  <th className="px-3 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const status = STATUS[row.display_status] || STATUS.counting
                  const kind = KIND[row.kind] || KIND.adjustment
                  return (
                    <tr
                      key={row.id}
                      onClick={() => router.push(`${detailBase}/${row.id}`)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 font-mono text-[11px] text-gray-800">{row.adjustment_number}</td>
                      <td className="px-3 py-2"><Tone tone={kind.tone}>{row.kind === 'outgoing' ? outgoingTypeLabel(row.outgoing_type) : kind.label}</Tone></td>
                      <td className="px-3 py-2">{row.warehouse_name || '—'}</td>
                      <td className="px-3 py-2"><Tone tone={status.tone}>{status.label}</Tone></td>
                      <td className="px-3 py-2 text-right">{Number(row.line_count)}</td>
                      <td className="px-3 py-2 text-right">{Number(row.line_count) ? signed(row.net_change) : '—'}</td>
                      <td className="px-3 py-2">{row.created_by_name || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{formatDateTime(row.posted_at || row.submitted_at || row.created_at)}</td>
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
