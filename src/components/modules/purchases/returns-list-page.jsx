'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import supabase from '@/config/supabaseClient'
import {
  RESOLUTION_LABELS,
  ReturnStatusPill,
  formatDate,
  useMoney,
} from '@/components/modules/purchases/supplier-credit-shared'

// One list component for every Returns tab (All, Draft, Pending, Approved,
// Dispatched, Cancelled): each tab's page.js passes its status. The
// "Pending" tab is the pending_approval status.
//
// On the Dispatched tab an "Awaiting outcome" switch narrows it to returns
// whose money has not come back yet (credit note / refund expected, and less
// recovered than the return was worth).

const STATUS_FOR_TAB = {
  draft: 'draft',
  pending: 'pending_approval',
  approved: 'approved',
  dispatched: 'dispatched',
  cancelled: 'cancelled',
}

const EMPTY_TEXT = {
  all: 'No returns yet.',
  draft: 'No draft returns.',
  pending: 'No returns waiting for approval.',
  approved: 'No approved returns waiting to be dispatched.',
  dispatched: 'No dispatched returns.',
  cancelled: 'No cancelled returns.',
}

export default function ReturnsListPage({ status = 'all' }) {
  const { u, companyId, branchId } = useParams()
  const router = useRouter()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/returns`

  const [rows, setRows] = useState([])
  const [recovery, setRecovery] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [awaitingOnly, setAwaitingOnly] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      let query = supabase
        .from('purchase_returns')
        .select(
          `id, return_number, status, resolution, reason, created_at, dispatched_at,
           supplier:suppliers ( id, name ),
           purchase_return_line_items ( quantity, line_total )`
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })

      if (STATUS_FOR_TAB[status]) query = query.eq('status', STATUS_FOR_TAB[status])

      const [{ data, error }, { data: recoveryRows }] = await Promise.all([
        query,
        supabase
          .from('purchase_return_recovery')
          .select('purchase_return, value, recovered, outstanding, is_awaiting')
          .eq('branch', branchId),
      ])

      if (cancelled) return

      if (error) {
        console.error('Failed to load returns:', error)
        setErrorMessage(error.message || 'Could not load returns.')
      } else {
        setRows(data || [])
        setRecovery(Object.fromEntries((recoveryRows || []).map((row) => [row.purchase_return, row])))
      }
      setLoading(false)
    }

    if (branchId) load()
    return () => {
      cancelled = true
    }
  }, [branchId, status])

  const visible = useMemo(
    () => rows.filter((row) => !awaitingOnly || recovery[row.id]?.is_awaiting),
    [rows, recovery, awaitingOnly]
  )

  return (
    <div className="flex flex-col gap-3 px-1 py-3 text-xs">
      {status === 'dispatched' && (
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input
            type="checkbox"
            checked={awaitingOnly}
            onChange={(event) => setAwaitingOnly(event.target.checked)}
            className="size-3.5 rounded-sm border-border"
          />
          Awaiting outcome only (money not recovered yet)
        </label>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading returns...</p>
      ) : errorMessage ? (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">{errorMessage}</p>
      ) : visible.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          {awaitingOnly ? 'Nothing is waiting for an outcome.' : EMPTY_TEXT[status] || EMPTY_TEXT.all}
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Return</th>
                <th className="px-4 py-2 text-left font-medium">Supplier</th>
                <th className="px-4 py-2 text-right font-medium">Units</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Outcome</th>
                <th className="px-4 py-2 text-left font-medium">{status === 'dispatched' ? 'Dispatched' : 'Created'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => {
                const lines = row.purchase_return_line_items || []
                const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
                const value = lines.reduce((sum, line) => sum + Number(line.line_total || 0), 0)
                const rec = recovery[row.id]

                let outcome = '—'
                if (row.status === 'dispatched') {
                  if (rec?.is_awaiting) {
                    outcome = `Awaiting ${RESOLUTION_LABELS[row.resolution]?.toLowerCase() || 'outcome'} - ${money(rec.recovered)} of ${money(rec.value)}`
                  } else if (['credit_note', 'refund', 'debit_note'].includes(row.resolution)) {
                    outcome = `${RESOLUTION_LABELS[row.resolution]} - recovered ${money(rec?.recovered)}`
                  } else {
                    outcome = RESOLUTION_LABELS[row.resolution] || '—'
                  }
                } else if (row.status !== 'cancelled') {
                  outcome = `Expecting ${RESOLUTION_LABELS[row.resolution]?.toLowerCase() || '—'}`
                }

                return (
                  <tr
                    key={row.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`${base}/${row.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        router.push(`${base}/${row.id}`)
                      }
                    }}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core"
                  >
                    <td className="px-4 py-2 font-medium text-foreground">{row.return_number}</td>
                    <td className="px-4 py-2 text-foreground">{row.supplier?.name || '—'}</td>
                    <td className="px-4 py-2 text-right text-foreground">{units.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-foreground">{money(value)}</td>
                    <td className="px-4 py-2"><ReturnStatusPill status={row.status} /></td>
                    <td className="px-4 py-2 text-muted-foreground">{outcome}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(status === 'dispatched' ? row.dispatched_at : row.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
