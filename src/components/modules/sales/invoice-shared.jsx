'use client'

// Small pieces shared by the invoice pages: the status pill, payment methods and balance.

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'other', label: 'Other' },
]

export function methodLabel(value) {
  return PAYMENT_METHODS.find((entry) => entry.value === value)?.label || value || '—'
}

// Overdue is worked out here from the due date; the database keeps draft / unpaid /
// partially_paid / paid / cancelled.
export function isOverdue(invoice) {
  if (!invoice || !['unpaid', 'partially_paid'].includes(invoice.status) || !invoice.due_date) return false
  const due = new Date(invoice.due_date)
  if (Number.isNaN(due.getTime())) return false
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  return due < startOfToday
}

export function balanceOf(invoice) {
  return Math.max(0, Math.round((Number(invoice?.total || 0) - Number(invoice?.credited || 0) - Number(invoice?.paid || 0)) * 100) / 100)
}

const STYLES = {
  draft: ['Draft', 'bg-slate-100 text-slate-700'],
  unpaid: ['Unpaid', 'bg-amber-50 text-amber-700'],
  partially_paid: ['Partially paid', 'bg-blue-50 text-blue-700'],
  paid: ['Paid', 'bg-emerald-50 text-emerald-700'],
  overdue: ['Overdue', 'bg-red-50 text-red-700'],
  cancelled: ['Cancelled', 'bg-red-50 text-red-700'],
}

export function InvoiceStatusPill({ invoice }) {
  const key = isOverdue(invoice) ? 'overdue' : invoice?.status
  const [label, tone] = STYLES[key] || [key || '—', 'bg-slate-100 text-slate-700']
  return <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{label}</span>
}
