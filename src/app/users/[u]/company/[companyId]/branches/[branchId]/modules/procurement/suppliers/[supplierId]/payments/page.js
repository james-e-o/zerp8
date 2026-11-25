'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Stat, formatDate, useMoney } from '@/components/modules/procurement/supplier-credit-shared'

// suppliers/[supplierId]/payments/page.js
// Every payment made to this supplier. One row is one transfer; open it to see
// which bills it paid (the split) and any advance it left with the supplier.
// Payments made before supplier payments existed were recorded one bill at a
// time, so they are listed too, as single-bill payments.

const METHOD_LABELS = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
}

export default function SupplierPaymentsPage() {
  const { u, companyId, branchId, supplierId } = useParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/procurement`

  const [rows, setRows] = useState([])
  const [position, setPosition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      const [transferRes, singleRes, positionRes] = await Promise.all([
        supabase
          .from('supplier_remittances')
          .select(
            `id, amount, paid_at, method, reference, notes, created_at,
             advance:supplier_credits ( id, credit_number, amount ),
             purchase_bill_payments ( id, amount, bill:purchase_bills ( id, bill_number ) )`
          )
          .eq('supplier', supplierId)
          .eq('branch', branchId)
          .order('paid_at', { ascending: false })
          .limit(200),
        // Payments recorded against one bill, before or outside a transfer.
        supabase
          .from('purchase_bill_payments')
          .select('id, amount, paid_at, method, reference, notes, created_at, bill:purchase_bills!inner ( id, bill_number, supplier, branch )')
          .is('supplier_remittance', null)
          .eq('bill.supplier', supplierId)
          .eq('bill.branch', branchId)
          .order('paid_at', { ascending: false })
          .limit(200),
        supabase.rpc('supplier_payment_position', { p_branch: branchId, p_supplier: supplierId }),
      ])

      if (cancelled) return

      const failure = transferRes.error || singleRes.error
      if (failure) {
        console.error('Could not load the payments:', failure)
        toast.error(failure.message || 'Could not load the payments.')
        setLoading(false)
        return
      }
      if (positionRes.error) {
        console.error('Could not load the supplier balance:', positionRes.error)
        toast.error(positionRes.error.message || 'Could not load the supplier balance.')
      }

      const transfers = (transferRes.data || []).map((row) => ({
        key: `t-${row.id}`,
        id: row.id,
        paid_at: row.paid_at,
        amount: Number(row.amount || 0),
        method: row.method,
        reference: row.reference,
        notes: row.notes,
        bills: (row.purchase_bill_payments || []).map((part) => ({
          id: part.bill?.id,
          number: part.bill?.bill_number,
          amount: Number(part.amount || 0),
        })),
        advance: row.advance || null,
      }))

      const singles = (singleRes.data || []).map((row) => ({
        key: `s-${row.id}`,
        id: row.id,
        paid_at: row.paid_at,
        amount: Number(row.amount || 0),
        method: row.method,
        reference: row.reference,
        notes: row.notes,
        bills: [{ id: row.bill?.id, number: row.bill?.bill_number, amount: Number(row.amount || 0) }],
        advance: null,
      }))

      setRows(
        [...transfers, ...singles].sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)))
      )
      setPosition(positionRes.data || null)
      setLoading(false)
    }

    if (supplierId && branchId) load()
    return () => {
      cancelled = true
    }
  }, [supplierId, branchId])

  return (
    <div className="space-y-4 text-xs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Owed on open bills" value={money(position?.owed)} />
        <Stat label="Payable now" value={money(position?.payable)} />
        <Stat label="Advance held" value={money(position?.advance)} />
        <Stat label="Credit notes left" value={money(position?.credit_notes)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Payments</h2>
        <Link
          href={`${base}/suppliers/${supplierId}/payments/new`}
          className="rounded-sm bg-core px-3 py-1.5 text-xs font-medium text-white hover:bg-core/90"
        >
          Pay supplier
        </Link>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No payments to this supplier yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Reference</th>
                <th className="px-4 py-2 text-left font-medium">Method</th>
                <th className="px-4 py-2 text-left font-medium">Bills paid</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const open = openId === row.key
                return (
                  <FragmentRow
                    key={row.key}
                    row={row}
                    open={open}
                    onToggle={() => setOpenId(open ? null : row.key)}
                    money={money}
                    base={base}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FragmentRow({ row, open, onToggle, money, base }) {
  const billCount = row.bills.length
  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
        className="cursor-pointer hover:bg-muted/50"
      >
        <td className="px-4 py-2 text-muted-foreground">{formatDate(row.paid_at)}</td>
        <td className="px-4 py-2 font-medium text-foreground">{row.reference || '—'}</td>
        <td className="px-4 py-2 text-muted-foreground">{METHOD_LABELS[row.method] || row.method || '—'}</td>
        <td className="px-4 py-2 text-muted-foreground">
          {billCount === 0 ? 'None' : billCount === 1 ? row.bills[0].number || '1 bill' : `${billCount} bills`}
          {row.advance && (
            <span className="ml-1.5 rounded-sm bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700">
              + advance
            </span>
          )}
        </td>
        <td className="px-4 py-2 text-right font-medium text-foreground">{money(row.amount)}</td>
      </tr>
      {open && (
        <tr className="bg-muted/30">
          <td colSpan={5} className="px-4 py-3">
            <div className="space-y-1">
              {row.bills.map((part, index) => (
                <p key={`${part.id}-${index}`} className="flex justify-between gap-4">
                  <Link href={`${base}/bills/${part.id}`} className="text-core hover:underline">
                    {part.number || 'Bill'}
                  </Link>
                  <span className="text-foreground">{money(part.amount)}</span>
                </p>
              ))}
              {row.advance && (
                <p className="flex justify-between gap-4 text-amber-700">
                  <span>Kept as advance ({row.advance.credit_number})</span>
                  <span>{money(row.advance.amount)}</span>
                </p>
              )}
              {row.notes && <p className="pt-1 text-muted-foreground">{row.notes}</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
