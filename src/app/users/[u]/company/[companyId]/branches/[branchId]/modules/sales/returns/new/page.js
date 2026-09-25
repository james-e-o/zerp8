'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DUMMY_DELIVERIES, DUMMY_INVOICES } from '@/components/modules/sales/dummy-data'

export default function NewReturnPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const searchParams = useSearchParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const [deliveryId, setDeliveryId] = useState(searchParams.get('deliveryId') || DUMMY_DELIVERIES[0]?.id || '')
  const delivery = DUMMY_DELIVERIES.find((item) => item.id === deliveryId)
  const linkedInvoice = useMemo(() => DUMMY_INVOICES.find((invoice) => invoice.deliveryId === deliveryId), [deliveryId])
  const [quantities, setQuantities] = useState(() => Object.fromEntries((delivery?.items || []).map((item) => [item.productId, 0])))
  const [restockable, setRestockable] = useState(true)
  const [resolution, setResolution] = useState('restock')
  const [saving, setSaving] = useState(false)

  const onDeliveryChange = (id) => {
    setDeliveryId(id)
    const next = DUMMY_DELIVERIES.find((item) => item.id === id)
    setQuantities(Object.fromEntries((next?.items || []).map((item) => [item.productId, 0])))
  }

  const updateQty = (productId, value, max) => {
    setQuantities((current) => ({ ...current, [productId]: Math.max(0, Math.min(Number(value) || 0, max)) }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const status = resolution === 'reject' ? 'rejected' : 'received'
    // TODO: persist source=manual, resolution, and status with the return record.
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSaving(false)
    router.push(`${base}/returns?status=${status}&source=manual`)
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">New Return</h1>
          <p className="text-xs text-gray-500">Manual entry for goods already returned to your location.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" form="return-form" className="bg-core text-white" disabled={saving}>{saving ? 'Saving...' : 'Record Manual Return'}</Button>
        </div>
      </div>
      <form id="return-form" onSubmit={handleSubmit} className="flex min-h-0 grow flex-col gap-4 overflow-hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-800">
            Delivery
          <select value={deliveryId} onChange={(event) => onDeliveryChange(event.target.value)} className="w-full rounded border border-gray-200 px-3 py-2 text-sm">
            {DUMMY_DELIVERIES.map((item) => <option key={item.id} value={item.id}>{item.id} - {item.customerName}</option>)}
          </select>
          {linkedInvoice && <p className="mt-1 text-xs text-gray-500">Linked invoice: {linkedInvoice.id}</p>}
          </label>
          <label className="text-xs font-medium text-gray-800">
            Resolution
            <select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm">
              <option value="restock">Receive and restock</option>
              <option value="credit_note">Receive and issue credit note</option>
              <option value="reject">Reject return</option>
            </select>
          </label>
        </div>

        <div className="min-h-0 grow overflow-auto rounded-lg border border-gray-200 bg-white p-4">
          {delivery ? (
            <label className="mb-2 block text-sm font-semibold text-gray-800">Quantities to return</label>
          ) : null}
          {delivery && <div className="space-y-3">
              {delivery.items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded border border-gray-100 p-3">
                  <div><p className="text-sm font-semibold text-gray-800">{item.name}</p><p className="text-xs text-gray-500">Delivered: {item.qty}</p></div>
                  <input type="number" min="0" max={item.qty} value={quantities[item.productId] ?? 0} onChange={(event) => updateQty(item.productId, event.target.value, item.qty)} className="w-24 rounded border border-gray-200 px-2 py-1.5 text-right text-sm" />
                </div>
              ))}
          </div>}
        </div>

        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
          <input type="checkbox" checked={restockable} onChange={(event) => setRestockable(event.target.checked)} className="accent-core" />
          Units are in acceptable condition for restocking
        </label>
      </form>
    </div>
  )
}
