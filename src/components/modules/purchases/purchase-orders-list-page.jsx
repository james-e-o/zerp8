'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import supabase from '@/config/supabaseClient'
import { formatNaira } from '@/components/modules/sales/dummy-data'
// ASSUMPTION: reusing the Sales module's StatusBadge — adjust path if it
// lives elsewhere or if Purchases has its own copy.
import StatusBadge from '@/components/modules/sales/status-badge'

export default function PurchaseOrdersListPage({
  title,
  description,
  status, // undefined/'all' means no filter
}) {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders`

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      let query = supabase
        .from('purchase_orders')
        .select(
          'id, order_number, supplier:suppliers(name), status, expected_date, total, created_at'
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status.replace(/-/g, '_'))
      }

      const { data, error } = await query
      if (cancelled) return

      if (!error) setOrders(data || [])
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
          {title && (
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          )}
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading purchase orders...</p>
      ) : orders.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No purchase orders here yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Order #</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">Expected date</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`${base}/${order.id}`}
                      className="font-medium text-core hover:underline"
                    >
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {order.supplier?.name || '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {order.expected_date || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {formatNaira(order.total || 0)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={order.status} />
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
