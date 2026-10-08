'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import supabase from '@/config/supabaseClient'
import StatusBadge from '@/components/modules/sales/status-badge'

export default function PurchaseRequestsListPage({ title, description, status = 'all' }) {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/requests`
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      let query = supabase
        .from('purchase_requests')
        .select('id, request_number, requested_by, needed_by, status, created_at')
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
  }, [branchId, status])

  return (
    <div className="flex flex-col gap-4">
      {(title || description) && (
        <div>
          {title && <h2 className="text-base font-semibold text-gray-800">{title}</h2>}
          {/* {description && <p className="text-xs text-gray-500">{description}</p>} */}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading purchase requests...</p>
      ) : requests.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No purchase requests here yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Request #</th>
                <th className="px-3 py-2 text-left">Requested by</th>
                <th className="px-3 py-2 text-left">Needed by</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-800">
                      {request.request_number}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{request.requested_by || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{request.needed_by || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {request.created_at ? new Date(request.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={request.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}