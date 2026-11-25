'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Stat, formatDate, useMoney } from '@/components/modules/procurement/supplier-credit-shared'

// suppliers/[supplierId]/payments/new/page.js
// Pay a supplier with one transfer.
//
// One payment can settle several bills. The page proposes a split, oldest due
// date first, and every amount can be changed. Whatever is not given to a bill
// is kept as an advance on the supplier and is used on their next bill.
//
// The database does the real work and the real checks (pay_supplier): the
// split is only a proposal until it is saved. Items that are not in the product
// catalog are unpayable, so they are left out of what a bill can take.

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

const todayInput = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Oldest due date first, bills with no due date last, then the oldest bill.
const byOldestDue = (a, b) => {
  const da = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
  const db = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
  if (da !== db) return da - db
  const ia = new Date(a.issued_at || a.created_at).getTime()
  const ib = new Date(b.issued_at || b.created_at).getTime()
  return ia - ib
}

export default function PaySupplierPage() {
  const { u, companyId, branchId, supplierId } = useParams()
  const router = useRouter()
  const money = useMoney()
  const procurementBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/procurement`
  const base = `${procurementBase}/suppliers/${supplierId}`

  const [supplier, setSupplier] = useState(null)
  const [position, setPosition] = useState(null)
  const [bills, setBills] = useState([]) // open bills that can still take money
  const [loading, setLoading] = useState(true)

  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(todayInput())
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [split, setSplit] = useState({}) // { [billId]: '1000' }
  const [edited, setEdited] = useState(false) // true once the person changes a split amount

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    const [supplierRes, billRes, positionRes] = await Promise.all([
      supabase.from('suppliers').select('id, name').eq('id', supplierId).maybeSingle(),
      supabase
        .from('purchase_bills')
        .select('id, bill_number, due_date, issued_at, created_at, total, paid, credit_applied, status')
        .eq('supplier', supplierId)
        .eq('branch', branchId)
        .in('status', ['unpaid', 'partially_paid']),
      supabase.rpc('supplier_payment_position', { p_branch: branchId, p_supplier: supplierId }),
    ])

    const failure = supplierRes.error || billRes.error
    if (failure) {
      console.error('Could not load this supplier\'s bills:', failure)
      toast.error(failure.message || 'Could not load this supplier\'s bills.')
      setLoading(false)
      return
    }
    if (positionRes.error) {
      console.error('Could not load the supplier balance:', positionRes.error)
      toast.error(positionRes.error.message || 'Could not load the supplier balance.')
    }

    const rows = billRes.data || []
    // Money for items not in the catalog cannot be paid, so it is taken off
    // what each bill can accept.
    const unpayableByBill = {}
    if (rows.length > 0) {
      const { data: flagged, error: flaggedError } = await supabase
        .from('purchase_bill_line_items')
        .select('purchase_bill, line_total')
        .in('purchase_bill', rows.map((row) => row.id))
        .eq('is_unlisted', true)
      if (flaggedError) {
        console.error('Could not load the unpayable items:', flaggedError)
        toast.error(flaggedError.message || 'Could not load the unpayable items.')
      }
      ;(flagged || []).forEach((line) => {
        unpayableByBill[line.purchase_bill] =
          (unpayableByBill[line.purchase_bill] || 0) + Number(line.line_total || 0)
      })
    }

    const open = rows
      .map((row) => {
        const owed = Number(row.total || 0) - Number(row.paid || 0) - Number(row.credit_applied || 0)
        const unpayable = unpayableByBill[row.id] || 0
        return { ...row, owed, unpayable, payable: round2(Math.max(owed - unpayable, 0)) }
      })
      .filter((row) => row.payable > 0.005)
      .sort(byOldestDue)

    setSupplier(supplierRes.data || null)
    setPosition(positionRes.data || null)
    setBills(open)
    setLoading(false)
  }, [supplierId, branchId])

  useEffect(() => {
    load()
  }, [load])

  // The proposal: oldest due date first, same rule the database uses.
  const proposeSplit = useCallback(
    (total) => {
      let left = round2(total)
      const next = {}
      bills.forEach((bill) => {
        if (left <= 0.005) return
        const take = Math.min(left, bill.payable)
        next[bill.id] = String(round2(take))
        left = round2(left - take)
      })
      return next
    },
    [bills]
  )

  // Until a split amount is edited by hand, the split follows the amount.
  useEffect(() => {
    if (!edited) setSplit(proposeSplit(Number(amount) || 0))
  }, [amount, edited, proposeSplit])

  const amountNumber = Number(amount) || 0
  const allocated = useMemo(
    () => round2(bills.reduce((sum, bill) => sum + (Number(split[bill.id]) || 0), 0)),
    [bills, split]
  )
  const advance = round2(Math.max(amountNumber - allocated, 0))
  const overAllocated = allocated > amountNumber + 0.005
  const totalPayable = round2(bills.reduce((sum, bill) => sum + bill.payable, 0))

  const rowProblem = (bill) => {
    const value = Number(split[bill.id]) || 0
    if (value < 0) return 'Cannot be negative'
    if (value > bill.payable + 0.005) return `This bill can only take ${money(bill.payable)}`
    return ''
  }

  const validate = () => {
    if (!amountNumber || amountNumber <= 0) return 'Enter an amount greater than zero.'
    if (overAllocated) return 'The split adds up to more than the amount paid.'
    const bad = bills.find((bill) => rowProblem(bill))
    if (bad) return `${bad.bill_number}: ${rowProblem(bad)}`
    return ''
  }

  const handlePayClick = (event) => {
    event.preventDefault()
    setFormError('')
    const problem = validate()
    if (problem) {
      setFormError(problem)
      toast.error(problem)
      return
    }
    // Paying more than is owed keeps the extra as an advance: make that a
    // deliberate step.
    if (advance > 0.005) {
      setConfirmOpen(true)
      return
    }
    handlePay()
  }

  const handlePay = async () => {
    setSaving(true)
    const allocations = bills
      .map((bill) => ({ purchase_bill: bill.id, amount: round2(Number(split[bill.id]) || 0) }))
      .filter((row) => row.amount > 0)

    const { data, error } = await supabase.rpc('pay_supplier', {
      p_branch: branchId,
      p_supplier: supplierId,
      p_amount: amountNumber,
      p_paid_at: paidOn ? new Date(`${paidOn}T12:00:00`).toISOString() : new Date().toISOString(),
      p_method: method || null,
      p_reference: reference.trim() || null,
      p_notes: notes.trim() || null,
      p_allocations: allocations,
    })
    setSaving(false)
    setConfirmOpen(false)

    if (error) {
      console.error('Could not record this payment:', error)
      setFormError(error.message || 'Could not record this payment.')
      toast.error(error.message || 'Could not record this payment.')
      return
    }

    const kept = Number(data?.advance || 0)
    toast.success(
      kept > 0
        ? `Payment recorded. ${money(kept)} is kept as an advance.`
        : 'Payment recorded.'
    )
    router.push(`${base}/payments`)
  }

  if (loading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading...</p>
  }

  return (
    <form onSubmit={handlePayClick} className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={base}>
            <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
              <ArrowLeft className="mr-1.5 size-3.5" /> Back
            </Button>
          </Link>
          <h1 className="text-sm font-semibold text-foreground">Pay {supplier?.name || 'supplier'}</h1>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Owed on open bills" value={money(position?.owed)} />
        <Stat
          label="Payable now"
          value={money(position?.payable)}
          hint={
            Number(position?.unpayable || 0) > 0
              ? `${money(position.unpayable)} is for items not in the catalog yet`
              : undefined
          }
        />
        <Stat label="Advance held" value={money(position?.advance)} />
        <Stat label="Credit notes left" value={money(position?.credit_notes)} />
      </div>

      <section className="rounded-sm border border-border bg-card">
        <h2 className="border-b border-border bg-muted px-4 py-3 text-xs font-semibold text-foreground">
          Payment
        </h2>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[11px] font-medium text-gray-700">
            Amount paid
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-0.5 h-7 w-full text-xs"
            />
          </label>
          <label className="block text-[11px] font-medium text-gray-700">
            Date paid
            <Input
              type="date"
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
              className="mt-0.5 h-7 w-full text-xs"
            />
          </label>
          <label className="block text-[11px] font-medium text-gray-700">
            Method
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-0.5 h-7 w-full text-xs">
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
          <label className="block text-[11px] font-medium text-gray-700">
            Reference
            <Input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Transfer ID, cheque no."
              className="mt-0.5 h-7 w-full text-xs"
            />
          </label>
          <label className="block text-[11px] font-medium text-gray-700 sm:col-span-2 lg:col-span-4">
            Notes
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-0.5 min-h-16 w-full text-xs"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-sm border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-4 py-3">
          <h2 className="text-xs font-semibold text-foreground">Which bills this pays</h2>
          {edited && (
            <button
              type="button"
              onClick={() => setEdited(false)}
              className="text-[11px] text-core hover:underline"
            >
              Reset to oldest due first
            </button>
          )}
        </div>

        {bills.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No open bills can take a payment right now. Anything you pay is kept as an advance on this supplier
            and is used on their next bill.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-muted/50 text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Bill</th>
                  <th className="px-4 py-2 text-left font-medium">Due</th>
                  <th className="px-4 py-2 text-right font-medium">Can take now</th>
                  <th className="px-4 py-2 text-right font-medium">Pay</th>
                  <th className="px-4 py-2 text-right font-medium">Left after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bills.map((bill) => {
                  const value = Number(split[bill.id]) || 0
                  const problem = rowProblem(bill)
                  return (
                    <tr key={bill.id}>
                      <td className="px-4 py-2 font-medium text-foreground">
                        <Link href={`${procurementBase}/bills/${bill.id}`} className="text-core hover:underline">
                          {bill.bill_number}
                        </Link>
                        {bill.status === 'partially_paid' && (
                          <span className="ml-1.5 text-[10px] text-amber-700">Partially paid</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {bill.due_date ? formatDate(bill.due_date) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-foreground">{money(bill.payable)}</td>
                      <td className="px-4 py-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={split[bill.id] ?? ''}
                          onChange={(event) => {
                            setEdited(true)
                            setSplit((prev) => ({ ...prev, [bill.id]: event.target.value }))
                          }}
                          className={`ml-auto h-7 w-32 text-right text-xs ${problem ? 'border-red-400' : ''}`}
                          aria-label={`Amount to pay on ${bill.bill_number}`}
                        />
                        {problem && <p className="mt-0.5 text-[10px] text-red-600">{problem}</p>}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {money(Math.max(bill.payable - value, 0))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-1 border-t border-border bg-muted/30 px-4 py-3 text-xs sm:grid-cols-3">
          <p>
            <span className="text-muted-foreground">Paid: </span>
            <span className="font-medium text-foreground">{money(amountNumber)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Given to bills: </span>
            <span className={`font-medium ${overAllocated ? 'text-red-600' : 'text-foreground'}`}>
              {money(allocated)}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Kept as advance: </span>
            <span className={`font-medium ${advance > 0.005 ? 'text-amber-700' : 'text-foreground'}`}>
              {money(advance)}
            </span>
          </p>
        </div>
        {amountNumber > totalPayable + 0.005 && (
          <p className="border-t border-border px-4 py-2 text-[11px] text-amber-700">
            This is more than the {money(totalPayable)} that open bills can take. The extra is kept as an
            advance.
          </p>
        )}
      </section>

      {formError && (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Link href={base}>
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-sm text-xs">
            Cancel
          </Button>
        </Link>
        <Button
          type="submit"
          size="sm"
          disabled={saving || !amountNumber}
          className="h-8 rounded-sm bg-core text-xs text-white hover:bg-core/90"
        >
          {saving ? 'Saving...' : 'Record payment'}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !saving && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Keep {money(advance)} as an advance?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {money(allocated)} goes to bills. The other {money(advance)} is more than what the bills above can
              take, so it stays with this supplier as an advance and is used on their next bill.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs" disabled={saving}>
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-7 bg-core text-xs text-white hover:bg-core/90"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault()
                handlePay()
              }}
            >
              {saving ? 'Saving...' : 'Record payment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
