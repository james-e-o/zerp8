'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import supabase from '@/config/supabaseClient'
import { formatNaira } from '@/components/modules/sales/dummy-data'
import StatusBadge from '@/components/modules/sales/status-badge'


// Rewired onto the real schema from purchase-bills-migration.sql:
//  - purchase_bills_view (not the raw table) for effective_status,
//    which shows 'overdue' once due_date passes with nothing needing
//    to flip a stored column.
//  - purchase_bill_line_items for the actual billed lines.
//  - purchase_bill_payments for payment history, plus
//    record_purchase_bill_payment() to add one - purchase_bills.paid
//    and status update themselves via trigger once a payment lands.
//  - cancel_purchase_bill() for the Cancel action - the function
//    itself refuses if anything's been paid, so this page just
//    surfaces whatever it says rather than re-deciding that here.

export default function PurchaseBillDetailPage() {
  const router = useRouter()
  const { u, companyId, branchId, billId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/bills`

  const [bill, setBill] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    const [{ data: billData, error: billError }, { data: lineData }, { data: paymentData }] =
      await Promise.all([
        supabase
          .from('purchase_bills_view')
          .select(
            `id, bill_number, effective_status, issued_at, due_date, total, subtotal, tax, paid,
             supplier_reference, notes,
             supplier:suppliers(id, name),
             purchase_order:purchase_orders(id, order_number),
             purchase_receipt:purchase_receipts(id, receipt_number)`
          )
          .eq('id', billId)
          .eq('branch', branchId)
          .single(),
        supabase
          .from('purchase_bill_line_items')
          .select('id, description_snapshot, quantity, unit_price_snapshot, line_total, variant')
          .eq('purchase_bill', billId),
        supabase
          .from('purchase_bill_payments')
          .select('id, amount, paid_at, method, reference, notes')
          .eq('purchase_bill', billId)
          .order('paid_at', { ascending: false }),
      ])

    if (billError) {
      setLoadError(billError.message || 'Could not load this bill.')
      setLoading(false)
      return
    }

    setBill(billData)
    setLineItems(lineData || [])
    setPayments(paymentData || [])
    setLoading(false)
  }, [billId, branchId])

  useEffect(() => {
    load()
  }, [load])

  const handleRecordPayment = async (event) => {
    event.preventDefault()
    setPaymentError('')

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setPaymentError('Enter an amount greater than zero.')
      return
    }

    setRecordingPayment(true)
    const { error } = await supabase.rpc('record_purchase_bill_payment', {
      p_purchase_bill: billId,
      p_amount: Number(paymentAmount),
      p_paid_at: paymentDate || new Date().toISOString(),
      p_method: paymentMethod || null,
      p_reference: paymentReference || null,
    })
    setRecordingPayment(false)

    if (error) {
      setPaymentError(error.message || 'Could not record this payment.')
      return
    }

    setPaymentAmount('')
    setPaymentDate('')
    setPaymentMethod('')
    setPaymentReference('')
    load()
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this bill? This cannot be undone.')) return
    setCancelling(true)
    setCancelError('')

    const { error } = await supabase.rpc('cancel_purchase_bill', { p_purchase_bill: billId })
    setCancelling(false)

    if (error) {
      setCancelError(error.message || 'Could not cancel this bill.')
      return
    }

    load()
  }

  if (loading) {
    return <p className="p-6 text-xs text-gray-400">Loading bill...</p>
  }

  if (loadError || !bill) {
    return <p className="p-6 text-xs text-red-600">{loadError || 'Bill not found.'}</p>
  }

  const balance = Number(bill.total || 0) - Number(bill.paid || 0)
  const canCancel = Number(bill.paid || 0) <= 0 && bill.effective_status !== 'cancelled'

  return (
    <div className="space-y-3 bg-yellow-400">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">{bill.bill_number}</h1>
            <StatusBadge status={bill.effective_status} />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {bill.supplier?.name} ·{' '}
            <Link
              href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders/${bill.purchase_order?.id}`}
              className="text-core hover:underline"
            >
              {bill.purchase_order?.order_number}
            </Link>
            {bill.purchase_receipt && (
              <>
                {' · '}
                <Link
                  href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/receipts/${bill.purchase_receipt.id}`}
                  className="text-core hover:underline"
                >
                  {bill.purchase_receipt.receipt_number}
                </Link>
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(`${base}/${billId}/edit`)}>
            Edit bill
          </Button>
          {canCancel && (
            <Button type="button" variant="outline" disabled={cancelling} onClick={handleCancel}>
              {cancelling ? 'Cancelling...' : 'Cancel bill'}
            </Button>
          )}
        </div>
      </div>

      {cancelError && <p className="text-xs text-red-600">{cancelError}</p>}

      <section className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-4">
        <div>
          <p className="text-[11px] text-gray-500">Issued</p>
          <p className="text-sm text-gray-800">{bill.issued_at ? new Date(bill.issued_at).toLocaleDateString() : '—'}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500">Due</p>
          <p className="text-sm text-gray-800">{bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '—'}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500">Total</p>
          <p className="text-sm font-medium text-gray-900">{formatNaira(bill.total)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500">Balance remaining</p>
          <p className={`text-sm font-medium ${balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {formatNaira(balance)}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-800">Line items</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2 text-right">Unit price</th>
                <th className="px-3 py-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineItems.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2 text-gray-800">{line.description_snapshot || '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{line.quantity}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatNaira(line.unit_price_snapshot)}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800">{formatNaira(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 text-xs">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right text-gray-500">Subtotal</td>
                <td className="px-3 py-2 text-right text-gray-700">{formatNaira(bill.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right text-gray-500">Tax</td>
                <td className="px-3 py-2 text-right text-gray-700">{formatNaira(bill.tax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {bill.notes && <p className="text-xs text-gray-500">Notes: {bill.notes}</p>}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Payment history</h2>
          {payments.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
              No payments recorded yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Method</th>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-3 py-2 text-gray-700">{new Date(payment.paid_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-gray-700">{payment.method || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{payment.reference || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-800">{formatNaira(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {balance > 0 && bill.effective_status !== 'cancelled' && (
          <form onSubmit={handleRecordPayment} className="space-y-3 rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-800">Record a payment</h2>

            {paymentError && <p className="text-xs text-red-600">{paymentError}</p>}

            <label className="block text-xs font-medium text-gray-700">
              Amount <span className="text-red-500">*</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={balance}
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                className="mt-1 h-auto w-full text-sm"
              />
              <span className="mt-0.5 block text-[11px] font-normal text-gray-400">
                Remaining balance: {formatNaira(balance)}
              </span>
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Date
              <Input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="mt-1 h-auto w-full text-sm"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Method
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1 h-auto w-full text-sm">
                  <SelectValue placeholder="Select a method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Reference
              <Input
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                placeholder="Transfer ID, cheque number, etc."
                className="mt-1 h-auto w-full text-sm"
              />
            </label>

            <Button type="submit" className="bg-core text-white" disabled={recordingPayment}>
              {recordingPayment ? 'Recording...' : 'Record payment'}
            </Button>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-800">Attachments</h2>
        <AttachmentList
          entityType="purchase_bill"
          entityId={billId}
          companyId={companyId}
          branchId={branchId}
          moduleKey="purchases-bills"
          canAdd={bill.effective_status !== 'cancelled'}
          canDelete={bill.effective_status !== 'cancelled'}
        />
      </section>
    </div>
  )
}