'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ReceiptBody, printReceipt, usePosSale } from '@/components/modules/sales/pos-receipt'
import { useBranchTimezone } from '@/components/modules/sales/pos-shared'

export default function PosSaleDetailPage() {
  const { u, companyId, branchId, saleId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/pos`
  const tz = useBranchTimezone(branchId)
  const { loading, sale, lines, payments } = usePosSale(saleId)
  const ref = useRef(null)

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading sale...</div>
  if (!sale) return <div className="p-6 text-sm text-muted-foreground">Sale not found.</div>

  return (
    <div className="h-full overflow-y-auto px-1">
      <div className="mb-3 flex items-center justify-between">
        <Link href={`${base}/history`} className="text-sm text-core hover:underline">← Sales history</Link>
        <Button size="sm" variant="outline" onClick={() => printReceipt(ref.current)}><Printer className="mr-1.5 h-4 w-4" />Print receipt</Button>
      </div>
      <div className="mx-auto max-w-md rounded-md border border-border bg-card p-4">
        <ReceiptBody sale={sale} lines={lines} payments={payments} tz={tz} innerRef={ref} />
        <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <p>Customer: {sale.customers?.name || 'Walk-in'}</p>
          <p>Session: {sale.pos_sessions ? <Link href={`${base}/sessions/${sale.pos_sessions.id}`} className="text-core hover:underline">{sale.pos_sessions.session_number}</Link> : '—'}</p>
        </div>
      </div>
    </div>
  )
}
