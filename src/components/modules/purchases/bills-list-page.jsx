'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

// ASSUMPTION: adjust to your actual Supabase client path.
import supabase from '@/config/supabaseClient'
import { formatNaira } from '@/components/modules/sales/dummy-data'
import StatusBadge from '@/components/modules/sales/status-badge'

export default function BillsListPage({ title, description, status }) {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/bills`

  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      // purchase_bills_view (not the raw table) adds effective_status,
      // which turns into 'overdue' once due_date passes without needing
      // a stored status to be flipped by a cron job.
      let query = supabase
        .from('purchase_bills_view')
        .select(
          `id, bill_number, effective_status, due_date, total,
           supplier:suppliers(name),
           purchase_order:purchase_orders(order_number)`
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('effective_status', status.replace(/-/g, '_'))
      }

      const { data, error } = await query
      if (cancelled) return

      if (!error) setBills(data || [])
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
        <p className="text-xs text-gray-500">Loading bills...</p>
      ) : bills.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No bills here yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Bill #</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">Purchase order</th>
                <th className="px-3 py-2 text-left">Due date</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`${base}/${bill.id}`}
                      className="font-medium text-core hover:underline"
                    >
                      {bill.bill_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {bill.supplier?.name || '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {bill.purchase_order?.order_number || '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {bill.due_date || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {formatNaira(bill.total || 0)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={bill.effective_status} />
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