'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import supabase from '@/config/supabaseClient'
import {
  CREDIT_TYPES,
  Pill,
  Stat,
  formatDate,
  useMoney,
} from '@/components/modules/purchases/supplier-credit-shared'

// suppliers/[supplierId]/credits/page.js
// One list for everything the supplier has given back to us:
//   Credit notes   the supplier's own documents
//   Debit notes    ones WE issued when the supplier stayed silent
//   Refunds        cash they paid back (a credit note is not needed)
// ?type=debit_note (etc.) presets the filter, so the sidebar can link
// straight to "Debit notes".
//
// The content is wrapped in <Suspense> below because it uses useSearchParams(),
// which Next.js requires to sit inside a Suspense boundary.

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'credit_note', label: 'Credit notes' },
  { key: 'debit_note', label: 'Debit notes' },
  { key: 'refund', label: 'Refunds' },
]

function SupplierCreditsContent() {
  const { u, companyId, branchId, supplierId } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/suppliers/${supplierId}`

  const requested = searchParams.get('type')
  const filter = FILTERS.some((item) => item.key === requested) ? requested : 'all'

  const [credits, setCredits] = useState([])
  const [refunds, setRefunds] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      const [creditRes, refundRes, summaryRes] = await Promise.all([
        supabase
          .from('supplier_credits')
          .select('id, kind, credit_number, credit_date, amount, applied_amount, refunded_amount, remaining_amount, status, created_at')
          .eq('supplier', supplierId)
          .eq('branch', branchId)
          .order('created_at', { ascending: false }),
        supabase
          .from('supplier_refunds')
          .select('id, credit, refund_date, amount, method, reference, created_at')
          .eq('supplier', supplierId)
          .eq('branch', branchId)
          .order('created_at', { ascending: false }),
        supabase
          .from('supplier_account_summary')
          .select('*')
          .eq('supplier', supplierId)
          .eq('branch', branchId)
          .maybeSingle(),
      ])

      if (cancelled) return

      const failure = creditRes.error || refundRes.error || summaryRes.error
      if (failure) {
        console.error('Failed to load supplier credits:', failure)
        setErrorMessage(failure.message || 'Could not load credits and refunds.')
      } else {
        setCredits(creditRes.data || [])
        setRefunds(refundRes.data || [])
        setSummary(summaryRes.data || null)
      }
      setLoading(false)
    }

    if (supplierId && branchId) load()
    return () => {
      cancelled = true
    }
  }, [supplierId, branchId])

  const rows = useMemo(() => {
    const all = [
      ...credits.map((credit) => ({
        key: `c-${credit.id}`,
        type: credit.kind,
        number: credit.credit_number,
        date: credit.credit_date,
        amount: credit.amount,
        remaining: credit.status === 'void' ? null : credit.remaining_amount,
        void: credit.status === 'void',
        href: `${base}/credits/${credit.id}`,
        sort: credit.created_at,
      })),
      ...refunds.map((refund) => ({
        key: `r-${refund.id}`,
        type: 'refund',
        number: refund.reference || (refund.method ? refund.method : 'Refund'),
        date: refund.refund_date,
        amount: refund.amount,
        remaining: null,
        void: false,
        href: refund.credit ? `${base}/credits/${refund.credit}` : null,
        sort: refund.created_at,
      })),
    ]
    return all
      .filter((row) => filter === 'all' || row.type === filter)
      .sort((a, b) => String(b.sort).localeCompare(String(a.sort)))
  }, [credits, refunds, filter, base])

  const setFilter = (key) => {
    router.replace(key === 'all' ? `${base}/credits` : `${base}/credits?type=${key}`)
  }

  const net = Number(summary?.net_owed || 0)

  return (
    <div className="space-y-4 text-xs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Unpaid bills" value={money(summary?.unpaid_bills)} />
        <Stat
          label="Credit remaining"
          value={money(summary?.credit_remaining)}
          hint={
            Number(summary?.unacknowledged_credit_remaining || 0) > 0
              ? `${money(summary.unacknowledged_credit_remaining)} of it is our own debit notes`
              : undefined
          }
        />
        <Stat
          label={net < 0 ? 'Supplier owes us' : 'Net owed to supplier'}
          value={money(Math.abs(net))}
          tone={net < 0 ? 'bad' : undefined}
        />
        <Stat
          label="Returns awaiting outcome"
          value={String(summary?.returns_awaiting_outcome || 0)}
          hint={
            Number(summary?.returns_awaiting_outcome || 0) > 0
              ? `${money(summary.awaiting_value)} not recovered yet`
              : undefined
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === item.key
                  ? 'border-core bg-core text-white'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${base}/credits/new?type=credit_note`}
            className="rounded-sm bg-core px-3 py-1.5 text-xs font-medium text-white hover:bg-core/90"
          >
            Record credit note
          </Link>
          <Link
            href={`${base}/credits/new?type=debit_note`}
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Issue debit note
          </Link>
          <Link
            href={`${base}/refunds/new`}
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Record refund
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : errorMessage ? (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>
      ) : rows.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Number / reference</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-right font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const type = CREDIT_TYPES[row.type]
                return (
                  <tr
                    key={row.key}
                    role={row.href ? 'link' : undefined}
                    tabIndex={row.href ? 0 : undefined}
                    onClick={row.href ? () => router.push(row.href) : undefined}
                    onKeyDown={
                      row.href
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              router.push(row.href)
                            }
                          }
                        : undefined
                    }
                    className={row.href ? 'cursor-pointer hover:bg-muted/50' : ''}
                  >
                    <td className="px-4 py-2">
                      <Pill className={type.className}>{type.label}</Pill>
                      {row.void && <Pill className="ml-1 bg-red-50 text-red-700">Void</Pill>}
                    </td>
                    <td className="px-4 py-2 font-medium text-foreground">{row.number}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(row.date)}</td>
                    <td className="px-4 py-2 text-right text-foreground">{money(row.amount)}</td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {row.remaining === null ? '—' : money(row.remaining)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SupplierCreditsContent />
    </Suspense>
  )
}