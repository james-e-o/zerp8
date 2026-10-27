'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import supabase from '@/config/supabaseClient'
import {
  CREDIT_TYPES,
  Notice,
  Pill,
  SectionCard,
  Stat,
  formatDate,
  inputClass,
  messageOf,
  useMoney,
} from '@/components/modules/purchases/supplier-credit-shared'

// Goes at suppliers/[supplierId]/credits/[creditId]/page.js.
//
// One credit document: how much it is worth, where it has gone (bills it was
// applied to, refunds taken against it), which returns it covers, and what
// is left. From here you can apply what is left to an unpaid bill, un-apply
// it, record a cash refund against it (supplier credit notes only), or void
// it while nothing has been taken from it.

export default function SupplierCreditDetailPage() {
  const { u, companyId, branchId, supplierId, creditId } = useParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases`

  const [credit, setCredit] = useState(null)
  const [allocations, setAllocations] = useState([])
  const [refunds, setRefunds] = useState([])
  const [returns, setReturns] = useState([])
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState(null)

  const [billId, setBillId] = useState('')
  const [applyAmount, setApplyAmount] = useState('')
  const [working, setWorking] = useState(false)
  const [confirm, setConfirm] = useState(null) // { kind: 'unapply' | 'void', id? }

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    const [creditRes, allocRes, refundRes, returnRes, billRes] = await Promise.all([
      supabase
        .from('supplier_credits')
        .select('id, kind, credit_number, credit_date, amount, applied_amount, refunded_amount, remaining_amount, status, notes, supplier')
        .eq('id', creditId)
        .eq('branch', branchId)
        .maybeSingle(),
      supabase
        .from('supplier_credit_allocations')
        .select('id, amount, created_at, bill:purchase_bills ( id, bill_number )')
        .eq('credit', creditId)
        .order('created_at', { ascending: false }),
      supabase
        .from('supplier_refunds')
        .select('id, refund_date, amount, method, reference')
        .eq('credit', creditId)
        .order('refund_date', { ascending: false }),
      supabase
        .from('supplier_credit_returns')
        .select('id, amount, purchase_return:purchase_returns ( id, return_number )')
        .eq('credit', creditId),
      supabase
        .from('purchase_bills')
        .select('id, bill_number, status, total, paid, credit_applied')
        .eq('supplier', supplierId)
        .eq('branch', branchId)
        .in('status', ['unpaid', 'partially_paid'])
        .order('issued_at', { ascending: true }),
    ])

    const failure = creditRes.error || allocRes.error || refundRes.error || returnRes.error || billRes.error
    if (failure) {
      console.error('Failed to load credit:', failure)
      setErrorMessage(failure.message || 'Could not load this credit.')
    } else if (!creditRes.data) {
      setErrorMessage('Credit not found.')
    } else {
      setCredit(creditRes.data)
      setAllocations(allocRes.data || [])
      setRefunds(refundRes.data || [])
      setReturns(returnRes.data || [])
      setBills(
        (billRes.data || [])
          .map((bill) => ({
            ...bill,
            due: Number(bill.total || 0) - Number(bill.paid || 0) - Number(bill.credit_applied || 0),
          }))
          .filter((bill) => bill.due > 0)
      )
    }
    setLoading(false)
  }, [creditId, branchId, supplierId])

  useEffect(() => {
    load()
  }, [load])

  const selectedBill = bills.find((bill) => bill.id === billId)
  const remaining = Number(credit?.remaining_amount || 0)

  const pickBill = (id) => {
    setBillId(id)
    const bill = bills.find((item) => item.id === id)
    setApplyAmount(bill ? String(Math.min(bill.due, remaining)) : '')
  }

  const apply = async () => {
    setWorking(true)
    setResult(null)
    const { error } = await supabase.rpc('apply_supplier_credit_to_bill', {
      p_credit: creditId,
      p_bill: billId,
      p_amount: Number(applyAmount),
    })
    setWorking(false)
    if (error) {
      setResult({ ok: false, lines: [messageOf(error)] })
      return
    }
    setBillId('')
    setApplyAmount('')
    setResult({ ok: true, lines: ['Credit applied to the bill.'] })
    load()
  }

  const runConfirmed = async () => {
    const action = confirm
    setWorking(true)
    setResult(null)
    const { error } =
      action.kind === 'unapply'
        ? await supabase.rpc('unapply_supplier_credit', { p_allocation: action.id })
        : await supabase.rpc('void_supplier_credit', { p_credit: creditId })
    setWorking(false)
    setConfirm(null)
    if (error) {
      setResult({ ok: false, lines: [messageOf(error)] })
      return
    }
    setResult({ ok: true, lines: [action.kind === 'unapply' ? 'Credit taken back from the bill.' : 'Credit voided.'] })
    load()
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading...</p>

  if (errorMessage || !credit) {
    return (
      <div className="space-y-4 p-4 text-xs">
        <Link href={`${base}/suppliers/${supplierId}/credits`}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back
          </Button>
        </Link>
        <div role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMessage || 'Credit not found.'}
        </div>
      </div>
    )
  }

  const type = CREDIT_TYPES[credit.kind]
  const isVoid = credit.status === 'void'
  const untouched = Number(credit.applied_amount) === 0 && Number(credit.refunded_amount) === 0

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`${base}/suppliers/${supplierId}/credits`}>
            <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
              <ArrowLeft className="mr-1.5 size-3.5" /> Back
            </Button>
          </Link>
          <h1 className="text-sm font-semibold text-foreground">{credit.credit_number}</h1>
          <Pill className={type.className}>{type.label}</Pill>
          {isVoid && <Pill className="bg-red-50 text-red-700">Void</Pill>}
        </div>
        <div className="flex items-center gap-2">
          {credit.kind === 'credit_note' && !isVoid && remaining > 0 && (
            <Link href={`${base}/suppliers/${supplierId}/refunds/new?credit=${credit.id}`}>
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
                Record refund against this
              </Button>
            </Link>
          )}
          {!isVoid && untouched && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-sm text-xs"
              onClick={() => setConfirm({ kind: 'void' })}
            >
              Void
            </Button>
          )}
        </div>
      </div>

      <Notice result={result} onDismiss={() => setResult(null)} />

      {credit.kind === 'debit_note' && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
          We issued this ourselves. The supplier has not acknowledged it.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total" value={money(credit.amount)} hint={formatDate(credit.credit_date)} />
        <Stat label="Applied to bills" value={money(credit.applied_amount)} />
        <Stat label="Refunded in cash" value={money(credit.refunded_amount)} />
        <Stat label="Remaining" value={money(isVoid ? 0 : credit.remaining_amount)} />
      </div>

      {credit.notes && (
        <p className="whitespace-pre-wrap rounded-sm border border-border bg-card p-3 text-foreground">{credit.notes}</p>
      )}

      {!isVoid && remaining > 0 && (
        <SectionCard title="Apply to a bill">
          {bills.length === 0 ? (
            <p className="p-4 text-muted-foreground">This supplier has no unpaid bills to apply it to.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3 p-4">
              <label className="block min-w-56">
                <span className="text-[10px] text-muted-foreground">Bill</span>
                <select value={billId} onChange={(event) => pickBill(event.target.value)} className={`${inputClass} mt-1`}>
                  <option value="">Choose a bill...</option>
                  {bills.map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      {bill.bill_number} - {money(bill.due)} due
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] text-muted-foreground">Amount</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={applyAmount}
                  onChange={(event) => setApplyAmount(event.target.value)}
                  className="mt-1 h-8 w-32 text-xs"
                />
              </label>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-core text-xs text-white hover:bg-core/90"
                disabled={
                  working ||
                  !selectedBill ||
                  !(Number(applyAmount) > 0) ||
                  Number(applyAmount) > Math.min(remaining, selectedBill?.due || 0)
                }
                onClick={apply}
              >
                {working ? 'Applying...' : 'Apply'}
              </Button>
              {selectedBill && (
                <span className="text-[11px] text-muted-foreground">
                  Up to {money(Math.min(remaining, selectedBill.due))} (the smaller of what is left on the credit and what the bill still owes).
                </span>
              )}
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Applied to bills">
        {allocations.length === 0 ? (
          <p className="p-4 text-muted-foreground">Not applied to any bill yet.</p>
        ) : (
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {allocations.map((allocation) => (
                <tr key={allocation.id}>
                  <td className="px-4 py-2 font-medium">
                    <Link href={`${base}/bills/${allocation.bill?.id}`} className="text-core hover:underline">
                      {allocation.bill?.bill_number || 'Bill'}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(allocation.created_at)}</td>
                  <td className="px-4 py-2 text-right">{money(allocation.amount)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 rounded-sm text-[11px]"
                      onClick={() => setConfirm({ kind: 'unapply', id: allocation.id })}
                    >
                      Un-apply
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {refunds.length > 0 && (
        <SectionCard title="Refunded in cash">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {refunds.map((refund) => (
                <tr key={refund.id}>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(refund.refund_date)}</td>
                  <td className="px-4 py-2">{refund.method || '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{refund.reference || '—'}</td>
                  <td className="px-4 py-2 text-right">{money(refund.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      <SectionCard title="Returns it covers">
        {returns.length === 0 ? (
          <p className="p-4 text-muted-foreground">Not tied to a return.</p>
        ) : (
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {returns.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 font-medium">
                    <Link href={`${base}/returns/${row.purchase_return?.id}`} className="text-core hover:underline">
                      {row.purchase_return?.return_number || 'Return'}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">{money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && !working && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {confirm?.kind === 'void' ? 'Void this credit?' : 'Take the credit back from this bill?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {confirm?.kind === 'void'
                ? 'It stops counting towards what you are owed. Returns tied to it go back to "awaiting".'
                : 'The bill owes that amount again and the credit has it back to use elsewhere.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs" disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-7 bg-core text-xs text-white hover:bg-core/90" disabled={working} onClick={runConfirmed}>
              {confirm?.kind === 'void' ? 'Void' : 'Un-apply'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
