'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import supabase from '@/config/supabaseClient'
import {
  Notice,
  SectionCard,
  formatDate,
  inputClass,
  messageOf,
  todayISO,
  useMoney,
} from '@/components/modules/purchases/supplier-credit-shared'

// suppliers/[supplierId]/credits/new/page.js
//
// Two kinds of document, same form:
//   Supplier credit note  the supplier's own document - you type their number.
//   Our debit note        we issue it ourselves when the supplier has gone
//                         quiet about goods we sent back. The number is made
//                         by the system, and it is flagged everywhere as not
//                         acknowledged by the supplier.
// Optionally ties the document to the returns it covers (and how much of it
// covers each), which is what makes a return read "recovered X of Y".
// ?type=debit_note and ?return=<id> pre-fill the form.
//
// The content is wrapped in <Suspense> below because it uses useSearchParams(),
// which Next.js requires to sit inside a Suspense boundary.

function SupplierCreditFormContent() {
  const { u, companyId, branchId, supplierId } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/suppliers/${supplierId}`

  const [kind, setKind] = useState(searchParams.get('type') === 'debit_note' ? 'debit_note' : 'credit_note')
  const [number, setNumber] = useState('')
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [supplier, setSupplier] = useState(null)
  const [returns, setReturns] = useState([])
  const [picked, setPicked] = useState({}) // returnId -> amount string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const [supplierRes, returnRes, recoveryRes] = await Promise.all([
        supabase.from('suppliers').select('id, name').eq('id', supplierId).maybeSingle(),
        supabase
          .from('purchase_returns')
          .select('id, return_number, dispatched_at, resolution')
          .eq('supplier', supplierId)
          .eq('branch', branchId)
          .eq('status', 'dispatched')
          .order('dispatched_at', { ascending: false }),
        supabase
          .from('purchase_return_recovery')
          .select('purchase_return, value, recovered, outstanding')
          .eq('supplier', supplierId)
          .eq('branch', branchId),
      ])
      if (cancelled) return

      const recovery = Object.fromEntries((recoveryRes.data || []).map((row) => [row.purchase_return, row]))
      const list = (returnRes.data || [])
        .filter((row) => !['rejected', 'write_off'].includes(row.resolution))
        .map((row) => ({ ...row, ...(recovery[row.id] || { value: 0, recovered: 0, outstanding: 0 }) }))

      setSupplier(supplierRes.data || null)
      setReturns(list)

      const preset = searchParams.get('return')
      const match = list.find((row) => row.id === preset)
      if (match) setPicked({ [match.id]: String(Number(match.outstanding) || '') })
      setLoading(false)
    }

    if (supplierId && branchId) load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, branchId])

  const pickedTotal = useMemo(
    () => Object.values(picked).reduce((sum, value) => sum + Number(value || 0), 0),
    [picked]
  )

  const toggleReturn = (row) => {
    setPicked((prev) => {
      const next = { ...prev }
      if (row.id in next) delete next[row.id]
      else next[row.id] = String(Number(row.outstanding) || '')
      return next
    })
  }

  const submit = async (event) => {
    event.preventDefault()
    setResult(null)

    const total = Number(amount)
    if (!(total > 0)) {
      setResult({ ok: false, lines: ['Enter the amount.'] })
      return
    }
    if (kind === 'credit_note' && !number.trim()) {
      setResult({ ok: false, lines: ['Enter the credit note number the supplier gave you.'] })
      return
    }
    if (pickedTotal > total) {
      setResult({ ok: false, lines: ['The returns add up to more than the credit amount.'] })
      return
    }

    setSaving(true)
    const { data, error } = await supabase.rpc('record_supplier_credit', {
      p_branch: branchId,
      p_supplier: supplierId,
      p_kind: kind,
      p_credit_number: kind === 'credit_note' ? number.trim() : null,
      p_credit_date: date,
      p_amount: total,
      p_returns: Object.entries(picked)
        .filter(([, value]) => Number(value) > 0)
        .map(([id, value]) => ({ return: id, amount: Number(value) })),
      p_notes: notes.trim() || null,
    })
    setSaving(false)

    if (error) {
      setResult({ ok: false, lines: [messageOf(error)] })
      return
    }
    router.push(`${base}/credits/${data.credit_id}`)
  }

  const isDebit = kind === 'debit_note'

  return (
    <form onSubmit={submit} className="space-y-4 text-xs">
      <div className="flex items-center gap-2">
        <Link href={`${base}/credits`}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back
          </Button>
        </Link>
        <h1 className="text-sm font-semibold text-foreground">
          {isDebit ? 'Issue a debit note' : 'Record a supplier credit note'}
          {supplier ? ` - ${supplier.name}` : ''}
        </h1>
      </div>

      <Notice result={result} onDismiss={() => setResult(null)} />

      <SectionCard title="What are you recording?">
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {[
            {
              key: 'credit_note',
              title: 'Supplier credit note',
              text: 'The supplier sent their own credit note. Enter their number.',
            },
            {
              key: 'debit_note',
              title: 'Our debit note',
              text: 'The supplier has not sent anything. We reduce what we owe them ourselves.',
            },
          ].map((option) => (
            <label
              key={option.key}
              className={`flex cursor-pointer items-start gap-2 rounded-sm border p-3 ${
                kind === option.key ? 'border-core bg-core_light/40' : 'border-border'
              }`}
            >
              <input
                type="radio"
                name="kind"
                checked={kind === option.key}
                onChange={() => setKind(option.key)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium text-foreground">{option.title}</span>
                <span className="block text-[11px] text-muted-foreground">{option.text}</span>
              </span>
            </label>
          ))}
        </div>
        {isDebit && (
          <p className="mx-4 mb-4 rounded-sm border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
            A debit note lowers what you owe this supplier, but they have not agreed to it. It is
            marked "not acknowledged by supplier" on their account so anyone reviewing can see that.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Details">
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">
              {isDebit ? 'Number' : 'Credit note number'}
            </span>
            {isDebit ? (
              <p className="mt-1 flex h-8 items-center rounded-sm border border-dashed border-border px-2 text-muted-foreground">
                Generated automatically
              </p>
            ) : (
              <Input
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                className="mt-1 h-8 text-xs"
                placeholder="e.g. CN-10492"
              />
            )}
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Amount</span>
            <Input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 h-8 text-xs"
              placeholder={pickedTotal > 0 ? String(pickedTotal) : '0.00'}
            />
          </label>
          <label className="block sm:col-span-3">
            <span className="text-[10px] text-muted-foreground">Notes</span>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 min-h-16 text-xs"
              placeholder={isDebit ? 'Why you are issuing it (for example: supplier has not replied since...)' : 'Optional'}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Returns this covers (optional)"
        action={
          pickedTotal > 0 ? (
            <span className="text-[10px] text-muted-foreground">Selected: {money(pickedTotal)}</span>
          ) : null
        }
      >
        {loading ? (
          <p className="p-4 text-muted-foreground">Loading returns...</p>
        ) : returns.length === 0 ? (
          <p className="p-4 text-muted-foreground">
            No dispatched returns for this supplier. You can still record the document without one.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-[10px] text-muted-foreground">
              <tr>
                <th className="w-8 px-4 py-2" />
                <th className="px-4 py-2 text-left font-medium">Return</th>
                <th className="px-4 py-2 text-left font-medium">Dispatched</th>
                <th className="px-4 py-2 text-right font-medium">Worth</th>
                <th className="px-4 py-2 text-right font-medium">Recovered</th>
                <th className="px-4 py-2 text-right font-medium">This document covers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {returns.map((row) => {
                const on = row.id in picked
                return (
                  <tr key={row.id} className={on ? 'bg-core_light/40' : ''}>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={on} onChange={() => toggleReturn(row)} aria-label="Select return" />
                    </td>
                    <td className="px-4 py-2 font-medium text-foreground">{row.return_number}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(row.dispatched_at)}</td>
                    <td className="px-4 py-2 text-right">{money(row.value)}</td>
                    <td className="px-4 py-2 text-right">{money(row.recovered)}</td>
                    <td className="px-4 py-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        disabled={!on}
                        value={picked[row.id] ?? ''}
                        onChange={(event) => setPicked((prev) => ({ ...prev, [row.id]: event.target.value }))}
                        className="ml-auto h-7 w-28 text-right text-xs"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="h-8 bg-core text-xs text-white hover:bg-core/90" disabled={saving}>
          {saving ? 'Saving...' : isDebit ? 'Issue debit note' : 'Record credit note'}
        </Button>
        <Link href={`${base}/credits`}>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SupplierCreditFormContent />
    </Suspense>
  )
}