'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/modules/sales/status-badge'
import { DUMMY_RETURNS } from '@/components/modules/sales/dummy-data'

export default function ReturnDetailPage() {
  const router = useRouter()
  const { u, companyId, branchId, returnId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const ret = DUMMY_RETURNS.find((item) => item.id === returnId) || DUMMY_RETURNS[0]
  const [status, setStatus] = useState(ret.status)
  const [working, setWorking] = useState(false)

  const runAction = async (nextStatus) => {
    setWorking(true)
    await new Promise((resolve) => setTimeout(resolve, 400))
    setWorking(false)
    if (nextStatus === 'received') {
      router.push(`${base}/invoices/new?type=credit_note&returnId=${ret.id}`)
      return
    }
    setStatus(nextStatus)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between"><div><h1 className="text-2xl font-bold text-slate-900">{ret.id}</h1><p className="mt-1 text-sm text-gray-600">{ret.customerName} · {ret.source === 'manual' ? 'Manual return' : 'Requested return'} · Against <Link href={`${base}/deliveries/${ret.deliveryId}`} className="text-core hover:underline">{ret.deliveryId}</Link>{ret.invoiceId && <> / <Link href={`${base}/invoices/${ret.invoiceId}`} className="text-core hover:underline">{ret.invoiceId}</Link></>}</p></div><StatusBadge status={status} /></div>
      <div className="rounded-lg border border-gray-200 bg-white p-5"><table className="w-full text-left text-sm"><thead className="text-xs font-semibold uppercase text-gray-500"><tr><th className="py-2">Product</th><th className="py-2">Delivered</th><th className="py-2">Returned</th><th className="py-2">Restockable</th></tr></thead><tbody className="divide-y divide-gray-100">{ret.items.map((item) => <tr key={item.productId}><td className="py-2">{item.name}</td><td className="py-2">{item.deliveredQty}</td><td className="py-2">{item.returnedQty}</td><td className="py-2">{item.restockable ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div>
      <div className="flex flex-wrap gap-3">{ret.source !== 'manual' && status === 'requested' && <><Button className="bg-core text-white" disabled={working} onClick={() => runAction('approved')}>Approve</Button><Button variant="outline" className="text-red-600" disabled={working} onClick={() => runAction('rejected')}>Reject</Button></>}{ret.source !== 'manual' && status === 'approved' && <Button className="bg-core text-white" disabled={working} onClick={() => runAction('received')}>Mark Received - Issue Credit Note</Button>}{status === 'received' && ret.creditNoteId && <Link href={`${base}/invoices/${ret.creditNoteId}`}><Button variant="outline">View Credit Note</Button></Link>}</div>
      <p className="text-xs text-gray-400">No edit route - corrections happen through a new return.</p>
    </div>
  )
}