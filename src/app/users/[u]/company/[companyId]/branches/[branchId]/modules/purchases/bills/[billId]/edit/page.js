'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import supabase from '@/config/supabaseClient'
import { formatNaira } from '@/components/modules/sales/dummy-data'
import { useVariantNames } from '@/components/modules/purchases/purchase-catalog'

// Edit a supplier bill: route .../purchases/bills/[billId]/edit
//
// What can be changed depends on the bill's state (the database enforces the
// same rules, this page just doesn't offer what it would refuse):
//
//   unpaid / overdue, nothing paid, no credit applied
//        -> everything: reference, dates, tax, notes, and each line's
//           quantity and price (lines can also be removed).
//   partially paid, or any credit applied
//        -> only supplier reference, dates and notes. Money has already been
//           applied to the bill's total, so the amounts are locked.
//   paid, cancelled, draft
//        -> not editable. Correct a paid bill with a debit or credit note.
//
// Lines come in two kinds: lines on the purchase order, and accepted extras
// (excess / unexpected goods). Neither kind can bill more than what is left.

const EDITABLE = ['unpaid', 'overdue', 'partially_paid']

const toDateInput = (value) => (value ? String(value).slice(0, 10) : '')

export default function EditBillPage() {
  const router = useRouter()
  const { u, companyId, branchId, billId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/bills`

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [bill, setBill] = useState(null)
  const [lines, setLines] = useState([]) // { id, kind, refId, variant, description, quantity, price, cap, removed }
  const [supplierReference, setSupplierReference] = useState('')
  const [billDate, setBillDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [tax, setTax] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const { names: variantNames } = useVariantNames(lines.map((line) => line.variant))

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    const [{ data: billData, error: billError }, { data: lineData, error: lineError }] = await Promise.all([
      supabase
        .from('purchase_bills_view')
        .select(
          'id, bill_number, effective_status, issued_at, due_date, total, subtotal, tax, paid, credit_applied, supplier_reference, notes, supplier:suppliers(id, name), purchase_order:purchase_orders(id, order_number)'
        )
        .eq('id', billId)
        .eq('branch', branchId)
        .single(),
      supabase
        .from('purchase_bill_line_items')
        .select('id, description_snapshot, quantity, unit_price_snapshot, variant, purchase_order_line_item, purchase_receipt_hold')
        .eq('purchase_bill', billId),
    ])

    if (billError || lineError || !billData) {
      setLoadError(billError?.message || lineError?.message || 'Bill not found.')
      setLoading(false)
      return
    }

    const poLineIds = (lineData || []).map((l) => l.purchase_order_line_item).filter(Boolean)
    const holdIds = (lineData || []).map((l) => l.purchase_receipt_hold).filter(Boolean)

    const [{ data: poLines }, { data: holds }] = await Promise.all([
      poLineIds.length
        ? supabase.from('purchase_order_line_items').select('id, quantity_ordered, quantity_billed').in('id', poLineIds)
        : Promise.resolve({ data: [] }),
      holdIds.length
        ? supabase.from('purchase_receipt_holds').select('id, kind, quantity, quantity_billed').in('id', holdIds)
        : Promise.resolve({ data: [] }),
    ])

    const poById = Object.fromEntries((poLines || []).map((l) => [l.id, l]))
    const holdById = Object.fromEntries((holds || []).map((h) => [h.id, h]))

    setBill(billData)
    setSupplierReference(billData.supplier_reference || '')
    setBillDate(toDateInput(billData.issued_at))
    setDueDate(toDateInput(billData.due_date))
    setTax(billData.tax ?? '')
    setNotes(billData.notes || '')
    setLines(
      (lineData || []).map((l) => {
        const current = Number(l.quantity || 0)
        const isHold = Boolean(l.purchase_receipt_hold)
        const source = isHold ? holdById[l.purchase_receipt_hold] : poById[l.purchase_order_line_item]
        // What this bill may bill at most: what is left to bill, plus what
        // this bill itself already covers.
        const cap = source
          ? isHold
            ? Number(source.quantity || 0) - Number(source.quantity_billed || 0) + current
            : Number(source.quantity_ordered || 0) - Number(source.quantity_billed || 0) + current
          : current
        return {
          id: l.id,
          kind: isHold ? (holdById[l.purchase_receipt_hold]?.kind === 'excess' ? 'excess' : 'unexpected') : 'order',
          purchase_order_line_item: l.purchase_order_line_item,
          purchase_receipt_hold: l.purchase_receipt_hold,
          variant: l.variant,
          description: l.description_snapshot || '',
          quantity: String(current),
          price: String(l.unit_price_snapshot ?? ''),
          cap,
          removed: false,
        }
      })
    )
    setLoading(false)
  }, [billId, branchId])

  useEffect(() => {
    load()
  }, [load])

  const status = bill?.effective_status
  const amountsLocked = Number(bill?.paid || 0) > 0 || Number(bill?.credit_applied || 0) > 0
  const editable = bill && EDITABLE.includes(status)

  const computed = useMemo(
    () =>
      lines.map((line) => {
        const quantity = Number(line.quantity || 0)
        const price = Number(line.price || 0)
        return {
          ...line,
          q: quantity,
          p: price,
          total: line.removed ? 0 : quantity * price,
          over: !line.removed && quantity > line.cap,
        }
      }),
    [lines]
  )

  const subtotal = computed.reduce((sum, line) => sum + line.total, 0)
  const total = amountsLocked ? Number(bill?.total || 0) : subtotal + Number(tax || 0)
  const hasOver = computed.some((line) => line.over)
  const activeLines = computed.filter((line) => !line.removed)

  const updateLine = (id, patch) =>
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)))

  const handleSave = async () => {
    setSubmitError('')

    if (!amountsLocked) {
      if (activeLines.length === 0) {
        setSubmitError('A bill needs at least one line. To remove the whole bill, cancel it instead.')
        return
      }
      if (activeLines.some((line) => !(line.q > 0))) {
        setSubmitError('Every line needs a quantity above zero. Remove the line if it is not on this bill.')
        return
      }
      if (hasOver) {
        setSubmitError('One or more lines bill more than what is left to bill. Fix the lines shown in red.')
        return
      }
    }

    setSaving(true)

    const payload = {
      p_bill: billId,
      p_supplier_reference: supplierReference || null,
      p_bill_date: billDate || null,
      p_due_date: dueDate || null,
      p_tax: amountsLocked ? Number(bill.tax || 0) : Number(tax || 0),
      p_notes: notes || null,
      p_line_items: amountsLocked
        ? null
        : activeLines.map((line) => ({
            purchase_order_line_item: line.purchase_order_line_item || null,
            purchase_receipt_hold: line.purchase_receipt_hold || null,
            variant: line.variant,
            description_snapshot: line.description,
            quantity: line.q,
            unit_price_snapshot: line.p,
            line_total: line.total,
          })),
    }

    const { error } = await supabase.rpc('update_purchase_bill', payload)
    setSaving(false)

    if (error) {
      setSubmitError(error.message || 'Could not save this bill.')
      return
    }
    router.push(`${base}/${billId}`)
  }

  if (loading) return <p className="p-6 text-xs text-gray-400">Loading bill...</p>
  if (loadError || !bill) return <p className="p-6 text-xs text-red-600">{loadError || 'Bill not found.'}</p>

  if (!editable) {
    const why =
      status === 'paid'
        ? 'This bill is fully paid. To correct it, record a debit note or supplier credit.'
        : status === 'cancelled'
          ? 'This bill is cancelled and can no longer be changed.'
          : status === 'draft'
            ? 'This is a draft. Open it from Draft Bills to continue it.'
            : 'This bill cannot be edited in its current state.'
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-base font-bold text-slate-900">{bill.bill_number}</h1>
        <p className="text-xs text-gray-600">{why}</p>
        <Button type="button" variant="outline" className="h-6 text-xs" onClick={() => router.push(`${base}/${billId}`)}>
          Back to bill
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-none flex-col space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900">Edit {bill.bill_number}</h1>
          <p className="text-xs text-gray-500">
            {bill.supplier?.name} · {bill.purchase_order?.order_number}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" className="h-6 text-xs" onClick={() => router.push(`${base}/${billId}`)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="h-6 bg-core text-xs text-white hover:bg-core/90"
            disabled={saving || (!amountsLocked && hasOver)}
            onClick={handleSave}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>

      {submitError && <p className="text-xs text-red-600">{submitError}</p>}

      {amountsLocked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
          {Number(bill.paid || 0) > 0 ? 'Payments' : 'A credit'} {Number(bill.paid || 0) > 0 && Number(bill.credit_applied || 0) > 0 ? 'and credit have' : 'has'} already been applied to this bill, so
          its lines and amounts are locked. You can change the supplier reference, dates and notes. To correct
          the amounts, use a debit note or supplier credit.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <label className="col-span-2 text-xs font-medium text-gray-800 lg:col-span-1">
          Supplier's invoice/reference number
          <Input
            value={supplierReference}
            onChange={(event) => setSupplierReference(event.target.value)}
            className="mt-1 h-auto w-full text-sm"
          />
        </label>
        <label className="text-xs font-medium text-gray-800">
          Bill date
          <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="mt-1 h-auto w-full text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-800">
          Due date
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 h-auto w-full text-sm" />
        </label>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-800">Line items</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-gray-50 text-[11px] text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Line total</th>
                {!amountsLocked && <th className="w-9 px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {computed.map((line) => (
                <tr key={line.id} className={line.removed ? 'bg-gray-50/70 opacity-50' : ''}>
                  <td className="max-w-[260px] px-3 py-2">
                    <p className="text-[10px] leading-[1.15] text-gray-800">
                      {variantNames[line.variant]?.display || line.description || '—'}
                    </p>
                    {line.kind !== 'order' && (
                      <span className="mt-0.5 inline-flex rounded-sm bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">
                        {line.kind === 'excess' ? 'Excess' : 'Not on order'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {amountsLocked ? (
                      line.q
                    ) : (
                      <>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          max={line.cap}
                          disabled={line.removed}
                          value={line.quantity}
                          onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                          aria-invalid={line.over}
                          className={`h-7 w-24 text-right text-xs ${
                            line.over ? 'border-red-500 text-red-600 focus-visible:ring-red-500' : ''
                          }`}
                        />
                        {line.over && <p className="mt-0.5 text-[10px] text-red-600">Max {line.cap}</p>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {amountsLocked ? (
                      formatNaira(line.p)
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={line.removed}
                        value={line.price}
                        onChange={(event) => updateLine(line.id, { price: event.target.value })}
                        className="h-7 w-28 text-right text-xs"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800">
                    {amountsLocked ? formatNaira(line.q * line.p) : line.removed ? '—' : formatNaira(line.total)}
                  </td>
                  {!amountsLocked && (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => updateLine(line.id, { removed: !line.removed })}
                        className="text-gray-400 hover:text-red-600"
                        aria-label={line.removed ? 'Keep this line' : 'Remove this line'}
                        title={line.removed ? 'Keep this line' : 'Remove this line'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!amountsLocked && (
          <p className="text-[11px] text-gray-500">
            To add more goods to a bill, raise a separate bill for them.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3 sm:grid-cols-3 sm:items-end sm:gap-4">
        <div>
          <p className="text-xs font-medium text-gray-700">Subtotal</p>
          <p className="mt-1 text-sm text-gray-800">{formatNaira(amountsLocked ? Number(bill.subtotal || 0) : subtotal)}</p>
        </div>
        <label className="text-xs font-medium text-gray-700">
          Tax / VAT
          {amountsLocked ? (
            <p className="mt-1 text-sm font-normal text-gray-800">{formatNaira(Number(bill.tax || 0))}</p>
          ) : (
            <Input
              type="number"
              min="0"
              step="0.01"
              value={tax}
              onChange={(event) => setTax(event.target.value)}
              className="mt-1 h-auto w-full bg-white text-sm"
            />
          )}
        </label>
        <div className="flex flex-col gap-0.5 border-t border-gray-200 pt-3 sm:border-t-0 sm:pt-0 sm:text-right">
          <span className="text-xs font-medium text-gray-700">Total</span>
          <span className="text-xl font-bold tracking-tight text-slate-900">{formatNaira(total)}</span>
        </div>
      </div>

      <label className="text-xs font-medium text-gray-700">
        Notes
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-1 min-h-24 bg-white text-xs"
        />
      </label>
    </div>
  )
}
