'use client'

// Shared by the returns list and the return pages: the status pill.
const STYLES = {
  requested: ['Requested', 'bg-amber-50 text-amber-700'],
  approved: ['Approved', 'bg-blue-50 text-blue-700'],
  partially_received: ['Partly received', 'bg-blue-50 text-blue-700'],
  received: ['Received', 'bg-emerald-50 text-emerald-700'],
  cancelled: ['Cancelled', 'bg-red-50 text-red-700'],
}

export function ReturnStatusPill({ status }) {
  const [label, tone] = STYLES[status] || [status || '—', 'bg-slate-100 text-slate-700']
  return <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{label}</span>
}
