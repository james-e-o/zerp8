'use client'

import { useContext } from 'react'

import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import { formatCurrency } from '@/components/modules/purchases/dummy-data'

// Small pieces shared by the supplier credit / refund pages and the returns
// pages, so they all format money, name statuses and show results the same way.

export function useMoney() {
  const { currentBranch } = useContext(BranchContext) || {}
  return (amount) => formatCurrency(Number(amount || 0), currentBranch?.base_currency || '')
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

export function Pill({ className = 'bg-muted text-muted-foreground', children }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${className}`}>
      {children}
    </span>
  )
}

export const CREDIT_TYPES = {
  credit_note: { label: 'Credit note', className: 'bg-emerald-50 text-emerald-700' },
  debit_note: { label: 'Debit note (ours)', className: 'bg-amber-50 text-amber-800' },
  refund: { label: 'Refund', className: 'bg-sky-50 text-sky-700' },
}

export const RESOLUTION_LABELS = {
  credit_note: 'Credit note',
  refund: 'Refund',
  replacement: 'Replacement',
  debit_note: 'Our debit note',
  write_off: 'Written off',
  rejected: 'Refused by supplier',
}

export const RETURN_STATUS = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  pending_approval: { label: 'Pending approval', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800' },
  dispatched: { label: 'Dispatched', className: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

export function ReturnStatusPill({ status }) {
  const entry = RETURN_STATUS[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
  return <Pill className={entry.className}>{entry.label}</Pill>
}

// result = { ok: boolean, lines: string[] } | null
export function Notice({ result, onDismiss }) {
  if (!result) return null
  return (
    <div
      role={result.ok ? 'status' : 'alert'}
      className={`rounded-sm border p-2.5 text-xs ${
        result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      {result.lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
      {onDismiss && (
        <button type="button" className="mt-1 underline" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  )
}

export function SectionCard({ title, action, children, className = '' }) {
  return (
    <section className={`overflow-hidden rounded-sm border border-border bg-card ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted px-4 py-3">
        <h2 className="text-xs font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Stat({ label, value, hint, tone }) {
  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${tone === 'bad' ? 'text-red-700' : 'text-foreground'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'h-8 w-full rounded-sm border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-core'

// Database functions return { success: true, ... } or raise; this turns either
// into something a page can show.
export function messageOf(error, fallback = 'Something went wrong.') {
  return error?.message || fallback
}
