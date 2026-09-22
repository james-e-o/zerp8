"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import StatusBadge from "@/components/modules/sales/status-badge"
import { DUMMY_INVOICES, formatNaira } from "@/components/modules/sales/dummy-data"

export default function InvoiceDetailPage() {
  const { u, companyId, branchId, invoiceId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const invoice = DUMMY_INVOICES.find((item) => item.id === invoiceId) || DUMMY_INVOICES[0]
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [amount, setAmount] = useState(invoice.total - invoice.paid)
  const [method, setMethod] = useState("Bank Transfer")
  const [reference, setReference] = useState("")
  const [saving, setSaving] = useState(false)
  const balance = invoice.total - invoice.paid

  const recordPayment = async (event) => {
    event.preventDefault()
    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSaving(false)
    setShowPaymentForm(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between"><div><h1 className="text-2xl font-bold text-slate-900">{invoice.id}</h1><p className="mt-1 text-sm text-gray-600"><Link href={`${base}/customers/${invoice.customerId}`} className="text-core hover:underline">{invoice.customerName}</Link>{" - Issued " + invoice.issuedAt}{invoice.orderId && <> - <Link href={`${base}/orders/${invoice.orderId}`} className="text-core hover:underline">{invoice.orderId}</Link></>}</p></div><div className="flex flex-col items-end gap-1"><StatusBadge status={invoice.type} /><StatusBadge status={invoice.status} /></div></div>
      <div className="rounded-lg border border-gray-200 bg-white p-5"><table className="w-full text-left text-sm"><thead className="text-xs font-semibold uppercase text-gray-500"><tr><th className="py-2">Product</th><th className="py-2">Qty</th><th className="py-2">Unit Price</th><th className="py-2 text-right">Amount</th></tr></thead><tbody className="divide-y divide-gray-100">{invoice.items.map((item, index) => <tr key={index}><td className="py-2">{item.name}</td><td className="py-2">{item.qty}</td><td className="py-2">{formatNaira(item.unitPrice)}</td><td className="py-2 text-right">{formatNaira(item.qty * item.unitPrice)}</td></tr>)}</tbody></table><div className="mt-4 space-y-1 border-t border-gray-100 pt-3 text-sm"><div className="flex justify-between"><span className="text-gray-600">Total</span><span className="font-semibold">{formatNaira(invoice.total)}</span></div><div className="flex justify-between"><span className="text-gray-600">Paid</span><span className="font-semibold">{formatNaira(invoice.paid)}</span></div><div className="flex justify-between text-base"><span className="font-semibold text-gray-800">Balance</span><span className="font-bold text-slate-900">{formatNaira(balance)}</span></div></div></div>
      {invoice.payments.length > 0 && <div className="rounded-lg border border-gray-200 bg-white p-5"><h2 className="mb-3 text-xs font-semibold uppercase text-gray-500">Payment history</h2><div className="space-y-2">{invoice.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between text-sm"><div><p className="font-semibold text-gray-800">{payment.id}</p><p className="text-xs text-gray-500">{payment.method} - {payment.reference} - {payment.date}</p></div><span className="font-semibold text-slate-900">{formatNaira(payment.amount)}</span></div>)}</div></div>}
      {showPaymentForm && balance > 0 && <form onSubmit={recordPayment} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5"><h2 className="text-xs font-semibold uppercase text-gray-500">Record payment</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div><label className="mb-1 block text-xs font-semibold text-gray-700">Amount</label><input type="number" min="0" max={balance} value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="w-full rounded border border-gray-200 px-3 py-2 text-sm" /></div><div><label className="mb-1 block text-xs font-semibold text-gray-700">Method</label><select value={method} onChange={(event) => setMethod(event.target.value)} className="w-full rounded border border-gray-200 px-3 py-2 text-sm"><option>Bank Transfer</option><option>Cash</option><option>Card</option><option>Cheque</option></select></div><div><label className="mb-1 block text-xs font-semibold text-gray-700">Reference</label><input value={reference} onChange={(event) => setReference(event.target.value)} className="w-full rounded border border-gray-200 px-3 py-2 text-sm" placeholder="TRX-..." /></div></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setShowPaymentForm(false)}>Cancel</Button><Button type="submit" className="bg-core text-white" disabled={saving}>{saving ? "Saving..." : "Save Payment"}</Button></div></form>}
      <div className="flex flex-wrap gap-3">{balance > 0 && invoice.type !== "credit_note" && <Button className="bg-core text-white" onClick={() => setShowPaymentForm(true)}>Record Payment</Button>}{invoice.type === "sales_invoice" && <Link href={`${base}/returns/new?invoiceId=${invoice.id}`}><Button variant="outline">Issue Credit Note (via Return)</Button></Link>}<Button variant="outline">Print / Download</Button></div>
      <p className="text-xs text-gray-400">No edit route here - once issued this is a financial posting. Corrections go through a Return -&gt; Credit Note.</p>
    </div>
  )
}