'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import supabase from '@/config/supabaseClient'
import StatusBadge from '@/components/modules/sales/status-badge'

export default function ReceiptsListPage({ title, description, status }) {
  const { u, companyId, branchId } = useParams()
  const router = useRouter()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/receipts`

  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      let query = supabase
        .from('purchase_receipts')
        .select(
          `id, receipt_number, status, created_at,
           purchase_order:purchase_orders ( order_number, supplier:suppliers(name) ),
           purchase_receipt_line_items ( purchase_receipt_holds ( status ) )`
        )
        .eq('branch', branchId)
        .order('created_at', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status.replace(/-/g, '_'))
      }

      const { data, error } = await query
      if (cancelled) return

      if (!error) {
        setReceipts((data || []).map((receipt) => ({
          ...receipt,
          // "In quarantine" while ANY of the receipt's goods are still held
          // (awaiting review or marked damaged) - accepted/returned goods
          // no longer count.
          inQuarantine: (receipt.purchase_receipt_line_items || []).some(
            (line) => (line.purchase_receipt_holds || []).some(
              (hold) => hold.status === 'awaiting_review' || hold.status === 'damaged'
            )
          ),
        })))
      }
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
            <h2 className="text-sm tracking-tight font-semibold text-gray-800">{title}</h2>
          )}
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading receipts...</p>
      ) : receipts.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No receipts here yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Receipt #</th>
                <th className="px-3 py-2 text-left">Purchase order</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipts.map((receipt) => (
                <tr
                  key={receipt.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open receipt ${receipt.receipt_number}`}
                  onClick={() => router.push(`${base}/${receipt.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      router.push(`${base}/${receipt.id}`)
                    }
                  }}
                  className="cursor-pointer hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core"
                >
                  <td className="px-3 py-2">
                    <span className="font-medium text-core">
                      {receipt.receipt_number}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {receipt.purchase_order?.order_number || '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {receipt.purchase_order?.supplier?.name || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={receipt.status} />
                      {receipt.inQuarantine && (
                        <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          In quarantine
                        </span>
                      )}
                    </div>
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