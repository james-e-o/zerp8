'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DUMMY_POS_SALES, formatNaira } from '@/components/modules/sales/dummy-data'

export default function POSDetailPage() {
  const { posId } = useParams()
  const sale = DUMMY_POS_SALES.find((item) => item.id === posId) || DUMMY_POS_SALES[0]
  const [voiding, setVoiding] = useState(false)
  const [voided, setVoided] = useState(false)
  const isSameDay = new Date(sale.createdAt).toDateString() === new Date().toDateString()

  const handleVoid = async () => {
    setVoiding(true)
    await new Promise((resolve) => setTimeout(resolve, 400))
    setVoiding(false)
    setVoided(true)
  }

  return (
    <div className="max-w-md space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">{sale.id}</h1><p className="mt-1 text-sm text-gray-600">{new Date(sale.createdAt).toLocaleString()} · {sale.paymentMethod}</p></div>
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        {voided && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">This sale has been voided.</p>}
        <table className="w-full text-left text-sm"><thead className="text-xs font-semibold uppercase text-gray-500"><tr><th className="py-2">Item</th><th className="py-2">Qty</th><th className="py-2 text-right">Amount</th></tr></thead><tbody className="divide-y divide-gray-100">{sale.items.map((item) => <tr key={item.productId}><td className="py-2">{item.name}</td><td className="py-2">{item.qty}</td><td className="py-2 text-right">{formatNaira(item.qty * item.unitPrice)}</td></tr>)}</tbody></table>
        <div className="mt-4 flex justify-between border-t border-gray-100 pt-3"><span className="text-sm font-semibold text-gray-800">Total</span><span className="text-xl font-bold text-slate-900">{formatNaira(sale.total)}</span></div>
      </div>
      <div className="flex flex-wrap gap-3"><Button variant="outline">Reprint Receipt</Button>{isSameDay && !voided && <Button variant="outline" className="text-red-600" disabled={voiding} onClick={handleVoid}>{voiding ? 'Voiding...' : 'Void Sale'}</Button>}</div>
      {!isSameDay && <p className="text-xs text-gray-400">Voiding is only available on the same day as the sale.</p>}
    </div>
  )
}