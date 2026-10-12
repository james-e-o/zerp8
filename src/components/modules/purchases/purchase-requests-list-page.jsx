'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import supabase from '@/config/supabaseClient'

const REQUEST_STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  converted: 'bg-emerald-100 text-emerald-800',
}

export function RequestStatusBadge({ status }) {
  const normalizedStatus = String(status || 'unknown').toLowerCase()
  const label = normalizedStatus
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-medium ${REQUEST_STATUS_STYLES[normalizedStatus] || 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  )
}

// 'Draft' is a different table now (purchase_request_drafts), not a
// status value on purchase_requests - a draft isn't a real request yet,
// it's a JSONB snapshot of in-progress form state (same split as
// product_drafts vs products). So this page branches: the Draft tab
// queries purchase_request_drafts and opens the form via ?draft=<id>;
// every other tab queries purchase_requests as before and opens the
// request detail page at /<id>.
export default function PurchaseRequestsListPage({ title, description, status = 'all' }) {
  const { u, companyId, branchId } = useParams()
  const router = useRouter()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/requests`
  const ordersBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders`
  const isDraftTab = status === 'draft'
  // Merging (combining several approved requests into one purchase
  // order) only ever makes sense on the Approved tab - a request has to
  // be approved before it can be converted at all, single or merged.
  const isApprovedTab = status === 'approved'

  const [requests, setRequests] = useState([])
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    )
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setSelectedIds([])

      if (isDraftTab) {
        const { data, error } = await supabase
          .from('purchase_request_drafts')
          .select('id, title, updated_at')
          .eq('branch', branchId)
          .order('updated_at', { ascending: false })

        if (!cancelled) {
          if (!error) setDrafts(data || [])
          setLoading(false)
        }
        return
      }

      let query = supabase
        .from('purchase_requests')
        .select('id, title, request_number, requested_by, needed_by, status, created_at')
        .eq('branch', branchId)
        .order('created_at', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status.replace(/-/g, '_'))
      }

      const { data, error } = await query
      if (cancelled) return

      if (!error) setRequests(data || [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [branchId, status, isDraftTab])

  return (
    <div className="flex flex-col gap-4">
      {(title || description || (isApprovedTab && selectedIds.length > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold text-gray-800">{title}</h2>}
            {/* {description && <p className="text-xs text-gray-500">{description}</p>} */}
          </div>
          {isApprovedTab && selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => router.push(`${ordersBase}/new?fromRequests=${selectedIds.join(',')}`)}
              disabled={selectedIds.length < 2}
              title={selectedIds.length < 2 ? 'Select at least 2 requests to merge' : undefined}
              className="h-7 rounded-sm bg-core px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Merge {selectedIds.length} into Purchase Order
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading purchase requests...</p>
      ) : isDraftTab ? (
        drafts.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
            No draft requests here yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Last saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drafts.map((draft) => (
                  <tr
                    key={draft.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open draft request ${draft.title || draft.id}`}
                    onClick={() => router.push(`${base}/new?draft=${draft.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        router.push(`${base}/new?draft=${draft.id}`)
                      }
                    }}
                    className="cursor-pointer hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core"
                  >
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-800">
                        {draft.title || 'Untitled draft'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {draft.updated_at
                        ? new Date(draft.updated_at).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : requests.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No purchase requests here yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-600">
              <tr>
                {isApprovedTab && <th className="w-8 px-3 py-2 text-left" />}
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Request #</th>
                <th className="px-3 py-2 text-left">Requested by</th>
                <th className="px-3 py-2 text-left">Needed by</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((request) => (
                <tr
                  key={request.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open purchase request ${request.title || request.request_number || request.id}`}
                  onClick={() => router.push(`${base}/${request.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      router.push(`${base}/${request.id}`)
                    }
                  }}
                  className="cursor-pointer hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core"
                >
                  {isApprovedTab && (
                    <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(request.id)}
                        onChange={() => toggleSelected(request.id)}
                        aria-label={`Select ${request.title || request.request_number || 'request'} for merging`}
                        className="size-3.5"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-800">
                      {request.title || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{request.request_number}</td>
                  <td className="px-3 py-2 text-gray-700">{request.requested_by || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{request.needed_by || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {request.created_at ? new Date(request.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2"><RequestStatusBadge status={request.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}