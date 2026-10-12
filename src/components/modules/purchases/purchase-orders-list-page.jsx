'use client'

import { useContext, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import supabase from '@/config/supabaseClient'
import { formatCurrency } from '@/components/modules/purchases/dummy-data'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'

const ORDER_STATUS_STYLES = {
  // 'open' = created internally, nothing sent yet.
  open: 'bg-blue-100 text-blue-800',
  // 'sent' = actually transmitted/exported to the supplier, set from
  // the order detail page's Send/Export flow - kept visually distinct
  // from 'open' now that the two are different events.
  sent: 'bg-indigo-100 text-indigo-800',
  partially_received: 'bg-amber-100 text-amber-800',
  fully_received: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
}

export function OrderStatusBadge({ status }) {
  const normalizedStatus = String(status || 'unknown').toLowerCase()
  const label = normalizedStatus
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-medium ${ORDER_STATUS_STYLES[normalizedStatus] || 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  )
}

export default function PurchaseOrdersListPage({
  title,
  description,
  status, // undefined/'all' means no filter
}) {
  const { u, companyId, branchId } = useParams()
  const { currentBranch } = useContext(BranchContext) || {}
  const router = useRouter()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders`
  const isDraftTab = status === 'draft'

  const [orders, setOrders] = useState([])
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      if (isDraftTab) {
        const { data, error } = await supabase
          .from('purchase_order_drafts')
          .select('id, title, updated_at')
          .eq('branch', branchId)
          .order('updated_at', { ascending: false })

        if (!cancelled) {
          if (error) setErrorMessage('Failed to load purchase order drafts.')
          else setDrafts(data || [])
          setLoading(false)
        }
        return
      }

      let query = supabase
        .from('purchase_orders')
        .select(
          'id, title, order_number, supplier:suppliers(name), status, expected_delivery_date, created_at, purchase_order_line_items(line_total)'
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status.replace(/-/g, '_'))
      }

      const { data, error } = await query
      if (cancelled) return

      if (error) {
        setErrorMessage('Failed to load purchase orders.')
      } else {
        setOrders((data || []).map((order) => ({
          ...order,
          total: (order.purchase_order_line_items || []).reduce(
            (sum, line) => sum + Number(line.line_total || 0),
            0
          ),
        })))
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [branchId, status, isDraftTab])

  return (
    <div className="flex flex-col gap-4">
      {(title || description) && (
        <div>
          {title && (
            <h2 className="text-base tracking-tight font-semibold text-gray-800">{title}</h2>
          )}
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading purchase orders...</p>
      ) : errorMessage ? (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>
      ) : isDraftTab ? drafts.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No draft purchase orders here yet.
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
                  onClick={() => router.push(`${base}/new?draft=${draft.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      router.push(`${base}/new?draft=${draft.id}`)
                    }
                  }}
                  className="cursor-pointer hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core"
                >
                  <td className="px-3 py-2 font-medium text-gray-800">{draft.title || 'Untitled draft'}</td>
                  <td className="px-3 py-2 text-gray-700">{draft.updated_at ? new Date(draft.updated_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No purchase orders here yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Order #</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">Expected date</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`${base}/${order.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      router.push(`${base}/${order.id}`)
                    }
                  }}
                  aria-label={`Open purchase order ${order.title || order.order_number}`}
                  className="cursor-pointer hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core"
                >
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {order.title || order.order_number}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {order.order_number}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {order.supplier?.name || '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {order.expected_delivery_date || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {formatCurrency(order.total || 0, currentBranch?.base_currency || '')}
                  </td>
                  <td className="px-3 py-2">
                    <OrderStatusBadge status={order.status} />
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