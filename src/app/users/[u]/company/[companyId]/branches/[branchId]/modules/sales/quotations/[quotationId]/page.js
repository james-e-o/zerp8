'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/modules/sales/status-badge'
import { DUMMY_QUOTATIONS, formatNaira } from '@/components/modules/sales/dummy-data'

export default function QuotationDetailPage() {
  const router = useRouter()
  const { u, companyId, branchId, quotationId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const quotation = DUMMY_QUOTATIONS.find((item) => item.id === quotationId) || DUMMY_QUOTATIONS[0]
  const [status, setStatus] = useState(quotation.status)
  const [working, setWorking] = useState(false)
  const isExpired = status === 'sent' && new Date(quotation.validUntil) < new Date()

  const runAction = async (action, nextStatus) => {
    setWorking(true)
    await new Promise((resolve) => setTimeout(resolve, 400))
    setWorking(false)
    if (action === 'accept') {
      router.push(`${base}/orders/new?fromQuotation=${quotation.id}`)
      return
    }
    setStatus(nextStatus)
  }

  const markSent = async () => {
    setWorking(true)
    await new Promise((resolve) => setTimeout(resolve, 400))
    setWorking(false)
    setStatus('sent')
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between"><div><h1 className="text-2xl font-bold text-slate-900">{quotation.id}</h1><p className="mt-1 text-sm text-gray-600"><Link href={`${base}/customers/${quotation.customerId}`} className="text-core hover:underline">{quotation.customerName}</Link>{' · Created '}{quotation.createdAt}</p></div><StatusBadge status={status} /></div>
      {isExpired && <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">This quotation expired on {quotation.validUntil}. Review pricing before creating an order.</p>}
      <div className="rounded-lg border border-gray-200 bg-white p-5"><h2 className="mb-3 text-xs font-semibold uppercase text-gray-500">Line items</h2><table className="w-full text-left text-sm"><thead className="text-xs font-semibold uppercase text-gray-500"><tr><th className="py-2">Product</th><th className="py-2">Qty</th><th className="py-2">Unit Price</th><th className="py-2 text-right">Amount</th></tr></thead><tbody className="divide-y divide-gray-100">{quotation.items.map((item) => <tr key={item.productId}><td className="py-2">{item.name}</td><td className="py-2">{item.qty}</td><td className="py-2">{formatNaira(item.unitPrice)}</td><td className="py-2 text-right">{formatNaira(item.qty * item.unitPrice)}</td></tr>)}</tbody></table><div className="mt-4 flex justify-between border-t border-gray-100 pt-3"><span className="text-sm font-semibold text-gray-800">Total</span><span className="text-xl font-bold text-slate-900">{formatNaira(quotation.total)}</span></div><p className="mt-2 text-xs text-gray-500">Valid until {quotation.validUntil}</p></div>
      <div className="flex flex-wrap gap-3">{status === 'draft' && <><Button className="bg-core text-white" disabled={working} onClick={markSent}>{working ? 'Generating PDF...' : 'Export / Send PDF'}</Button><Link href={`${base}/quotations/${quotation.id}/edit`}><Button variant="outline">Edit</Button></Link></>}{status === 'sent' && <><Button className="bg-core text-white" disabled={working} onClick={() => runAction('accept')}>Mark Accepted - Create Sales Order</Button><Button variant="outline" disabled={working} onClick={() => runAction('reject', 'rejected')}>Mark Rejected</Button></>}{status === 'accepted' && <Link href={`${base}/orders`}><Button variant="outline">View Sales Orders</Button></Link>}<Button variant="outline" disabled>Duplicate</Button></div>
    </div>
  )
}