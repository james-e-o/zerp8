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

// suppliers/[supplierId]/refunds/new/page.js
//
// Cash the supplier paid back for goods we returned. No credit note is
// needed - sometimes a supplier just sends the money. The one exception is
// the purchase setting "Require a credit note for refunds": when it is on,
// the refund must be recorded against one of the supplier's credit notes.
// ?credit=<id> and ?return=<id> pre-fill the form.
//
// The content is wrapped in <Suspense> below because it uses useSearchParams(),
// which Next.js requires to sit inside a Suspense boundary.

const METHODS = ['Bank transfer', 'Cash', 'Cheque', 'Card', 'Other']

function SupplierRefundFormContent() {
  const { u, companyId, branchId, supplierId } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/suppliers/${supplierId}`

  const [supplier, setSupplier] = useState(null)
  const [credits, setCredits] = useState([])
  const [returns, setReturns] = useState([])
  const [requireCredit, setRequireCredit] = useState(false)
  const [creditId, setCreditId] = useState(searchParams.get('credit') || '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState(METHODS[0])
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [picked, setPicked] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const [supplierRes, creditRes, returnRes, recoveryRes, settingsRes] = await Promise.all([
        supabase.from('suppliers').select('id, name').eq('id', supplierId).maybeSingle(),
        supabase
          .from('supplier_credits')
          .select('id, credit_number, remaining_amount')
          .eq('supplier', supplierId)
          .eq('branch', branchId)
          .eq('kind', 'credit_note')
          .eq('status', 'open')
          .gt('remaining_amount', 0),
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
        supabase.rpc('get_effective_purchase_settings', { p_branch: branchId }),
      ])
      if (cancelled) return

      const recovery = Object.fromEntries((recoveryRes.data || []).map((row) => [row.purchase_return, row]))
      const list = (returnRes.data || [])
        .filter((row) => !['rejected', 'write_off', 'replacement'].includes(row.resolution))
        .map((row) => ({ ...row, ...(recovery[row.id] || { value: 0, recovered: 0, outstanding: 0 }) }))

      setSupplier(supplierRes.data || null)
      setCredits(creditRes.data || [])
      setReturns(list)
      setRequireCredit(!!settingsRes.data?.returns_require_credit_note)

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
  const selectedCredit = credits.find((credit) => credit.id === creditId)

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
    if (requireCredit && !creditId) {
      setResult({
        ok: false,
        lines: ['Purchase settings require a credit note first. Record the supplier\'s credit note, then the refund against it.'],
      })
      return
    }
    if (pickedTotal > total) {
      setResult({ ok: false, lines: ['The returns add up to more than the refund amount.'] })
      return
    }

    setSaving(true)
    const { error } = await supabase.rpc('record_supplier_refund', {
      p_branch: branchId,
      p_supplier: supplierId,
      p_refund_date: date,
      p_amount: total,
      p_method: method,
      p_reference: reference.trim() || null,
      p_credit: creditId || null,
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
    router.push(creditId ? `${base}/credits/${creditId}` : `${base}/credits?type=refund`)
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-xs">
      <div className="flex items-center gap-2">
        <Link href={`${base}/credits`}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back
          </Button>
        </Link>
        <h1 className="text-sm font-semibold text-foreground">
          Record a refund{supplier ? ` - ${supplier.name}` : ''}
        </h1>
      </div>

      <Notice result={result} onDismiss={() => setResult(null)} />

      <p className="rounded-sm border border-border bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
        {requireCredit
          ? 'Your purchase settings require a credit note before a refund. Choose the credit note this refund is against.'
          : 'The supplier does not have to send a credit note first. If they did, choose it below so the refund is taken off it.'}
      </p>

      <SectionCard title="Refund">
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Amount received</span>
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
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Date received</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">How</span>
            <select value={method} onChange={(event) => setMethod(event.target.value)} className={`${inputClass} mt-1`}>
              {METHODS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Reference</span>
            <Input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 h-8 text-xs" placeholder="Transfer / cheque number" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] text-muted-foreground">
              Against credit note{requireCredit ? ' (required)' : ' (optional)'}
            </span>
            <select value={creditId} onChange={(event) => setCreditId(event.target.value)} className={`${inputClass} mt-1`}>
              <option value="">{requireCredit ? 'Choose a credit note...' : 'None - cash refund only'}</option>
              {credits.map((credit) => (
                <option key={credit.id} value={credit.id}>
                  {credit.credit_number} - {money(credit.remaining_amount)} left
                </option>
              ))}
            </select>
            {selectedCredit && Number(amount) > Number(selectedCredit.remaining_amount) && (
              <span className="mt-1 block text-[11px] text-red-600">
                That is more than what is left on the credit note.
              </span>
            )}
          </label>
          <label className="block sm:col-span-3">
            <span className="text-[10px] text-muted-foreground">Notes</span>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-16 text-xs" />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Returns this refund covers (optional)"
        action={pickedTotal > 0 ? <span className="text-[10px] text-muted-foreground">Selected: {money(pickedTotal)}</span> : null}
      >
        {loading ? (
          <p className="p-4 text-muted-foreground">Loading returns...</p>
        ) : returns.length === 0 ? (
          <p className="p-4 text-muted-foreground">No dispatched returns waiting for money from this supplier.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-[10px] text-muted-foreground">
              <tr>
                <th className="w-8 px-4 py-2" />
                <th className="px-4 py-2 text-left font-medium">Return</th>
                <th className="px-4 py-2 text-left font-medium">Dispatched</th>
                <th className="px-4 py-2 text-right font-medium">Worth</th>
                <th className="px-4 py-2 text-right font-medium">Recovered</th>
                <th className="px-4 py-2 text-right font-medium">This refund covers</th>
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
          {saving ? 'Saving...' : 'Record refund'}
        </Button>
        <Link href={`${base}/credits`}>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs">Cancel</Button>
        </Link>
      </div>
    </form>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SupplierRefundFormContent />
    </Suspense>
  )
}